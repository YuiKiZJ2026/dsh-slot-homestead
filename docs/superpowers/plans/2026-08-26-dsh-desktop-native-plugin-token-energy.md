# DSH Desktop 原生老虎机与 Token 能量 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有浏览器老虎机原型交付为可安装的 DSH Desktop 2.x bundle，并实现每日赠币之外、由真实 DSH usage 驱动的 Token 能量奖励。

**Architecture:** Host face 是钱包、日期、Token receipt、spin 与收藏状态的唯一写入者；它订阅 DSH session events、通过一个串行队列做一次 `storageDomain.global.set()` 原子提交，并暴露两个 exact HTTP route。Client face 只注册 `conversation.view`、读取 Host 投影、发送幂等命令和播放动画；本地 preview 使用单独的 in-memory API，不进入生产 tgz。

**Tech Stack:** TypeScript 5.9、React 19（构建时 externalize 到 DSH shell React）、Vite/Rollup、Vitest、Playwright、Zod、DSH `0.1.1-rc.2` public Host/Client contracts。

**Spec:** `docs/superpowers/specs/2026-08-26-dsh-desktop-native-plugin-design.md`

## Global Constraints

- 目标为 DSH Desktop 2.x、DeepSeek Harness 精确 `0.1.1-rc.2` package set；Desktop 固定提交为 `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`。
- 每日首次打开仍发 3 枚；Token 奖励是附加奖励，不叫“任务完成证明”。
- `effective = output + floor(input*0.10) + floor(cacheWrite*0.10) + floor(cacheRead*0.02)`；`reasoningTokens` 不重复相加。
- 每个符合资格的 turn 最多计 3,000、最多发 1 枚；不足余量跨 turn/日期保留；Token 每日最多 8 枚，并计入每日 25 枚 work reward 总上限。
- 只统计 `source.kind === 'user'` 触发、`session.header.parentSession === undefined` 且 `session.header.delegationDepth ?? 0 === 0`、最终 `turn/end.reason.kind === 'completed'` 的 turn；缺 usage、interrupted assistant、子代理、synthetic、失败/中断/限额 turn 均不计。
- usage receipt、progress、daily ledger、wallet 与 revision 必须在一次 `global.set()` 中原子提交；封顶后的当日 usage 不积攒。
- 生产 Client 不得 import 或打包 `MockDshAdapter`、`DemoPanel`、`FixedClock`、`StateRepository(localStorage)`、Web Locks 或 Vite standalone bootstrap。
- 三列窗口保持左 `22×37`、中 `22×37`、右 `21×37`；每列 clip；旋转图案带排除该列最终符号，停止前不得重复铺最终图案。
- Client bundle 必须是 `window.__ModuleLoader__.load({ id, factory })` lazy-CJS；PNG 和 CSS 内联；Host/Client peer dependencies externalize。
- Node engine 与 README 固定为 `^22.22.2 || >=24.15.0`；包版本 `0.2.0`；许可为 ISC 且必须带 `LICENSE`。

---

### Task 1: Token 能量领域状态、权重与幂等

**Files:**
- Create: `src/plugin/shared/contracts.ts`
- Create: `src/plugin/shared/contracts.test.ts`
- Create: `src/plugin/host/token-energy.ts`
- Create: `src/plugin/host/token-energy.test.ts`

**Interfaces:**
- Produces: `HostState`, `PublicSnapshot`, `ReportedTokenUsage`, `EligibleTurnUsage`, `weightedTokenUsage(usage)`, `applyEligibleTurnUsage(state, event, localDate)`。
- `TokenEnergyState` 固定为 `{ progress: number; dailyCoins: Record<string, number> }`；progress 永远为 `0..2999`。
- `EligibleTurnUsage` 固定携带 `sessionId`、`turn`、非空 `usageKeys`、各 step usage 与 `occurredAt`；资格判定不在经济函数里猜测。

- [ ] **Step 1: 写 Token 计算失败测试**

```ts
it('weights disjoint usage and never adds reasoning twice', () => {
  expect(weightedTokenUsage({
    inputTokens: 1_000,
    outputTokens: 2_500,
    cacheWriteTokens: 1_000,
    cacheReadTokens: 5_000,
    reasoningTokens: 2_000,
  })).toBe(2_800)
})
```

- [ ] **Step 2: 运行测试并确认因模块/函数尚不存在而失败**

Run: `node_modules/.bin/vitest run src/plugin/host/token-energy.test.ts`

Expected: FAIL，原因是 `token-energy.ts` 或导出不存在，不是语法错误。

- [ ] **Step 3: 实现最小权重函数和严格 schema**

```ts
export function weightedTokenUsage(usage: ReportedTokenUsage): number {
  return usage.outputTokens
    + Math.floor(usage.inputTokens * 0.10)
    + Math.floor((usage.cacheWriteTokens ?? 0) * 0.10)
    + Math.floor((usage.cacheReadTokens ?? 0) * 0.02)
}
```

所有 token 字段只接受非负安全整数；optional 缺失为 0，整份 usage 缺失不构造 `EligibleTurnUsage`。

- [ ] **Step 4: 写余量、单 turn 封顶、8/25 上限和重复 receipt 的失败测试**

覆盖以下手算结果：`2800 + 200 => +1 coin, progress 0`；`output=10000 => credited 3000, +1 coin`；Token 日账 8 或 work 日账 25 时状态对象保持同一引用；同一 usage key 二次提交钱包不变；两个 key 中任一已处理时整 turn 拒绝，避免部分重放。

- [ ] **Step 5: 实现一次纯状态迁移**

`applyEligibleTurnUsage` 先检查 receipt 与上限，再计算 `credited = Math.min(3000, effective)`，只可能发 0 或 1 枚；返回的新 `HostState` 同时包含新 receipt、progress、daily ledger、wallet 和 `revision + 1`。没有 material change 时返回原对象。

- [ ] **Step 6: 运行领域测试与 mutation check**

Run: `node_modules/.bin/vitest run src/plugin/shared/contracts.test.ts src/plugin/host/token-energy.test.ts`

Expected: PASS。人工将 input 权重改为 `0.20`、删除 receipt 写入或重复加 reasoning 时，至少一个测试必须失败。

- [ ] **Step 7: Commit**

```bash
git add src/plugin/shared src/plugin/host/token-energy.ts src/plugin/host/token-energy.test.ts
git commit -m "feat: add token energy accounting"
```

---

### Task 2: 混合转轮图案带与逐列居中

**Files:**
- Create: `public/assets/reel-symbols-runtime.png`
- Modify: `src/game/renderer/animation.ts`
- Modify: `src/game/renderer/animation.test.ts`
- Modify: `src/game/renderer/scene-renderer.ts`
- Modify: `src/game/renderer/scene-renderer.test.ts`
- Modify: `src/components/GameCanvas.tsx`

**Interfaces:**
- Produces: `SceneViewModel.reelCells`，类型为三个滚筒、每滚筒四个可见 cell 的 `ReelSymbol` 元组。
- `AnimationInput` 新增稳定 `spinId: string | null`；运行带相位只由 `spinId + reelIndex` 决定。
- stopped 列只绘制最终符号；running 列的四个 cell 全部排除该列 final symbol。

- [ ] **Step 1: 写旋转阶段不是最终符号复制品的失败测试**

```ts
it('uses a mixed belt and excludes each final symbol before that reel stops', () => {
  const frame = animationFrameFor(spinningInput({
    spinId: 'spin-42',
    elapsedMs: 1_000,
    reels: ['leaf', 'moon', 'coin'],
  }))
  expect(new Set(frame.reelCells[0]).size).toBeGreaterThan(1)
  expect(frame.reelCells[0]).not.toContain('leaf')
})
```

- [ ] **Step 2: 运行 renderer 测试并确认新断言失败**

Run: `node_modules/.bin/vitest run src/game/renderer/animation.test.ts src/game/renderer/scene-renderer.test.ts`

Expected: FAIL，因为现有 renderer 对每列连续绘制同一最终 symbol。

- [ ] **Step 3: 实现确定性混合图案带**

固定基带为 `coin, leaf, moon, crystal, robot, leaf, coin, crystal, moon, robot`。对每列过滤 final symbol 后，用稳定的字符串 hash 选择相位；`floor(distance / 18)` 选择四个相邻 cell，距离保持单调，不能在 animation model 中 `% 64` 丢失圈数。

同时用 nearest-neighbour 把源图集中五个 `64×64` cell 机械缩放为五个 `18×18` cell，生成 `90×18` 的 `reel-symbols-runtime.png`。renderer 只读取该运行时图集；源图保留用于审计。

- [ ] **Step 4: 更新 SceneRenderer 逐 cell 取 frame/optical offset 并保持 clip**

每个 cell 独立计算 source frame、`symbolX = round(window center - 9 + opticalOffset.x)` 和 y；三列使用各自 `REEL_WINDOWS`。stopped 路径继续用 final symbol 的中心公式。

- [ ] **Step 5: 添加逐列边界和 drawImage source 变化测试**

断言三列均执行 `save → rect(exact window) → clip → drawImage → restore`；运行列至少出现两个不同 source x；任何 draw destination 与 clip 交集外不作为可见像素；leaf 在三列的中心校正一致。

- [ ] **Step 6: 运行 renderer、Canvas 和视觉相关单元测试**

Run: `node_modules/.bin/vitest run src/game/renderer src/components/GameCanvas.test.tsx`

Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add public/assets/reel-symbols-runtime.png src/game/renderer src/components/GameCanvas.tsx src/components/GameCanvas.test.tsx
git commit -m "fix: render mixed centered reel belts"
```

---

### Task 3: DSH Host 权威服务、session usage 归集与 exact routes

**Files:**
- Modify: `src/plugin/shared/contracts.ts`
- Modify: `src/plugin/shared/contracts.test.ts`
- Create: `src/plugin/host/domain.ts`
- Create: `src/plugin/host/serial-queue.ts`
- Create: `src/plugin/host/session-usage.ts`
- Create: `src/plugin/host/session-usage.test.ts`
- Create: `src/plugin/host/game-service.ts`
- Create: `src/plugin/host/game-service.test.ts`
- Create: `src/plugin/host/http.ts`
- Create: `src/plugin/host/http.test.ts`
- Create: `src/plugin/host/index.ts`
- Create: `src/plugin/host/dsh-contracts.d.ts`

**Interfaces:**
- Consumes: Task 1 的 `HostState`、`EligibleTurnUsage`；现有 `createPaidSpin`、库存与设置纯函数。
- Produces: `GameService.getSnapshot(sessionId)`, `GameService.command(request)`, `SessionUsageCollector.accept(session,event)`, DSH Host `apply(ctx)`。
- `command()` 返回 `{ status: 200|409; snapshot; errorCode? }`；同 `commandId + canonical payload` 返回保存的成功结果，不同 payload 返回 `command-id-reused`。
- Command strict union 完整包含 `claimDaily`、`insertCoin`、`pullLever`、`settleSpin`、`buyItem`、`setDisplay`、`updateSettings`。Host 持久 spin 只用 `paid → spinning → cleared-on-settle` 三阶段；Client 的 highlight/payout 是 Task 4 的本地表现，不写回 Host。
- `claimDaily` 使用 Host `SystemClock` 的本地日期：首次或严格晚于 `lastGrantedLocalDate` 时发 3 枚；相同日期幂等；日期倒退返回 `clock-skew` 且不写入。所有物质 command transition 只递增一次 revision。

- [ ] **Step 1: 写 session 资格归集失败测试**

使用完整 event fixtures 验证：`parentSession` 缺失且 `delegationDepth=0` 的 top-level session + `user/message.source.kind='user'` + non-interrupted `assistant/message.usage` + completed turn 产生一个 aggregate；有 `parentSession`、`delegationDepth=1`、source kind 非 user、usage 缺失、assistant interrupted、turn end aborted/max-tokens 均不产生 aggregate；usage key 为 `${session.id}:${assistantEvent.seq}`。

- [ ] **Step 2: 运行并确认 collector 测试失败**

Run: `node_modules/.bin/vitest run src/plugin/host/session-usage.test.ts`

- [ ] **Step 3: 实现按 session/turn 的有界 collector**

只保存当前开放 turn 的 human flag 与成功 assistant usage；收到 `turn/end` 后立即删除临时记录。`adopt(session.events)` 与 live `accept()` 使用同一 reducer；Host 启动时先注册 listener，再扫描 `ctx.sessions.list()`，由 receipt 去重竞态。

同时监听 `agent/status`：按 session 维护 generation 内的活动 Agent 集合，投影 `working | idle`，不写入经济 domain、不递增 revision；disposer 清空该集合并注销 listener。

- [ ] **Step 4: 写 GameService 原子性和命令失败测试**

使用真实 in-memory domain seam，不对 `global.set()` 做行为断言；测试观察结果：存储 reject 时 wallet/revision/receipt 都不变；并发两个 insertCoin 串行；过期 revision 返回 409；相同 commandId 重试不二次扣币；不同 payload 拒绝；settleSpin 重试不二次发奖；`claimDaily` 首次 +3、同日幂等、日期倒退 `clock-skew`；七种 command schema 均拒绝额外字段。

- [ ] **Step 5: 实现串行 GameService**

所有 usage、每日 rollover 与命令进入同一 promise chain。每次从 `domain.global.get()` 读取权威对象，生成一个完整 replacement object，只调用一次 `global.set(next)`；成功后才返回投影。agent status 保存在 `Map<sessionId,...>`，不写 domain、不递增经济 revision。

- [ ] **Step 6: 写 HTTP handler 失败测试并实现安全边界**

GET 仅接受 state path 与 `sessionId`；POST 要求 `application/json`、body ≤ 16 KiB、strict schema、可接受 Host/Origin/Fetch Metadata。错误返回稳定 JSON code；不打印 body。使用 `kind:'exact'` 注册 `/api/dsh-slot-widget/state` 和 `/api/dsh-slot-widget/command`。

- [ ] **Step 7: 接入真实 DSH lifecycle**

```ts
export const inject = ['sessions', 'storageDomain', 'webServer']

export async function apply(ctx: Context): Promise<void> {
  const domain = await ctx.storageDomain.open(gameDomainSpec)
  try {
    ctx.effect(() => {
      const service = new GameService(domain)
      const offEvent = ctx.on('session/event', (session, event) => service.acceptSessionEvent(session, event))
      const offState = ctx.webServer.register(stateRoute(service))
      const offCommand = ctx.webServer.register(commandRoute(service))
      return async () => { offEvent(); offState(); offCommand(); await domain.close() }
    }, 'dsh-slot-widget host')
  } catch (error) {
    await domain.close()
    throw error
  }
}
```

`gameDomainSpec` 必须由 `defineDomain({ name:'dsh_slot_widget', version:1, global:{ schema, initial }, tables:{} })` 静态创建；缺 backend/invalid storage 时启动失败并给出诊断，不回退 localStorage。

- [ ] **Step 8: 运行 Host 契约测试**

Run: `node_modules/.bin/vitest run src/plugin/host`

Expected: PASS，无 unhandled rejection。

- [ ] **Step 9: Commit**

```bash
git add src/plugin/host
git commit -m "feat: add authoritative DSH host service"
```

---

### Task 4: DSH Client 会话视图、Host 同步与 Token 能量 UI

**Files:**
- Create: `src/plugin/client/api.ts`
- Create: `src/plugin/client/api.test.ts`
- Create: `src/plugin/client/use-host-game-controller.ts`
- Create: `src/plugin/client/use-host-game-controller.test.tsx`
- Create: `src/plugin/client/TokenEnergyMeter.tsx`
- Create: `src/plugin/client/TokenEnergyMeter.test.tsx`
- Create: `src/plugin/client/PluginApp.tsx`
- Create: `src/plugin/client/PluginApp.test.tsx`
- Create: `src/plugin/client/index.tsx`
- Create: `src/plugin/client/style.ts`
- Create: `src/plugin/client/style.test.ts`
- Create: `src/plugin/client/dsh-contracts.d.ts`
- Create: `src/plugin/preview/InMemoryGameApi.ts`
- Create: `src/plugin/preview/main.tsx`
- Create: `native-preview.html`
- Modify: `src/game/renderer/assets.ts`
- Modify: `src/components/GameCanvas.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: Task 3 的 `PublicSnapshot` 与 command DTO。
- Produces: `GameApi`, `HttpGameApi`, `useHostGameController`, `TokenEnergyMeter`, `PluginApp`, Client `apply(ctx)`。
- Client view component props 使用官方 `ConvViewProps` 的 `sessionId`；不从 URL 或 DOM 猜 session id。
- `useHostGameController` 维护唯一允许的 Client-local 状态：Host `pendingSpin` 的五阶段视觉投影。`paid` 映射为 `coin-inserted`；`pullLever` 成功且 Host 返回 `spinning` 后才开始 spinning；`SPIN_ANIMATION_DONE` 和 `HIGHLIGHT_DONE` 只推进本地 highlight/payout；`PAYOUT_DONE` 发送 `settleSpin`，成功后短暂投影 settled 用于播报再清除。任何本地阶段都不得改钱包、库存、结果、保底或 revision。
- 刷新时 Host 若仍为 `spinning`，恢复同一个 spin id/result 的本地 spinning 表现；Host 已 cleared 时绝不重新扣币、重抽或结算。

- [ ] **Step 1: 写 HttpGameApi 与 polling cleanup 失败测试**

覆盖 strict response parse、GET query encode、POST command、409 用服务端 snapshot、abort/unmount 清 timer、focus/visibility/online 立即 refresh、命令 pending 时有副作用控件 disabled。

- [ ] **Step 2: 运行并确认 Client 数据层测试失败**

Run: `node_modules/.bin/vitest run src/plugin/client/api.test.ts src/plugin/client/use-host-game-controller.test.tsx`

- [ ] **Step 3: 实现 HttpGameApi 与 hook**

轮询间隔固定 2 秒；挂载时先刷新并发送幂等 `claimDaily`，每次成功刷新发现 Host 本地日期晚于 snapshot 已领取日期时再次发送新的幂等 `claimDaily`；命令成功立即采用响应；网络错误保留最后成功 snapshot 并进入 readonly/offline；Client 不计算 Token、日期、RNG 或 revision。

- [ ] **Step 4: 写 TokenEnergyMeter 可访问性失败测试**

```tsx
render(<TokenEnergyMeter progress={1850} dailyCoins={3} />)
expect(screen.getByText('Token 能量：1,850 / 3,000')).toBeVisible()
expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1850')
expect(screen.getByText('今日 Token 奖励：3 / 8')).toBeVisible()
```

- [ ] **Step 5: 实现 PluginApp 并复用 Canvas/收藏/商店/设置**

钱包与 Token meter 位于同一只读状态区；Canvas 命令调用 Host，动画阶段只发送 `pullLever/settleSpin`，不直接改经济状态。所有 mutation buttons 由 capability、offline 与 pending 合并决定 `disabled`。

- [ ] **Step 6: 注册 `conversation.view` 并绑定清理**

```ts
export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view', id: 'dsh-slot-widget', label: '老虎机', order: 20,
  }, SlotWidgetView))
}
```

`SlotWidgetView` 从 props 读取 `sessionId`。style tag 在 Client factory/materialization 内创建，并在 fiber dispose 时移除；不消费 `desktopWindow`。

生产 style 必须限定在 `.dsh-slot-widget-root` 的 CSS scope 内；不得让现有 `*`、`:root`、`html/body/#root`、`button/input` 等 standalone 选择器影响 DSH shell。独立 preview 可以直接加载 standalone stylesheet，生产 Client 只能注入 scoped text；契约测试搜索禁止的未限定顶层规则。

- [ ] **Step 7: 内联资产并建立独立 preview**

`loadSceneAssets(urls)` 接受显式 data URLs；Client entry 通过 Vite asset import 得到内联 PNG。`native-preview.html` 用 `InMemoryGameApi` 展示 Token `1850/3000` 和可交互 spin，仅供本地 QA，构建 pack allowlist 排除 preview。

- [ ] **Step 8: 运行 Client/组件测试**

Run: `node_modules/.bin/vitest run src/plugin/client src/components src/game`

Expected: PASS。

- [ ] **Step 9: Commit**

```bash
git add src/plugin/client src/plugin/preview native-preview.html src/components src/styles src/game/renderer/assets.ts
git commit -m "feat: add DSH slot view and token meter"
```

---

### Task 5: lazy-CJS 构建、bundle manifest、许可、文档与 CI

**Files:**
- Create: `scripts/build-plugin.mjs`
- Create: `vite.plugin.config.ts`
- Create: `tsconfig.plugin.json`
- Create: `src/plugin/package-contract.test.ts`
- Create: `cordis.patch.yml`
- Create: `LICENSE`
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`
- Modify: `package-lock.json`
- Rewrite: `README.md`

**Interfaces:**
- Produces: `lib/index.js`, `lib/client.js`, declarations、source maps、`dsh-desktop-slot-widget-0.2.0.tgz`。
- `lib/client.js` top-level 只调用 `window.__ModuleLoader__.load({ id:'dsh-desktop-slot-widget', factory })`；React/Cordis/DSH imports remain synchronous `require` inside factory。

- [ ] **Step 1: 写 package contract 失败测试**

测试 manifest `dsh.bundle.patch`、`exports['.']`、`exports['./client']`、`dsh.client.platform='web'`、conversation inject、engine、metadata、ISC 文件、patch row；检查 built client wrapper/id；搜索生产 bundle 不含 `MockDshAdapter`、`打开演示控制台`、`localStorage`、`FixedClock`；检查 tar file allowlist。

- [ ] **Step 2: 运行并确认 package 测试失败**

Run: `node_modules/.bin/vitest run src/plugin/package-contract.test.ts`

- [ ] **Step 3: 实现双构建与 lazy-CJS 包装**

Host 生成 ESM `lib/index.js`；Client 先由 Rollup 输出一个 CJS body，再包装为：

```js
window.__ModuleLoader__.load({
  id: 'dsh-desktop-slot-widget',
  factory(require) {
    const module = { exports: {} }
    const exports = module.exports
    // bundled CJS body
    return module.exports
  },
})
```

CSS 与三张 PNG 不产生旁路 runtime 文件；package 仍携带 `assets/` 供审计。

- [ ] **Step 4: 补全发布 manifest 与 cordis patch**

package `files` 只含 `lib`, `assets`, `cordis.patch.yml`, `README.md`, `LICENSE`；peer dependencies 锁定 spec；patch 只插入 `id: dsh-desktop-slot-widget, name: dsh-desktop-slot-widget`。

- [ ] **Step 5: 写真实安装/卸载 README 与 CI**

README 命令固定为：

```bash
dsh plugin --profile desktop add ./dsh-desktop-slot-widget-0.2.0.tgz
dsh --profile desktop --dump-config
# restart DSH Desktop
dsh plugin --profile desktop remove dsh-desktop-slot-widget
```

明确这是社区 DSH Desktop 插件、usage 缺失不发币、每日 3 + Token 规则、Host storage 前置条件和不具现金价值。CI 使用 Node `22.22.2`, `24.15.0`, `26`，运行 typecheck/unit/build/package test；Windows visual 单独锁 `windows-2022`。

- [ ] **Step 6: 运行 typecheck/build/package contract**

Run: `node_modules/.bin/tsc --noEmit && node scripts/build-plugin.mjs && node_modules/.bin/vitest run src/plugin/package-contract.test.ts`

Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json scripts vite.plugin.config.ts tsconfig.plugin.json src/plugin/package-contract.test.ts cordis.patch.yml LICENSE README.md .github
git commit -m "build: package native DSH desktop plugin"
```

---

### Task 6: 浏览器交互、视觉、全套回归与交付物

**Files:**
- Modify: `tests/app-flow.spec.ts`
- Modify: `tests/visual.spec.ts`
- Modify: `playwright.config.ts`
- Create: `tests/native-preview.spec.ts`
- Create: `src/plugin/host/dsh-host-smoke.test.ts`

**Interfaces:**
- Consumes: `native-preview.html`、Host test seam、Task 5 package output。
- Produces: 通过的 unit/type/build/E2E、QA screenshots、`.tgz` 与源码 zip。

- [ ] **Step 1: 写 Canvas ready、Token UI 与 spin 交互 E2E**

目标流：`/native-preview.html → 等待 data-render-state=ready → 看到 1850/3000 → 投币 → 拉杆 → 三列依次停止 → 钱包/收藏采用 Host fixture 响应`。测试旋转中截图/DOM probe 确认同一列 source symbol 不全相同且未出现 final symbol。

- [ ] **Step 2: 运行目标 E2E 并确认旧页面/选择器导致失败**

Run: `node_modules/.bin/playwright test tests/native-preview.spec.ts --project=chromium`

- [ ] **Step 3: 更新 Playwright 等待首帧与固定 viewport**

所有 screenshot 先等待 `[data-render-state='ready']`，再等待一帧；覆盖 1024×768、1280×720、1440×900。Linux 只做功能/QA screenshot，不覆盖现有 Windows baseline。

- [ ] **Step 4: 添加 Host composition smoke seam**

用 fake Cordis context 验证 `apply()` 打开 domain、注册两个 exact route、订阅 session event，并在 disposer 中反向注销和 close。若本机没有真实 `dsh` CLI，报告真实 fresh-profile install 为未执行，不能把 fake smoke 写成真实安装成功。

- [ ] **Step 5: 运行完整验证**

Run in order:

```bash
node_modules/.bin/vitest run
node_modules/.bin/tsc --noEmit
node scripts/build-plugin.mjs
node_modules/.bin/playwright test tests/app-flow.spec.ts tests/native-preview.spec.ts
npm pack --json
```

Expected: 全部 PASS；pack 清单无 test/demo/standalone dist。

- [ ] **Step 6: 检查本地 QA screenshot**

桌面 1280×720 与紧凑 1024×768：无 clip/overlap/error overlay；控制台无相关 error/warn；至少实际完成一次投币/拉杆并观察 UI 变化。

- [ ] **Step 7: 生成交付物**

在项目父目录创建 `dsh-desktop-slot-widget-0.2.0-source.zip`，排除 `.git`、`node_modules`、`.superpowers`、`.research`、临时截图和旧 `dist`；保留测试源码、文档与 lockfile。`.tgz` 直接使用 `npm pack` 产物。

- [ ] **Step 8: Commit**

```bash
git add tests playwright.config.ts
git commit -m "test: verify native plugin flows"
```
