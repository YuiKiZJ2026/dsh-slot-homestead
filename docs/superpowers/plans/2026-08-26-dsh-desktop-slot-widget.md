# DSH Desktop Slot Widget Implementation Plan

> 已暂停并被原生 DSH Desktop 插件方向取代。不要执行本计划；新计划将在 `2026-08-26-dsh-desktop-native-plugin-design.md` 复核通过后生成。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可在本地浏览器运行的 DSH 桌面老虎机交互原型，把模拟任务、验证和专注时长转换为硬币，并完整演示投币、拉杆、返奖、收藏展示与商店购买。

**Architecture:** React 管理桌面外壳、面板、可访问交互和状态协调；固定 384×288 逻辑分辨率的 Canvas 负责像素场景和动画。经济、老虎机、库存、适配器与持久化均为独立纯 TypeScript 模块；`MockDshAdapter` 可被未来真实 DSH 适配器替换。

**Tech Stack:** Node.js 20+、npm 10+、React、TypeScript、Vite、Canvas 2D、Zod、Vitest、React Testing Library、Playwright、现代 Chromium Web Locks API。

**Spec:** `docs/superpowers/specs/2026-08-26-dsh-desktop-slot-widget-design.md`

## Global Constraints

- 主画面必须是模拟桌面，老虎机组件固定在右下角；老虎机正面朝向用户，只露顶部和少量右侧厚度。
- Canvas 逻辑分辨率固定为 384×288，只做整数倍缩放；关闭图像平滑并使用最近邻采样。
- 每日首次打开赠送 3 枚硬币，不计入每日工作奖励上限。
- 完成任务奖励 1 枚；首次验证已完成任务有 30% 概率额外奖励 1 枚。
- 每 60 分钟有效专注奖励 2 枚；专注奖励每日最多 16 枚；全部工作奖励每日最多 25 枚。
- 每次成功投币消耗 1 枚并立即持久化完整 resolved spin；拉杆不再次扣币。
- 第 11 次未获得新收藏品时强制保底；重复品按普通 3、稀有 9、套装 15 枚折算。
- 首版固定 12 件纯装饰收藏品：6 普通、3 稀有、3 件“星夜观测”套装。
- 不实现真实 DSH、账户、云同步、付费货币、现金价值或生产能力奖励。
- 只允许一个活动写入标签页；未获得 Web Lock 的标签页为只读镜像。
- 默认静音；支持键盘、ARIA 名称和 `prefers-reduced-motion`。
- 每个行为任务先写失败测试、确认失败、写最小实现、确认通过，再提交。

---

## Target File Map

```text
index.html                         Vite 入口
.gitignore                        依赖、构建物、报告和生成源图忽略规则
package.json                       脚本与依赖
tsconfig.json                      TypeScript 严格配置
vite.config.ts                     Vite 与 Vitest 配置
vitest.setup.ts                    DOM 测试扩展
playwright.config.ts               端到端浏览器配置
src/main.tsx                       React 启动入口
src/app/App.tsx                    桌面外壳组合
src/app/use-game-controller.ts     状态、适配器、仓库和动画协调
src/audio/sfx.ts                   默认静音的短促 Web Audio 音效
src/components/GameCanvas.tsx      Canvas 与可访问 DOM 热区
src/components/DemoPanel.tsx       模拟 DSH 事件控制台
src/components/CollectionPanel.tsx 收藏柜与展示切换
src/components/ShopPanel.tsx       商店购买界面
src/components/SettingsPanel.tsx   静音、减弱动画、缩放设置
src/domain/types.ts                共享领域类型和初始状态
src/domain/catalog.ts              十二件收藏品目录
src/dsh/events.ts                  DSH 内部事件联合类型
src/dsh/adapter.ts                 适配器接口
src/dsh/mock-adapter.ts            可控模拟适配器
src/economy/work-rewards.ts        每日、任务、验证和专注奖励
src/game/rng.ts                    可注入随机源和稳定验证散列
src/game/outcomes.ts               概率、保底和完整 spin 解析
src/game/machine.ts                投币到结算的纯状态机
src/inventory/inventory.ts         结算、购买、展示和套装状态
src/storage/schema.ts              Zod 存档 Schema
src/storage/repository.ts          单快照存取、备份和修订控制
src/storage/writer-lock.ts         Web Locks 单写入标签页
src/time/clock.ts                  系统与测试时钟
src/game/renderer/assets.ts        像素图集与源矩形清单
src/game/renderer/scene-renderer.ts Canvas 分层绘制
src/game/renderer/animation.ts     固定阶段动画时间轴
src/styles/global.css              桌面、面板、像素缩放与响应式样式
public/assets/scene-base.png        正面老虎机与厚木桌透明底图
public/assets/reel-symbols.png      五个转轮符号图集
public/assets/collectibles.png      十二件收藏品 4×3 图集
tests/app-flow.spec.ts              完整经济与老虎机端到端流程
tests/visual.spec.ts                三个目标视口视觉回归
README.md                           运行、规则、限制与接入说明
```

### Task 1: Scaffold the Tested React Application

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/App.test.tsx`
- Create: `src/styles/global.css`

**Interfaces:**
- Consumes: none
- Produces: `App(): JSX.Element`; npm scripts `dev`, `build`, `typecheck`, `test`, `test:run`, `test:e2e`

- [ ] **Step 1: Initialize dependencies and scripts**

Run:

```bash
npm init -y
npm install react react-dom zod
npm install -D typescript vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/react @types/react-dom @playwright/test
npm pkg set type=module
npm pkg set "scripts.dev=vite"
npm pkg set "scripts.build=tsc --noEmit && vite build"
npm pkg set "scripts.typecheck=tsc --noEmit"
npm pkg set "scripts.test=vitest"
npm pkg set "scripts.test:run=vitest run"
npm pkg set "scripts.test:e2e=playwright test"
```

Create `tsconfig.json` with strict DOM typing:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "tests", "vite.config.ts", "playwright.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    css: true,
  },
});
```

- [ ] **Step 2: Write the failing application-shell test**

Create `vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create `src/app/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the DSH desktop application shell", () => {
    render(<App />);
    expect(
      screen.getByRole("application", { name: "DSH 桌面老虎机" }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test and verify the red state**

Run: `npm run test:run -- src/app/App.test.tsx`

Expected: FAIL because `src/app/App.tsx` does not exist.

- [ ] **Step 4: Add the minimal shell**

Create `src/app/App.tsx`:

```tsx
export function App() {
  return (
    <main className="desktop" role="application" aria-label="DSH 桌面老虎机">
      <div className="desktop__ambient" aria-hidden="true" />
    </main>
  );
}
```

Create `src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Create `index.html` with `<div id="root"></div>` and a module script pointing to `/src/main.tsx`. Create `src/styles/global.css` with full-viewport sizing, `box-sizing: border-box`, a deep navy background, and no fractional transform on the widget container.

Create `.gitignore` with these exact entries:

```text
node_modules/
dist/
coverage/
playwright-report/
test-results/
tmp/
public/assets/*-source.png
```

- [ ] **Step 5: Verify the shell**

Run:

```bash
npm run test:run -- src/app/App.test.tsx
npm run typecheck
npm run build
```

Expected: one passing test; typecheck and production build exit 0.

- [ ] **Step 6: Commit**

```bash
git add .gitignore package.json package-lock.json index.html tsconfig.json vite.config.ts vitest.setup.ts src
git commit -m "chore: scaffold tested React prototype"
```

### Task 2: Define the Domain State and Collectible Catalog

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/catalog.ts`
- Create: `src/domain/catalog.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `GameState`, `DailyLedger`, `ResolvedReward`, `ResolvedSpin`, `CollectibleDefinition`, `createInitialState()`, `COLLECTIBLES`

- [ ] **Step 1: Write failing catalog and initial-state tests**

Create `src/domain/catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { COLLECTIBLES } from "./catalog";
import { createInitialState } from "./types";

describe("collectible catalog", () => {
  it("contains exactly six common, three rare, and three set items", () => {
    expect(COLLECTIBLES).toHaveLength(12);
    expect(COLLECTIBLES.filter((item) => item.rarity === "common")).toHaveLength(6);
    expect(COLLECTIBLES.filter((item) => item.rarity === "rare")).toHaveLength(3);
    expect(COLLECTIBLES.filter((item) => item.rarity === "set")).toHaveLength(3);
    expect(new Set(COLLECTIBLES.map((item) => item.id)).size).toBe(12);
  });

  it("uses approved prices and cosmetic-only effects", () => {
    for (const item of COLLECTIBLES) {
      const expected = {
        common: { price: 6, duplicateCoins: 3 },
        rare: { price: 18, duplicateCoins: 9 },
        set: { price: 30, duplicateCoins: 15 },
      }[item.rarity];
      expect(item.price).toBe(expected.price);
      expect(item.duplicateCoins).toBe(expected.duplicateCoins);
      expect(item.effect.kind).toMatch(/^(idle-animation|particle|sound|theme)$/);
    }
  });

  it("starts with an empty wallet before the daily-open grant", () => {
    const state = createInitialState();
    expect(state.wallet).toBe(0);
    expect(state.pityMisses).toBe(0);
    expect(state.activeSpin).toBeNull();
    expect(state.ownedCollectibles).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `npm run test:run -- src/domain/catalog.test.ts`

Expected: FAIL because the domain modules do not exist.

- [ ] **Step 3: Implement exact shared types**

Create `src/domain/types.ts` with these public shapes:

```ts
export type DateKey = `${number}-${number}-${number}`;
export type Rarity = "common" | "rare" | "set";
export type ReelSymbol = "coin" | "leaf" | "crystal" | "moon" | "robot";
export type AgentStatus = "idle" | "working" | "completed" | "error";

export interface DailyLedger {
  workCoins: number;
  focusMinutes: number;
  settledFocusHours: number;
  focusCoins: number;
}

export type ResolvedReward =
  | { kind: "none" }
  | { kind: "coins"; amount: number; reason: "refund" | "five-coins" | "pity-fallback" | "robot-fallback" }
  | {
      kind: "collectible";
      collectibleId: string;
      isDuplicate: boolean;
      conversionCoins: number;
      bonusCoins: number;
    };

export interface ResolvedSpin {
  id: string;
  stage: "coin-inserted" | "spinning" | "highlight" | "payout" | "settled";
  reels: readonly [ReelSymbol, ReelSymbol, ReelSymbol];
  reward: ResolvedReward;
  pityAfter: number;
  createdAt: string;
}

export interface GameSettings {
  muted: boolean;
  reducedMotion: boolean;
  scale: 1 | 2;
}

export interface GameState {
  schemaVersion: 1;
  revision: number;
  wallet: number;
  lastAwardDate: DateKey | null;
  dailyLedgers: Record<string, DailyLedger>;
  processedEvents: Record<string, string>;
  completedTasks: Record<string, string>;
  verifiedTasks: Record<string, string>;
  pendingVerifications: Record<string, { eventId: string; occurredAt: string }>;
  pityMisses: number;
  ownedCollectibles: string[];
  displayedCollectibles: string[];
  activeSpin: ResolvedSpin | null;
  agentStatus: AgentStatus;
  settings: GameSettings;
}

export interface CollectibleDefinition {
  id: string;
  name: string;
  rarity: Rarity;
  price: number;
  duplicateCoins: number;
  effect: { kind: "idle-animation" | "particle" | "sound" | "theme" };
}

export function createInitialState(): GameState {
  return {
    schemaVersion: 1,
    revision: 0,
    wallet: 0,
    lastAwardDate: null,
    dailyLedgers: {},
    processedEvents: {},
    completedTasks: {},
    verifiedTasks: {},
    pendingVerifications: {},
    pityMisses: 0,
    ownedCollectibles: [],
    displayedCollectibles: [],
    activeSpin: null,
    agentStatus: "idle",
    settings: { muted: true, reducedMotion: false, scale: 1 },
  };
}
```

- [ ] **Step 4: Implement all twelve catalog entries**

Create `src/domain/catalog.ts`. Export `CollectibleDefinition`, `COLLECTIBLES`, `CATALOG_BY_ID`, and `itemsByRarity(rarity)`. Use these exact IDs:

```ts
export const COLLECTIBLES = [
  ["plant", "小盆栽", "common", "idle-animation"],
  ["book-stand", "书本底座", "common", "idle-animation"],
  ["desk-clock", "桌面时钟", "common", "idle-animation"],
  ["warm-mug", "热饮杯", "common", "particle"],
  ["toolbox", "迷你工具箱", "common", "idle-animation"],
  ["paper-lantern", "纸灯笼", "common", "particle"],
  ["crystal", "发光水晶", "rare", "particle"],
  ["moon-lamp", "月亮灯", "rare", "sound"],
  ["mini-robot", "迷你机器人", "rare", "idle-animation"],
  ["star-projector", "星星投影仪", "set", "theme"],
  ["constellation-globe", "星座球", "set", "theme"],
  ["comet-badge", "彗星徽章", "set", "theme"],
] as const;
```

Map rarity to `{ common: [6, 3], rare: [18, 9], set: [30, 15] }`, and expose only cosmetic `effect` metadata.

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
npm run test:run -- src/domain/catalog.test.ts
npm run typecheck
```

Expected: three passing tests and no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/domain
git commit -m "feat: define game domain and collectible catalog"
```

### Task 3: Implement Work Rewards, Clock, and DSH Event Semantics

**Files:**
- Create: `src/time/clock.ts`
- Create: `src/dsh/events.ts`
- Create: `src/economy/work-rewards.ts`
- Create: `src/economy/work-rewards.test.ts`
- Create: `src/game/rng.ts`

**Interfaces:**
- Consumes: `GameState`, `DailyLedger`, `DateKey` from `src/domain/types.ts`
- Produces: `Clock`, `SystemClock`, `FixedClock`, `DshEvent`, `applyDailyOpen(state, date)`, `applyDshEvent(state, event, dependencies)`, `stableVerificationRoll(eventId)`

- [ ] **Step 1: Write failing reward tests**

Create `src/economy/work-rewards.test.ts` with fixed dates and an injected verification roll:

```ts
import { describe, expect, it } from "vitest";
import { createInitialState } from "../domain/types";
import { applyDailyOpen, applyDshEvent } from "./work-rewards";

const day = "2026-08-26" as const;
const deps = { nowDate: day, verificationRoll: () => 0.1 };

describe("work rewards", () => {
  it("grants daily three once and outside the work cap", () => {
    const first = applyDailyOpen(createInitialState(), day);
    const second = applyDailyOpen(first, day);
    expect(first.wallet).toBe(3);
    expect(first.dailyLedgers[day]?.workCoins ?? 0).toBe(0);
    expect(second.wallet).toBe(3);
  });

  it("grants one coin for a unique completed task", () => {
    const event = { id: "event-1", taskId: "task-1", type: "task.completed" as const, occurredAt: "2026-08-26T09:00:00+08:00" };
    const once = applyDshEvent(createInitialState(), event, deps);
    const twice = applyDshEvent(once, event, deps);
    expect(once.wallet).toBe(1);
    expect(twice.wallet).toBe(1);
  });

  it("queues an early verification and awards it once after completion", () => {
    const verified = { id: "verify-1", taskId: "task-1", type: "task.verified" as const, occurredAt: "2026-08-26T09:01:00+08:00" };
    const completed = { id: "complete-1", taskId: "task-1", type: "task.completed" as const, occurredAt: "2026-08-26T09:02:00+08:00" };
    const queued = applyDshEvent(createInitialState(), verified, deps);
    const resolved = applyDshEvent(queued, completed, deps);
    expect(queued.wallet).toBe(0);
    expect(resolved.wallet).toBe(2);
    expect(resolved.verifiedTasks["task-1"]).toBeDefined();
  });

  it("awards two coins per full hour, clips to sixteen focus coins", () => {
    const focus = { id: "focus-1", type: "focus.minutes" as const, occurredAt: "2026-08-26T10:00:00+08:00", minutes: 540 };
    const state = applyDshEvent(createInitialState(), focus, deps);
    expect(state.wallet).toBe(16);
    expect(state.dailyLedgers[day].focusMinutes).toBe(540);
    expect(state.dailyLedgers[day].settledFocusHours).toBe(8);
  });

  it("clips a two-coin focus hour to one at work total 24 of 25", () => {
    const base = createInitialState();
    base.dailyLedgers[day] = { workCoins: 24, focusMinutes: 0, settledFocusHours: 0, focusCoins: 0 };
    const event = { id: "focus-clip", type: "focus.minutes" as const, occurredAt: "2026-08-26T11:00:00+08:00", minutes: 60 };
    const next = applyDshEvent(base, event, deps);
    expect(next.wallet).toBe(1);
    expect(next.dailyLedgers[day]).toMatchObject({ workCoins: 25, settledFocusHours: 1, focusCoins: 1 });
  });

  it("does not grant a new daily award after clock rollback", () => {
    const future = applyDailyOpen(createInitialState(), "2026-08-28");
    const rollback = applyDailyOpen(future, "2026-08-27");
    expect(rollback.wallet).toBe(3);
    expect(rollback.lastAwardDate).toBe("2026-08-28");
  });

  it("caps combined work rewards at twenty-five", () => {
    let state = createInitialState();
    for (let index = 0; index < 26; index += 1) {
      state = applyDshEvent(state, {
        id: `event-${index}`,
        taskId: `task-${index}`,
        type: "task.completed",
        occurredAt: "2026-08-26T09:00:00+08:00",
      }, deps);
    }
    expect(state.wallet).toBe(25);
    expect(state.dailyLedgers[day].workCoins).toBe(25);
  });

  it("records but does not reward an event older than seven days", () => {
    const event = { id: "old-event", taskId: "old-task", type: "task.completed" as const, occurredAt: "2026-08-18T09:00:00+08:00" };
    const state = applyDshEvent(createInitialState(), event, deps);
    expect(state.wallet).toBe(0);
    expect(state.completedTasks["old-task"]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the reward tests and verify failure**

Run: `npm run test:run -- src/economy/work-rewards.test.ts`

Expected: FAIL because reward modules do not exist.

- [ ] **Step 3: Implement clock, events, and deterministic verification**

Create `src/time/clock.ts`:

```ts
export interface Clock { now(): Date }
export class SystemClock implements Clock { now() { return new Date(); } }
export class FixedClock implements Clock {
  constructor(private value: Date) {}
  now() { return new Date(this.value); }
  set(value: Date) { this.value = new Date(value); }
}
import type { DateKey } from "../domain/types";

export function localDateKey(value: Date | string): DateKey {
  const date = typeof value === "string" ? new Date(value) : value;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}` as DateKey;
}
```

Create `src/dsh/events.ts` with the exact discriminated union from the spec, including `taskId` for both task events and positive finite `minutes` for focus events.

Create `src/game/rng.ts`:

```ts
export interface RandomSource { next(): number }
export const mathRandomSource: RandomSource = { next: () => Math.random() };
export function stableVerificationRoll(eventId: string) {
  let hash = 0x811c9dc5;
  for (const char of `dsh-verify-v1:${eventId}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}
```

- [ ] **Step 4: Implement immutable reward processing**

In `src/economy/work-rewards.ts`:

- Clone only records changed by an event.
- Attribute events by `occurredAt` local date.
- Ignore reward events older than seven days; retain processed/completed/verified IDs for thirty days.
- Treat an event ID as processed when queued, so replays cannot queue twice.
- On a task completion, award `min(1, 25 - workCoins)` and resolve a matching queued verification.
- On a first verification for an already completed task, award one only when `verificationRoll(id) < 0.3` and capacity remains.
- On focus events, compute newly completed hours from `min(focusMinutes, 480)`, consume every full hour even when the 25-coin cap clips the theoretical two-coin reward, and cap actual focus coins at 16.
- On `agent.status`, update only `state.agentStatus`, record the event ID, and never change wallet or ledgers.
- Preserve `wallet >= 0`, `workCoins <= 25`, and `focusCoins <= 16`.

Public signatures:

```ts
export function applyDailyOpen(state: GameState, today: DateKey): GameState;
export function applyDshEvent(
  state: GameState,
  event: DshEvent,
  deps: { nowDate: DateKey; verificationRoll: (eventId: string) => number },
): GameState;
```

- [ ] **Step 5: Verify all reward boundaries**

Run:

```bash
npm run test:run -- src/economy/work-rewards.test.ts
npm run typecheck
```

Expected: eight passing tests and no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/time src/dsh/events.ts src/economy src/game/rng.ts
git commit -m "feat: implement bounded work rewards"
```

### Task 4: Resolve Paid Spins, Probabilities, and Pity

**Files:**
- Create: `src/game/outcomes.ts`
- Create: `src/game/outcomes.test.ts`

**Interfaces:**
- Consumes: `GameState`, `ResolvedSpin`, `ResolvedReward`, `ReelSymbol`, `COLLECTIBLES`, `RandomSource`
- Produces: `OutcomeKind`, `createPaidSpin(state, rng, now, createId, forcedOutcome?)`, `SpinCreationResult`, `reelsForOutcome(kind, variant)`

- [ ] **Step 1: Write failing outcome tests**

Create `src/game/outcomes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createInitialState } from "../domain/types";
import { createPaidSpin } from "./outcomes";

function sequence(...values: number[]) {
  let index = 0;
  return { next: () => values[index++] ?? values.at(-1) ?? 0 };
}

describe("paid spin resolution", () => {
  it("refuses a spin without a coin", () => {
    const result = createPaidSpin(createInitialState(), sequence(0), new Date("2026-08-26T08:00:00Z"), () => "spin-1");
    expect(result).toEqual({ ok: false, reason: "INSUFFICIENT_COINS" });
  });

  it("deducts one coin and locks the complete five-coin result", () => {
    const state = createInitialState();
    state.wallet = 3;
    const result = createPaidSpin(state, sequence(0.70), new Date("2026-08-26T08:00:00Z"), () => "spin-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.wallet).toBe(2);
    expect(result.spin).toMatchObject({ id: "spin-1", stage: "coin-inserted", reels: ["coin", "coin", "coin"], reward: { kind: "coins", amount: 5 } });
  });

  it("forces an unowned collectible before the base roll on miss eleven", () => {
    const state = createInitialState();
    state.wallet = 1;
    state.pityMisses = 10;
    const result = createPaidSpin(state, sequence(0.1, 0.1), new Date("2026-08-26T08:00:00Z"), () => "spin-pity");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spin.reward.kind).toBe("collectible");
    expect(result.spin.pityAfter).toBe(0);
  });

  it("converts a duplicate common item and keeps pity progressing", () => {
    const state = createInitialState();
    state.wallet = 1;
    state.pityMisses = 4;
    state.ownedCollectibles = ["plant"];
    const result = createPaidSpin(state, sequence(0.80, 0), new Date("2026-08-26T08:00:00Z"), () => "spin-dup");
    expect(result.ok).toBe(true);
    if (!result.ok || result.spin.reward.kind !== "collectible") return;
    expect(result.spin.reward).toMatchObject({ collectibleId: "plant", isDuplicate: true, conversionCoins: 3 });
    expect(result.spin.pityAfter).toBe(5);
  });

  it("resolves the robot jackpot to twelve coins when all rares are owned", () => {
    const state = createInitialState();
    state.wallet = 1;
    state.ownedCollectibles = ["crystal", "moon-lamp", "mini-robot"];
    const result = createPaidSpin(state, sequence(0.995), new Date("2026-08-26T08:00:00Z"), () => "spin-robot");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spin.reward).toEqual({ kind: "coins", amount: 12, reason: "robot-fallback" });
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test:run -- src/game/outcomes.test.ts`

Expected: FAIL because `createPaidSpin` does not exist.

- [ ] **Step 3: Implement exact probability bands and reel mappings**

Use these half-open roll ranges:

```ts
const OUTCOME_BANDS = [
  [0.00, 0.45, "none"],
  [0.45, 0.69, "refund"],
  [0.69, 0.77, "five-coins"],
  [0.77, 0.89, "common"],
  [0.89, 0.96, "rare"],
  [0.96, 0.99, "set"],
  [0.99, 1.00, "robot-jackpot"],
] as const;
```

Map winning reels exactly to three matching symbols. For `refund`, choose one non-coin third symbol with the second RNG value. For `none`, choose a combination containing at most one coin and no matching triple. Resolve the specific collectible, duplicate status, conversion amount, bonus coins, final reel symbols, and `pityAfter` before returning.

Set `pityAfter` to `0` only when a new collectible is resolved or the fully-collected pity fallback pays 9 coins. Every ordinary coin result, no-reward result, and duplicate conversion sets `pityAfter = Math.min(10, state.pityMisses + 1)`.

Export `OutcomeKind` as the seven strings in `OUTCOME_BANDS`. When `pityMisses >= 10`, bypass `OUTCOME_BANDS`: choose unowned common/rare with 75%/25%; if one pool is empty use the other; if both are empty return 9 coins and `pityAfter: 0`. The optional `forcedOutcome` exists only for deterministic development demos and tests; when present it bypasses both pity and the base probability roll for that one spin. A forced collectible outcome chooses the first unowned item of that rarity in catalog order, falling back to the first catalog item of that rarity when the pool is complete, so screenshots and E2E selectors remain deterministic.

Reject a second insert while `activeSpin !== null`. On success, deduct one coin and store the complete spin in `state.activeSpin` before returning.

- [ ] **Step 4: Verify deterministic paid-spin behavior**

Run:

```bash
npm run test:run -- src/game/outcomes.test.ts
npm run typecheck
```

Expected: five passing tests and no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/game/outcomes.ts src/game/outcomes.test.ts
git commit -m "feat: resolve deterministic paid spins"
```

### Task 5: Implement Inventory, Shop, Display Slots, and Settlement

**Files:**
- Create: `src/inventory/inventory.ts`
- Create: `src/inventory/inventory.test.ts`

**Interfaces:**
- Consumes: `GameState`, `ResolvedSpin`, `COLLECTIBLES`, `CATALOG_BY_ID`
- Produces: `settleActiveSpin(state, spinId)`, `buyCollectible(state, id)`, `setCollectibleDisplayed(state, id, displayed)`, `hasStarryNightTheme(state)`

- [ ] **Step 1: Write failing inventory tests**

Create `src/inventory/inventory.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createInitialState } from "../domain/types";
import { buyCollectible, hasStarryNightTheme, settleActiveSpin, setCollectibleDisplayed } from "./inventory";

describe("inventory and shop", () => {
  it("settles a new collectible exactly once", () => {
    const state = createInitialState();
    state.activeSpin = {
      id: "spin-1", stage: "payout", reels: ["leaf", "leaf", "leaf"],
      reward: { kind: "collectible", collectibleId: "plant", isDuplicate: false, conversionCoins: 0, bonusCoins: 0 },
      pityAfter: 0, createdAt: "2026-08-26T00:00:00Z",
    };
    const once = settleActiveSpin(state, "spin-1");
    const twice = settleActiveSpin(once, "spin-1");
    expect(once.ownedCollectibles).toContain("plant");
    expect(once.displayedCollectibles).toContain("plant");
    expect(twice.wallet).toBe(once.wallet);
  });

  it("pays duplicate conversion and bonus coins", () => {
    const state = createInitialState();
    state.ownedCollectibles = ["crystal"];
    state.activeSpin = {
      id: "spin-2", stage: "payout", reels: ["crystal", "crystal", "crystal"],
      reward: { kind: "collectible", collectibleId: "crystal", isDuplicate: true, conversionCoins: 9, bonusCoins: 3 },
      pityAfter: 5, createdAt: "2026-08-26T00:00:00Z",
    };
    const settled = settleActiveSpin(state, "spin-2");
    expect(settled.wallet).toBe(12);
    expect(settled.pityMisses).toBe(5);
  });

  it("buys only an unowned item with sufficient balance", () => {
    const state = createInitialState();
    state.wallet = 6;
    const bought = buyCollectible(state, "plant");
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    expect(bought.state.wallet).toBe(0);
    expect(bought.state.ownedCollectibles).toContain("plant");
    expect(buyCollectible(bought.state, "plant")).toEqual({ ok: false, reason: "ALREADY_OWNED" });
  });

  it("limits automatic display to available ordered slots", () => {
    const state = createInitialState();
    state.ownedCollectibles = ["plant"];
    const shown = setCollectibleDisplayed(state, "plant", true);
    expect(shown.displayedCollectibles).toEqual(["plant"]);
  });

  it("activates the cosmetic theme only after all three set items", () => {
    const state = createInitialState();
    state.ownedCollectibles = ["star-projector", "constellation-globe", "comet-badge"];
    expect(hasStarryNightTheme(state)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test:run -- src/inventory/inventory.test.ts`

Expected: FAIL because inventory functions do not exist.

- [ ] **Step 3: Implement settlement and shop result unions**

Use these public return types:

```ts
type PurchaseResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: "UNKNOWN_ITEM" | "ALREADY_OWNED" | "INSUFFICIENT_COINS" };
```

`settleActiveSpin` must require the matching `spinId`; return unchanged state when no active spin or when the spin is already `settled`; add coin amounts or inventory exactly once; write `pityAfter`; auto-display a new item in catalog order when fewer than twelve items are displayed; and mark the spin `settled`.

`buyCollectible` must read the exact catalog price, deduct atomically, add the item, and auto-display it. `setCollectibleDisplayed` must reject unknown/unowned IDs and preserve catalog order in the array.

- [ ] **Step 4: Verify inventory behavior**

Run:

```bash
npm run test:run -- src/inventory/inventory.test.ts
npm run typecheck
```

Expected: five passing tests and no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/inventory
git commit -m "feat: add collectible inventory and shop"
```

### Task 6: Implement the Slot-Machine State Machine and Recovery

**Files:**
- Create: `src/game/machine.ts`
- Create: `src/game/machine.test.ts`

**Interfaces:**
- Consumes: `GameState`, `RandomSource`, `createPaidSpin`, `settleActiveSpin`
- Produces: `MachineEvent`, `MachineDependencies`, `transitionMachine(state, event, deps)`, `recoverInterruptedSpin(state)`

- [ ] **Step 1: Write failing transition tests**

Create `src/game/machine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createInitialState } from "../domain/types";
import { recoverInterruptedSpin, transitionMachine } from "./machine";

const deps = {
  rng: { next: () => 0.70 },
  now: () => new Date("2026-08-26T12:00:00Z"),
  createId: () => "spin-1",
};

describe("slot machine transitions", () => {
  it("moves through paid insert, pull, highlight, payout, and settlement", () => {
    const start = createInitialState();
    start.wallet = 3;
    const inserted = transitionMachine(start, { type: "INSERT_COIN" }, deps);
    const spinning = transitionMachine(inserted, { type: "PULL_LEVER" }, deps);
    const highlight = transitionMachine(spinning, { type: "SPIN_ANIMATION_DONE" }, deps);
    const payout = transitionMachine(highlight, { type: "HIGHLIGHT_DONE" }, deps);
    const settled = transitionMachine(payout, { type: "PAYOUT_DONE" }, deps);
    expect(inserted.activeSpin?.stage).toBe("coin-inserted");
    expect(spinning.activeSpin?.stage).toBe("spinning");
    expect(highlight.activeSpin?.stage).toBe("highlight");
    expect(payout.activeSpin?.stage).toBe("payout");
    expect(settled.activeSpin?.stage).toBe("settled");
    expect(settled.wallet).toBe(7);
  });

  it("keeps an inserted spin ready after refresh", () => {
    const start = createInitialState();
    start.wallet = 1;
    const inserted = transitionMachine(start, { type: "INSERT_COIN" }, deps);
    expect(recoverInterruptedSpin(inserted).activeSpin?.stage).toBe("coin-inserted");
  });

  it("settles an animation-stage spin once during recovery", () => {
    const start = createInitialState();
    start.wallet = 1;
    const inserted = transitionMachine(start, { type: "INSERT_COIN" }, deps);
    const spinning = transitionMachine(inserted, { type: "PULL_LEVER" }, deps);
    const recovered = recoverInterruptedSpin(spinning);
    const recoveredAgain = recoverInterruptedSpin(recovered);
    expect(recovered.activeSpin?.stage).toBe("settled");
    expect(recoveredAgain.wallet).toBe(recovered.wallet);
  });

  it("ignores pull and animation events in invalid stages", () => {
    const state = createInitialState();
    expect(transitionMachine(state, { type: "PULL_LEVER" }, deps)).toEqual(state);
    expect(transitionMachine(state, { type: "PAYOUT_DONE" }, deps)).toEqual(state);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test:run -- src/game/machine.test.ts`

Expected: FAIL because the machine module does not exist.

- [ ] **Step 3: Implement explicit state transitions**

Create `src/game/machine.ts` with this event union:

```ts
export type MachineEvent =
  | { type: "INSERT_COIN" }
  | { type: "PULL_LEVER" }
  | { type: "SPIN_ANIMATION_DONE" }
  | { type: "HIGHLIGHT_DONE" }
  | { type: "PAYOUT_DONE" }
  | { type: "CLEAR_SETTLED_SPIN" };
```

`MachineDependencies` contains `rng`, `now`, `createId`, and optional `consumeOutcomeOverride(): OutcomeKind | null`. `INSERT_COIN` calls `consumeOutcomeOverride` once and passes the result to `createPaidSpin`; all other events only mutate the expected stage. `PAYOUT_DONE` calls `settleActiveSpin` and must persist reward application before visual cleanup. `CLEAR_SETTLED_SPIN` sets `activeSpin` to null only from `settled`. `recoverInterruptedSpin` returns `coin-inserted` unchanged, settles `spinning`/`highlight`/`payout`, and leaves `settled` unchanged.

- [ ] **Step 4: Verify state-machine behavior**

Run:

```bash
npm run test:run -- src/game/machine.test.ts
npm run test:run -- src/game/outcomes.test.ts src/inventory/inventory.test.ts
npm run typecheck
```

Expected: all selected tests pass and typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/game/machine.ts src/game/machine.test.ts
git commit -m "feat: add recoverable slot state machine"
```

### Task 7: Add Validated Persistence and a Single-Writer Browser Lock

**Files:**
- Create: `src/storage/schema.ts`
- Create: `src/storage/repository.ts`
- Create: `src/storage/repository.test.ts`
- Create: `src/storage/writer-lock.ts`
- Create: `src/storage/writer-lock.test.ts`

**Interfaces:**
- Consumes: `GameState`, `createInitialState`, all domain unions
- Produces: `GameStateSchema`, `StateRepository`, `RevisionConflictError`, `StorageWriteError`, `acquireWriterLock(onMode)`

- [ ] **Step 1: Write failing repository tests**

Create `src/storage/repository.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createInitialState } from "../domain/types";
import { RevisionConflictError, StateRepository } from "./repository";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

describe("StateRepository", () => {
  it("round-trips one validated state snapshot", () => {
    const storage = new MemoryStorage();
    const repo = new StateRepository(storage);
    const state = createInitialState();
    state.wallet = 7;
    const saved = repo.save(state, 0);
    expect(saved.revision).toBe(1);
    expect(repo.load().wallet).toBe(7);
  });

  it("rejects a stale expected revision", () => {
    const repo = new StateRepository(new MemoryStorage());
    repo.save(createInitialState(), 0);
    expect(() => repo.save(createInitialState(), 0)).toThrow(RevisionConflictError);
  });

  it("backs up invalid JSON and recovers safe defaults", () => {
    const storage = new MemoryStorage();
    storage.setItem("dsh-slot-state", "not-json");
    const repo = new StateRepository(storage, () => "2026-08-26T12:00:00.000Z");
    expect(repo.load()).toEqual(createInitialState());
    expect(storage.getItem("dsh-slot-corrupt-2026-08-26T12:00:00.000Z")).toBe("not-json");
  });
});
```

- [ ] **Step 2: Write the failing writer-lock test**

Create `src/storage/writer-lock.test.ts` using a fake lock manager:

```ts
import { describe, expect, it, vi } from "vitest";
import { acquireWriterLock } from "./writer-lock";

describe("writer lock", () => {
  it("reports readonly when the exclusive lock is unavailable", async () => {
    const request = vi.fn(async (_name, _options, callback) => callback(null));
    const release = await acquireWriterLock({ request }, () => undefined);
    expect(release.mode).toBe("readonly");
  });
});
```

- [ ] **Step 3: Run persistence tests and verify failure**

Run: `npm run test:run -- src/storage`

Expected: FAIL because persistence modules do not exist.

- [ ] **Step 4: Implement the Zod schema and repository**

In `src/storage/schema.ts`, define Zod schemas for every union and nested record in `GameState`; require literal `schemaVersion: 1`, nonnegative finite integers, valid spin stages, unique string arrays, `wallet >= 0`, daily `workCoins <= 25`, and `focusCoins <= 16`. Export `parseGameState(input): GameState`.

In `src/storage/repository.ts`:

```ts
export const STATE_KEY = "dsh-slot-state";
export class RevisionConflictError extends Error {}
export class StorageWriteError extends Error {}

export class StateRepository {
  constructor(private storage: Storage, private nowIso = () => new Date().toISOString()) {}
  load(): GameState;
  save(next: GameState, expectedRevision: number): GameState;
}
```

`save` must read and validate the current snapshot, compare its revision to `expectedRevision`, validate `{ ...next, revision: expectedRevision + 1 }`, and call one synchronous `setItem`. Convert quota/write exceptions to `StorageWriteError`. `load` must back up invalid raw bytes under `dsh-slot-corrupt-${nowIso()}` before returning `createInitialState()`.

- [ ] **Step 5: Implement the Web Locks single-writer lease**

Create `src/storage/writer-lock.ts`:

```ts
type LockManagerLike = {
  request<T>(
    name: string,
    options: { mode: "exclusive"; ifAvailable: true },
    callback: (lock: object | null) => Promise<T> | T,
  ): Promise<T>;
};

export async function acquireWriterLock(
  locks: LockManagerLike | undefined,
  onMode: (mode: "writer" | "readonly" | "unsupported") => void,
) {
  if (!locks) {
    onMode("unsupported");
    return { mode: "unsupported" as const, release: () => undefined };
  }
  let releaseHold!: () => void;
  const hold = new Promise<void>((resolve) => { releaseHold = resolve; });
  let reportEntered!: (mode: "writer" | "readonly") => void;
  const entered = new Promise<"writer" | "readonly">((resolve) => { reportEntered = resolve; });
  const requestPromise = locks.request("dsh-slot-economy", { mode: "exclusive", ifAvailable: true }, async (lock) => {
    const mode = lock ? "writer" : "readonly";
    onMode(mode);
    reportEntered(mode);
    if (lock) await hold;
  });
  const mode = await entered;
  return {
    mode,
    release: () => {
      releaseHold();
      void requestPromise;
    },
  };
}
```

- [ ] **Step 6: Verify storage and lock behavior**

Run:

```bash
npm run test:run -- src/storage
npm run typecheck
```

Expected: all storage tests pass and typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/storage
git commit -m "feat: add validated single-writer persistence"
```

### Task 8: Build Mock DSH Events, the Demo Panel, and the Controller

**Files:**
- Create: `src/dsh/adapter.ts`
- Create: `src/dsh/mock-adapter.ts`
- Create: `src/dsh/mock-adapter.test.ts`
- Create: `src/app/use-game-controller.ts`
- Create: `src/app/use-game-controller.test.tsx`
- Create: `src/components/DemoPanel.tsx`
- Create: `src/components/DemoPanel.test.tsx`

**Interfaces:**
- Consumes: `DshEvent`, `GameState`, work reward functions, machine transitions, `StateRepository`, `Clock`
- Produces: `DshAdapter`, `MockDshAdapter`, `useGameController(deps)`, `DemoPanel`

- [ ] **Step 1: Write failing mock-adapter tests**

Create `src/dsh/mock-adapter.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { FixedClock } from "../time/clock";
import { MockDshAdapter } from "./mock-adapter";

describe("MockDshAdapter", () => {
  it("emits task, verification, focus, and status events with unique IDs", () => {
    const adapter = new MockDshAdapter(new FixedClock(new Date("2026-08-26T08:00:00Z")), () => crypto.randomUUID());
    const listener = vi.fn();
    adapter.subscribe(listener);
    const taskId = adapter.completeTask();
    adapter.verifyTask(taskId);
    adapter.addFocusHour();
    adapter.setAgentStatus("error");
    expect(listener.mock.calls.map(([event]) => event.type)).toEqual([
      "task.completed", "task.verified", "focus.minutes", "agent.status",
    ]);
    expect(new Set(listener.mock.calls.map(([event]) => event.id)).size).toBe(4);
  });
});
```

- [ ] **Step 2: Write failing controller and panel tests**

Create `src/components/DemoPanel.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DemoPanel } from "./DemoPanel";

it("emits one sixty-minute focus action", async () => {
  const onAddFocusHour = vi.fn();
  render(<DemoPanel open onClose={() => undefined} onCompleteTask={() => "task-1"} onVerifyTask={() => undefined} onAddFocusHour={onAddFocusHour} onSetStatus={() => undefined} onAdvanceDay={() => undefined} onReset={() => undefined} stateSummary="0 枚" />);
  await userEvent.click(screen.getByRole("button", { name: "增加 60 分钟有效专注" }));
  expect(onAddFocusHour).toHaveBeenCalledOnce();
});
```

Create `src/app/use-game-controller.test.tsx`:

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MockDshAdapter } from "../dsh/mock-adapter";
import { StateRepository } from "../storage/repository";
import { FixedClock } from "../time/clock";
import { useGameController } from "./use-game-controller";

describe("useGameController", () => {
  beforeEach(() => localStorage.clear());

  it("applies work events and persists a paid spin", async () => {
    let id = 0;
    const clock = new FixedClock(new Date("2026-08-26T08:00:00Z"));
    const adapter = new MockDshAdapter(clock, () => `id-${id++}`);
    const repository = new StateRepository(localStorage);
    const { result } = renderHook(() => useGameController({
      repository, adapter, clock, rng: { next: () => 0.70 }, createId: () => "spin-1", mode: "writer",
    }));
    await waitFor(() => expect(result.current.state.wallet).toBe(3));
    act(() => { adapter.completeTask(); });
    await waitFor(() => expect(result.current.state.wallet).toBe(4));
    act(() => { result.current.insertCoin(); });
    expect(result.current.state.wallet).toBe(3);
    expect(result.current.state.activeSpin?.stage).toBe("coin-inserted");
    expect(repository.load().activeSpin?.id).toBe("spin-1");
  });

  it("does not mutate economy in readonly mode", () => {
    const clock = new FixedClock(new Date("2026-08-26T08:00:00Z"));
    const adapter = new MockDshAdapter(clock, () => "event-1");
    const { result } = renderHook(() => useGameController({
      repository: new StateRepository(localStorage), adapter, clock, rng: { next: () => 0 }, createId: () => "spin-1", mode: "readonly",
    }));
    act(() => { result.current.insertCoin(); });
    expect(result.current.state.activeSpin).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests and verify failure**

Run: `npm run test:run -- src/dsh src/components/DemoPanel.test.tsx src/app/use-game-controller.test.tsx`

Expected: FAIL because adapter, panel, and controller do not exist.

- [ ] **Step 4: Implement adapter interfaces and deterministic demo actions**

Create `src/dsh/adapter.ts`:

```ts
export interface DshAdapter {
  subscribe(listener: (event: DshEvent) => void): () => void;
}
```

`MockDshAdapter` stores listeners in a `Set`, returns the generated `taskId` from `completeTask`, emits exactly 60 minutes from `addFocusHour`, changes only the injected `FixedClock` in `advanceDay`, and exposes `presetNextOutcome(outcome)` plus one-shot `consumeNextOutcome()` only when `import.meta.env.DEV` is true. `consumeNextOutcome()` clears the stored value after returning it.

- [ ] **Step 5: Implement controller transaction boundaries**

`useGameController` must:

- load and recover persisted state once;
- apply `applyDailyOpen` only in writer mode;
- subscribe to the adapter and persist every reward-state transition using the current revision;
- expose `insertCoin`, `pullLever`, `advanceAnimation`, `buy`, `setDisplayed`, `setSettings`, and panel open/close state;
- reject economic commands unless writer mode is `writer`;
- catch `RevisionConflictError`, reload once, and require the user to repeat the action rather than silently replaying it;
- catch `StorageWriteError`, retain the previous state and disable further economic commands;
- listen for `storage` events in readonly mode and refresh the mirror.
- persist `recoverInterruptedSpin` immediately after load when recovery changes the state;
- expose a daily recheck used after the mock clock advances, plus a writer-only reset used only after the panel's confirmation.

Return this exact public shape:

```ts
interface GameControllerDependencies {
  repository: StateRepository;
  adapter: DshAdapter;
  clock: Clock;
  rng: RandomSource;
  createId(): string;
  consumeOutcomeOverride?(): OutcomeKind | null;
  mode: "writer" | "readonly" | "unsupported";
}

interface GameController {
  state: GameState;
  mode: "writer" | "readonly" | "unsupported";
  error: string | null;
  insertCoin(): void;
  pullLever(): void;
  advanceAnimation(event: "SPIN_ANIMATION_DONE" | "HIGHLIGHT_DONE" | "PAYOUT_DONE" | "CLEAR_SETTLED_SPIN"): void;
  buy(id: string): void;
  setDisplayed(id: string, displayed: boolean): void;
  setSettings(patch: Partial<GameState["settings"]>): void;
  refreshForCurrentDate(): void;
  resetPrototype(): void;
}

export function useGameController(deps: GameControllerDependencies): GameController;
```

- [ ] **Step 6: Implement the collapsible demo panel**

Render buttons with exact accessible names: `完成一个任务`, `验证最近任务`, `增加 60 分钟有效专注`, `状态：空闲`, `状态：工作中`, `状态：完成`, `状态：报错`, `进入下一天`, and `重置原型存档`. `进入下一天` must call `MockDshAdapter.advanceDay()` and then `controller.refreshForCurrentDate()`. Require a second confirmation dialog before `controller.resetPrototype()`. Show wallet, daily work coins out of 25, focus coins out of 16, focus minutes, pity misses, last event, and writer mode.

- [ ] **Step 7: Verify the adapter/controller slice**

Run:

```bash
npm run test:run -- src/dsh src/components/DemoPanel.test.tsx src/app/use-game-controller.test.tsx
npm run typecheck
```

Expected: all selected tests pass and typecheck exits 0.

- [ ] **Step 8: Commit**

```bash
git add src/dsh src/app/use-game-controller.ts src/app/use-game-controller.test.tsx src/components/DemoPanel.tsx src/components/DemoPanel.test.tsx
git commit -m "feat: add mock DSH controls and game controller"
```

### Task 9: Produce Pixel Assets and Implement the Canvas Renderer

**Files:**
- Create: `public/assets/scene-base.png`
- Create: `public/assets/reel-symbols.png`
- Create: `public/assets/collectibles.png`
- Create: `src/game/renderer/assets.ts`
- Create: `src/game/renderer/assets.test.ts`
- Create: `src/game/renderer/animation.ts`
- Create: `src/game/renderer/animation.test.ts`
- Create: `src/game/renderer/scene-renderer.ts`
- Create: `src/game/renderer/scene-renderer.test.ts`

**Interfaces:**
- Consumes: `GameState`, `ResolvedSpin`, `COLLECTIBLES`, Canvas 2D API
- Produces: `loadSceneAssets()`, `ASSET_FRAMES`, `animationFrameFor(state, elapsedMs)`, `SceneRenderer.render(viewModel)`

- [ ] **Step 1: Write failing asset-manifest and renderer tests**

Create `src/game/renderer/assets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ASSET_FRAMES } from "./assets";

it("maps five reel symbols and twelve collectibles to fixed atlas cells", () => {
  expect(Object.keys(ASSET_FRAMES.reels)).toHaveLength(5);
  expect(Object.keys(ASSET_FRAMES.collectibles)).toHaveLength(12);
  expect(ASSET_FRAMES.reels.coin).toEqual({ x: 0, y: 0, width: 64, height: 64 });
  expect(ASSET_FRAMES.collectibles.plant).toEqual({ x: 0, y: 0, width: 96, height: 96 });
});
```

Create `src/game/renderer/scene-renderer.test.ts` with a recording context:

```ts
import { describe, expect, it } from "vitest";
import { SceneRenderer } from "./scene-renderer";

it("disables smoothing and draws scene before animated layers", () => {
  const calls: string[] = [];
  const context = {
    imageSmoothingEnabled: true,
    clearRect: () => calls.push("clear"),
    drawImage: (_image: unknown, ...args: unknown[]) => calls.push(args.length === 2 ? "scene" : "sprite"),
    save: () => calls.push("save"), restore: () => calls.push("restore"),
    translate: () => undefined, rotate: () => undefined,
    fillRect: () => calls.push("pixel"), fillStyle: "",
  } as unknown as CanvasRenderingContext2D;
  const renderer = new SceneRenderer(context, { scene: {} as HTMLImageElement, reels: {} as HTMLImageElement, collectibles: {} as HTMLImageElement });
  renderer.render({ reels: ["coin", "leaf", "moon"], reelOffsets: [0, 0, 0], reelStopped: [true, true, true], leverProgress: 0, coins: [], sparkles: [], displayed: [], payoutCollectibleId: null, agentStatus: "idle", starryTheme: false, complete: false });
  expect(context.imageSmoothingEnabled).toBe(false);
  expect(calls[0]).toBe("clear");
  expect(calls).toContain("scene");
});
```

Create `src/game/renderer/animation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { animationFrameFor } from "./animation";

const base = {
  stage: "spinning" as const,
  reels: ["coin", "leaf", "moon"] as const,
  displayed: [] as string[],
  payoutCollectibleId: null,
  starryTheme: false,
  agentStatus: "idle" as const,
  reducedMotion: false,
};

describe("animationFrameFor", () => {
  it("returns the exact lever endpoints", () => {
    expect(animationFrameFor({ ...base, elapsedMs: 160 }).leverProgress).toBe(1);
    expect(animationFrameFor({ ...base, elapsedMs: 320 }).leverProgress).toBe(0);
  });

  it("freezes reels in left, middle, right order", () => {
    expect(animationFrameFor({ ...base, elapsedMs: 1800 }).reelStopped).toEqual([true, false, false]);
    expect(animationFrameFor({ ...base, elapsedMs: 2100 }).reelStopped).toEqual([true, true, false]);
    expect(animationFrameFor({ ...base, elapsedMs: 2400 }).reelStopped).toEqual([true, true, true]);
  });

  it("uses a parabolic coin arc and reduced-motion final frame", () => {
    const payout = animationFrameFor({ ...base, stage: "payout", elapsedMs: 500 });
    expect(payout.coins[0].y).toBeLessThan(payout.coins[0].startY);
    const reduced = animationFrameFor({ ...base, reducedMotion: true, elapsedMs: 700 });
    expect(reduced.complete).toBe(true);
  });
});
```

- [ ] **Step 2: Run renderer tests and verify failure**

Run: `npm run test:run -- src/game/renderer`

Expected: FAIL because renderer modules and assets do not exist.

- [ ] **Step 3: Generate the transparent scene base**

Use the built-in image-generation workflow with this exact production prompt:

```text
Use case: stylized-concept
Asset type: transparent pixel-art game scene base for a desktop widget
Primary request: one self-contained 2.5D pixel-art miniature with a thick walnut work table and a compact metal slot machine. The slot machine front must face the viewer almost straight on; its three empty reel windows are centered and rectangular, while only the top plane and a narrow right side remain visible for depth. Include a deep payout slot, metal feet, a right-side lever mount without the lever handle, and twelve small empty display plinths distributed across foreground, middle ground, and background.
Projection: orthographic elevated frontal three-quarter view; tabletop front edge nearly horizontal; consistent shallow 2:1 isometric depth only on receding surfaces.
Style: warm healing premium indie-game pixel art; hard blocky pixel clusters; deliberate stepped contours; deep navy shadows, walnut brown, amber light, teal rim light; no antialiasing and no smooth 3D finish.
Composition: complete compact silhouette designed for a 384×288 logical canvas; machine dominates the center-right; all plinths remain visible; comfortable transparent padding.
Constraints: actual transparent alpha; no reel symbols, no coins, no collectibles, no text, no labels, no character, no mascot, no UI card, no room background, no watermark, no blur.
```

Create `tmp/assets` and `public/assets`. Copy the selected generated PNG to `tmp/assets/scene-base-source.png`, inspect it, and use ImageMagick nearest-neighbor conversion:

```bash
mkdir -p tmp/assets public/assets
convert tmp/assets/scene-base-source.png -filter point -resize 384x288 -background none -gravity center -extent 384x288 -alpha on public/assets/scene-base.png
identify -format '%wx%h %[channels] %[pixel:p{0,0}] %[pixel:p{383,0}] %[pixel:p{0,287}] %[pixel:p{383,287}]\n' public/assets/scene-base.png
```

Expected: `384x288` and an alpha-capable channel description; all four corner pixels are transparent. Keep the ignored source file for same-session iteration and commit only `scene-base.png`.

- [ ] **Step 4: Generate and assemble the five reel symbols**

Make five built-in image-generation calls, using `scene-base.png` as the style reference every time. Use this shared instruction verbatim for every call:

```text
Asset type: one isolated transparent pixel-art slot-reel symbol.
Style: match the referenced scene's hard block pixel clusters, deep navy outline, amber and teal lighting, strict front view, identical visual scale, and centered square padding.
Constraints: one object only; actual transparent alpha; no text, numbers, labels, border, cast shadow outside the sprite, logo, watermark, extra object, blur, antialiasing, or smooth 3D rendering.
```

Use these five exact primary requests and save paths:

| Primary request | Save as |
|---|---|
| One round amber-gold coin with a simple star embossing | `tmp/assets/reel-coin-source.png` |
| One fresh green leaf with a teal edge highlight | `tmp/assets/reel-leaf-source.png` |
| One cyan luminous faceted crystal | `tmp/assets/reel-crystal-source.png` |
| One golden crescent moon | `tmp/assets/reel-moon-source.png` |
| One tiny inert silver robot figurine | `tmp/assets/reel-robot-source.png` |

Normalize and assemble them with nearest-neighbor processing:

```bash
convert tmp/assets/reel-coin-source.png -filter point -resize 56x56 -background none -gravity center -extent 64x64 tmp/assets/reel-coin.png
convert tmp/assets/reel-leaf-source.png -filter point -resize 56x56 -background none -gravity center -extent 64x64 tmp/assets/reel-leaf.png
convert tmp/assets/reel-crystal-source.png -filter point -resize 56x56 -background none -gravity center -extent 64x64 tmp/assets/reel-crystal.png
convert tmp/assets/reel-moon-source.png -filter point -resize 56x56 -background none -gravity center -extent 64x64 tmp/assets/reel-moon.png
convert tmp/assets/reel-robot-source.png -filter point -resize 56x56 -background none -gravity center -extent 64x64 tmp/assets/reel-robot.png
convert tmp/assets/reel-coin.png tmp/assets/reel-leaf.png tmp/assets/reel-crystal.png tmp/assets/reel-moon.png tmp/assets/reel-robot.png +append public/assets/reel-symbols.png
identify -format '%wx%h %[channels]\n' public/assets/reel-symbols.png
```

Expected: `320x64`; each 64×64 cell contains one recognizable, consistently scaled symbol.

- [ ] **Step 5: Generate the collectible atlas**

Use `scene-base.png` as a style reference and generate one transparent 4×3 atlas with this exact order:

```text
Create a transparent 4-column by 3-row pixel-art collectible sprite atlas matching the referenced walnut, amber, teal, and deep-navy game style. Equal 96×96 cells, one centered isolated object per cell, consistent elevated frontal 2.5D view, scale, grounding, hard pixel clusters, and no antialiasing.
Row 1: small potted plant; book display stand; desktop clock; warm drink mug.
Row 2: miniature toolbox; paper lantern; luminous translucent cyan crystal; glowing crescent moon lamp.
Row 3: small inert silver robot figurine; star projector; constellation globe; comet badge.
No text, labels, cell borders, characters, mascots, logos, watermark, extra objects, or opaque background.
```

Save the selected PNG as `tmp/assets/collectibles-source.png`, then run:

```bash
convert tmp/assets/collectibles-source.png -filter point -resize 384x288 -background none -gravity center -extent 384x288 -alpha on public/assets/collectibles.png
identify -format '%wx%h %[channels]\n' public/assets/collectibles.png
```

Expected: `384x288`; twelve objects occupy the catalog order without clipping. Keep all source images under ignored `tmp/assets` during this session; commit only the three final PNG assets.

- [ ] **Step 6: Implement atlas frames and strict asset loading**

In `src/game/renderer/assets.ts`, map reel cells at x positions `0,64,128,192,256` and collectible cells in catalog order with x positions `0,96,192,288` and y positions `0,96,192`. Export these exact display-slot centers in catalog order:

```ts
export const DISPLAY_SLOTS = [
  { x: 44, y: 214 }, { x: 92, y: 223 }, { x: 144, y: 218 }, { x: 205, y: 224 },
  { x: 42, y: 164 }, { x: 98, y: 174 }, { x: 274, y: 188 }, { x: 330, y: 192 },
  { x: 44, y: 112 }, { x: 100, y: 118 }, { x: 284, y: 125 }, { x: 336, y: 132 },
] as const;
```

`loadSceneAssets` must load all three URLs, reject on any image error, and return `{ scene, reels, collectibles }`.

- [ ] **Step 7: Implement pure animation sampling**

Export the exact input contract below. `animationFrameFor` returns a complete immutable `SceneViewModel` used by `SceneRenderer`:

```ts
export interface AnimationInput {
  stage: "coin-inserted" | "spinning" | "highlight" | "payout" | "settled";
  elapsedMs: number;
  reels: readonly [ReelSymbol, ReelSymbol, ReelSymbol];
  displayed: string[];
  payoutCollectibleId: string | null;
  starryTheme: boolean;
  agentStatus: AgentStatus;
  reducedMotion: boolean;
}
export interface SceneViewModel {
  reels: readonly [ReelSymbol, ReelSymbol, ReelSymbol];
  reelOffsets: readonly [number, number, number];
  reelStopped: readonly [boolean, boolean, boolean];
  leverProgress: number;
  coins: Array<{ x: number; y: number; startY: number; size: number }>;
  sparkles: Array<{ x: number; y: number; frame: number }>;
  displayed: string[];
  payoutCollectibleId: string | null;
  agentStatus: AgentStatus;
  starryTheme: boolean;
  complete: boolean;
}
export function animationFrameFor(input: AnimationInput): SceneViewModel;
```

The sampler must provide:

- lever progress using a triangle curve over 320 ms;
- reel offsets with staggered stops at 1,800/2,100/2,400 ms;
- exact final symbols from `ResolvedSpin.reels`;
- 6–10 coin particles using `y = startY - 4t(1-t) * arcHeight` and linear x interpolation;
- at most six sparkle particles;
- collectible placement moving from payout slot to its fixed display slot;
- reduced-motion direct transitions with no parabolic travel.
- idle moon-lamp glow and plant sway when those items are displayed;
- working-state teal panel sweep and robot indicator;
- completed-state sequential collectible bounce with at most six sparkles;
- error-state robot retreat and crystal dimming, both returning to baseline.

- [ ] **Step 8: Implement the renderer draw order**

`SceneRenderer.render` must execute this order: clear → optional starry desktop pixels → base scene → reel symbols clipped to three windows → lever built from integer-coordinate pixel rectangles → displayed collectibles from atlas → payout collectible → coins → sparkles → agent-status lighting. Never call `scale` with a noninteger value and set `imageSmoothingEnabled = false` in the constructor and before every render.

- [ ] **Step 9: Verify renderer and assets**

Run:

```bash
npm run test:run -- src/game/renderer
npm run typecheck
identify -format '%f %wx%h %[channels]\n' public/assets/scene-base.png public/assets/reel-symbols.png public/assets/collectibles.png
```

Expected: renderer tests pass; dimensions are `384x288`, `320x64`, and `384x288`; all three images report alpha-capable channels.

- [ ] **Step 10: Commit**

```bash
git add public/assets src/game/renderer
git commit -m "feat: add frontal pixel scene renderer"
```

### Task 10: Integrate the Accessible Desktop UI, Shop, Collection, and Sound

**Files:**
- Modify: `src/app/App.tsx`
- Create: `src/components/GameCanvas.tsx`
- Create: `src/components/GameCanvas.test.tsx`
- Create: `src/components/CollectionPanel.tsx`
- Create: `src/components/CollectionPanel.test.tsx`
- Create: `src/components/ShopPanel.tsx`
- Create: `src/components/ShopPanel.test.tsx`
- Create: `src/components/SettingsPanel.tsx`
- Create: `src/audio/sfx.ts`
- Modify: `src/styles/global.css`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `GameController`, renderer assets, animation sampler, catalog and inventory functions
- Produces: complete visible prototype with accessible coin/lever controls, collection/shop/settings panels, responsive desktop positioning, and optional sound

- [ ] **Step 1: Write failing UI interaction tests**

Create `src/components/GameCanvas.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameCanvas } from "./GameCanvas";

it("exposes keyboard-operable coin and lever controls over the canvas", async () => {
  const onInsertCoin = vi.fn();
  const onPullLever = vi.fn();
  render(<GameCanvas state={{ wallet: 1, activeSpin: null } as never} mode="writer" onInsertCoin={onInsertCoin} onPullLever={onPullLever} onAnimationEvent={() => undefined} />);
  await userEvent.click(screen.getByRole("button", { name: "投入 1 枚硬币" }));
  expect(onInsertCoin).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "拉动老虎机摇杆" })).toBeInTheDocument();
});
```

Create `src/components/ShopPanel.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createInitialState } from "../domain/types";
import { ShopPanel } from "./ShopPanel";

it("buys an affordable unowned common item and disables owned items", async () => {
  const state = createInitialState();
  state.wallet = 6;
  const onBuy = vi.fn();
  const { rerender } = render(<ShopPanel open state={state} onClose={() => undefined} onBuy={onBuy} />);
  expect(screen.getByTestId("shop-price-plant")).toHaveTextContent("6 枚");
  await userEvent.click(screen.getByRole("button", { name: "购买 小盆栽" }));
  expect(onBuy).toHaveBeenCalledWith("plant");
  state.ownedCollectibles = ["plant"];
  rerender(<ShopPanel open state={state} onClose={() => undefined} onBuy={onBuy} />);
  expect(screen.getByRole("button", { name: "已拥有 小盆栽" })).toBeDisabled();
});
```

Create `src/components/CollectionPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { createInitialState } from "../domain/types";
import { CollectionPanel } from "./CollectionPanel";

it("shows display controls and starry set progress", () => {
  const state = createInitialState();
  state.ownedCollectibles = ["plant"];
  render(<CollectionPanel open state={state} onClose={() => undefined} onSetDisplayed={() => undefined} />);
  expect(screen.getByRole("button", { name: "展示 小盆栽" })).toBeInTheDocument();
  expect(screen.getByText("星夜观测 0 / 3")).toBeInTheDocument();
});
```

Update `src/app/App.test.tsx` to render `<App />` and assert the desktop contains the wallet status, buttons `打开演示控制台`, `打开收藏柜`, and `打开设置`, plus a canvas with fallback text `DSH 像素老虎机场景`.

Add this failure-mode case to `GameCanvas.test.tsx`:

```tsx
it("keeps controls available when image assets fail", async () => {
  render(<GameCanvas state={{ wallet: 1, activeSpin: null } as never} mode="writer" onInsertCoin={() => undefined} onPullLever={() => undefined} onAnimationEvent={() => undefined} loadAssets={() => Promise.reject(new Error("asset failure"))} />);
  expect(await screen.findByText("像素资源加载失败，已启用简化场景")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "投入 1 枚硬币" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run UI tests and verify failure**

Run: `npm run test:run -- src/components src/app/App.test.tsx`

Expected: FAIL because integrated UI components do not exist.

- [ ] **Step 3: Implement `GameCanvas` with DOM interaction overlays**

Export `GameCanvasProps` with `state`, `mode`, `onInsertCoin`, `onPullLever`, `onAnimationEvent`, and optional `loadAssets` defaulting to `loadSceneAssets`. Render a `<canvas width={384} height={288}>` and transparent absolutely positioned `<button>` elements for the coin slot and right-side lever. The coin button is disabled when wallet is zero, an active spin exists, or mode is not `writer`. The lever is enabled only for `activeSpin.stage === "coin-inserted"`; support pointer click, Enter, Space, and downward pointer drag of at least 24 CSS pixels.

Use `requestAnimationFrame` to sample `animationFrameFor`, call the controller transition exactly once at each phase boundary, and cancel the frame on unmount. Render a live-region message for insufficient balance, readonly mode, storage errors, and rewards.

When asset loading rejects, draw a deterministic fallback scene using integer-coordinate navy, walnut, amber, and teal rectangles: one thick table, one front-facing machine body, three reel windows, one payout slot, and one right-side lever. Keep the same DOM interaction overlays and economic behavior.

- [ ] **Step 4: Implement collection, shop, and settings panels**

`CollectionPanel` lists all twelve items in catalog order, masks unowned art, shows rarity and cosmetic effect, exposes `展示 <name>` / `收起 <name>`, and shows starry set progress. `ShopPanel` lists the fixed price and disables owned or unaffordable items. `SettingsPanel` exposes checkboxes named `静音` and `减少动态效果`, plus scale buttons `1 倍` and `2 倍`; hide 2× when it would exceed the viewport.

- [ ] **Step 5: Add short default-muted Web Audio cues**

Create `src/audio/sfx.ts` with `playSfx(kind, muted)` for `coin`, `lever`, `reel-stop`, `payout`, and `rare`. Use one `AudioContext`, one oscillator and gain envelope per cue, durations below 180 ms, and return immediately when muted or reduced motion is enabled. Do not load external audio files.

- [ ] **Step 6: Compose the desktop application**

`App` creates the repository, system clock, mock adapter, writer lock, renderer assets, and controller. Place the 384×288 widget at `right: 24px; bottom: 20px`. Keep the demo panel collapsed on the left. Add three small pixel buttons near the widget for collection, shop, and settings; they disappear when their panel closes and never form a card behind the scene.

Use these CSS requirements:

```css
.slot-widget { position: fixed; right: 24px; bottom: 20px; width: 384px; height: 288px; }
.slot-widget canvas { width: 384px; height: 288px; image-rendering: pixelated; }
@media (max-width: 1100px) { .slot-widget { right: 12px; bottom: 12px; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 1ms !important; } }
```

The background uses deep navy gradients and restrained desktop texture; the widget itself has no opaque card backing. Apply a subtle star field only when `hasStarryNightTheme(state)` is true.

- [ ] **Step 7: Verify integrated UI**

Run:

```bash
npm run test:run -- src/components src/app
npm run typecheck
npm run build
```

Expected: all UI tests pass; typecheck and build exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/app src/components src/audio src/styles/global.css
git commit -m "feat: integrate accessible desktop widget UI"
```

### Task 11: Add End-to-End Coverage, Documentation, and the Deliverable Archive

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/app-flow.spec.ts`
- Create: `tests/visual.spec.ts`
- Create: `README.md`
- Create: `tests/visual.spec.ts-snapshots/*` through Playwright only

**Interfaces:**
- Consumes: the complete application and its development-only outcome preset
- Produces: reproducible browser verification, visual baselines, operating instructions, and `dsh-desktop-slot-widget-prototype.zip`

- [ ] **Step 1: Add Playwright configuration and write the failing flow test**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: { baseURL: "http://127.0.0.1:4173", colorScheme: "dark", reducedMotion: "reduce" },
  webServer: { command: "npm run dev -- --host 127.0.0.1 --port 4173", url: "http://127.0.0.1:4173", reuseExistingServer: true },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

Create `tests/app-flow.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("work rewards fund a spin that displays a collectible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("wallet-count")).toHaveText("3");
  await page.getByRole("button", { name: "打开演示控制台" }).click();
  await page.getByRole("button", { name: "完成一个任务" }).click();
  await page.getByRole("button", { name: "增加 60 分钟有效专注" }).click();
  await expect(page.getByTestId("wallet-count")).toHaveText("6");
  await page.getByLabel("预设下次结果").selectOption("common");
  await page.getByRole("button", { name: "投入 1 枚硬币" }).click();
  await page.getByRole("button", { name: "拉动老虎机摇杆" }).click();
  await expect(page.getByTestId("displayed-plant")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("wallet-count")).toHaveText("5");
  await expect(page.getByTestId("displayed-plant")).toBeVisible();
});
```

- [ ] **Step 2: Run the flow test and verify the red state**

Run: `npm run test:e2e -- tests/app-flow.spec.ts`

Expected: FAIL until the development-only result selector and stable test IDs are wired into the demo panel and scene.

- [ ] **Step 3: Wire deterministic E2E controls without production leakage**

In development only, add `<select aria-label="预设下次结果">` with values `auto`, `none`, `refund`, `five-coins`, `common`, `rare`, `set`, and `robot-jackpot`. Route the selection to the mock adapter and consume it exactly once in `createPaidSpin`; the `common` preset resolves the first unowned common item in catalog order, which is `plant` in a fresh state. Omit the selector from production builds. Add `data-testid="wallet-count"` to the numeric wallet value and `data-testid="displayed-${id}"` to each drawn collectible's hidden DOM accessibility node.

- [ ] **Step 4: Add three-viewport visual tests**

Create `tests/visual.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1440, height: 900, name: "1440x900" },
  { width: 1280, height: 720, name: "1280x720" },
  { width: 1024, height: 768, name: "1024x768" },
]) {
  test(`desktop widget ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("application", { name: "DSH 桌面老虎机" })).toHaveScreenshot(`desktop-${viewport.name}.png`, { animations: "disabled" });
  });
}
```

Generate baselines once with `npm run test:e2e -- tests/visual.spec.ts --update-snapshots`, open all three images, and confirm: front-facing machine, visible top/right thickness, no cropping, lower-right anchor, transparent scene silhouette, crisp pixel clusters, and no permanent card backing.

- [ ] **Step 5: Write the README**

`README.md` must contain:

- requirement: Node.js 20+ and a modern Chromium browser with Web Locks;
- commands: `npm install`, `npm run dev`, `npm run test:run`, `npm run test:e2e`, `npm run build`;
- the approved work reward table, slot probabilities, pity, prices, and duplicate conversions;
- explanation of writer versus readonly tabs;
- explanation that local time manipulation cannot be fully prevented;
- mock DSH controls and the exact `DshAdapter` event contract;
- future integration instruction: replace only `MockDshAdapter`;
- explicit statement that rewards are cosmetic and have no cash or DSH capability value.

- [ ] **Step 6: Run full verification**

Run:

```bash
npm run test:run
npm run typecheck
npm run build
npm run test:e2e
git diff --check
git status --short
```

Expected: all unit/component tests pass; typecheck and build exit 0; four Playwright tests pass; `git diff --check` prints nothing; only intended README, Playwright, snapshot, and test files remain uncommitted.

- [ ] **Step 7: Commit the verified prototype**

```bash
git add README.md playwright.config.ts tests src package.json package-lock.json public
git commit -m "test: verify complete desktop slot prototype"
git status --short
```

Expected: clean status after commit.

- [ ] **Step 8: Create the source archive**

Run:

```bash
git archive --format=zip --output ../dsh-desktop-slot-widget-prototype.zip HEAD
unzip -t ../dsh-desktop-slot-widget-prototype.zip
```

Expected: archive integrity check ends with `No errors detected`.
