# DSH Desktop 原生老虎机插件设计规格

- 日期：2026-08-26
- 状态：用户已批准；Token 能量补充规则于 2026-08-26 确认
- 目标发行版：DSH Desktop 2.x
- 兼容基线：DeepSeek Harness `0.1.1-rc.2`（Desktop 固定提交 `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`）
- 交付类型：可安装的 DSH bundle npm 包（`.tgz`）+ 源码包
- 替代规格：本文件取代 `2026-08-26-dsh-desktop-slot-widget-design.md` 中“浏览器原型”和 `MockDshAdapter` 的生产方案；原文件只保留为产品规则与视觉来源。

## 1. 结论

把现有 React/Vite 浏览器原型改造成一个真正安装进 DSH Desktop `desktop` profile 的标准 DSH 插件。它由 DSH Desktop 的 Electron 窗口直接加载，不创建网页快捷方式，不启动外部浏览器，也不另外复制一套 Electron 外壳。

安装后的用户路径是：

1. 用户在 DSH Desktop 的 `desktop` profile 安装插件包。
2. 重启 DSH Desktop，使 bundle 进入本次 Cordis generation。
3. 打开任一会话，在会话顶部选择“老虎机”视图。
4. 游戏界面在 DSH Desktop 窗口的会话内容区内运行；钱包、收藏、待结算 spin 与已处理事件保存在 Host 的 DSH storage domain 中。

这满足“真正桌面版 DSH”的要求，同时遵守 DSH Desktop 的公开插件边界：普通第三方插件使用标准 Host、Web Client module、HTTP carrier 和 UI slot，不直接访问 Electron/IPC 或私有标题栏。

## 2. 方案选择

### 2.1 采用：标准 DSH bundle + Host/Client 双面插件

- `lib/index.js` 是 Host face，监听 DSH 生命周期、验证命令并持久化权威状态。
- `lib/client.js` 是 DSH lazy-CJS Client face，通过公开 `conversation.view` slot 注册“老虎机”视图。
- Host 通过 `ctx.webServer.register` 暴露同源、loopback-only 的插件 API；Client 只使用相对 URL。
- `ctx.storageDomain` 保存游戏状态；`localStorage` 只允许缓存无关紧要的临时 UI 状态。

选择原因：这是当前 DSH 与 DSH Desktop 已公开、可打包、可安装、可测试的插件模型；既能跨 Desktop 的随机 loopback 端口持久化，又不依赖未发布的全局页面或 Electron 扩展点。

### 2.2 不采用：为老虎机单独制作 Electron 应用

它会成为另一个桌面程序，不是 DSH 插件；需要重复窗口、更新、签名、进程与安全维护，而且无法自然共享 DSH 的会话和 Agent 生命周期。

### 2.3 不采用：继续把 Vite 页面放进桌面快捷方式

这仍然只是浏览器原型，无法满足用户要求，也无法可靠访问 DSH Host 状态。

### 2.4 不采用：把业务存档放进 `localStorage`

DSH Desktop 默认使用随机 loopback 端口。浏览器存储按 origin 隔离，端口变化会得到新的存储空间，因此不能承诺跨 Desktop 重启保存钱包与收藏。

### 2.5 不采用：伪造“任务完成/测试通过/有效专注”

DSH 的 `turn/end` 只表示一次模型 turn 结束，通用 `tool/result` 也没有“测试通过”的业务语义；`agent/status=running` 更不代表用户的有效专注。插件不会从助手文本、shell 退出码、工具数量或程序开启时长猜测奖励。

## 3. 产品范围

### 3.1 本次必须完成

1. 生成标准 DSH bundle，可安装到 DSH Desktop `desktop` profile。
2. 在公开的 `conversation.view` 会话视图中呈现完整老虎机。
3. 生产包不再实例化 `MockDshAdapter`，演示控制只存在于独立开发/测试入口。
4. Host 监听真实 `session/event` 与 `agent/status`，并把可证实的状态投影给游戏。
5. Host 持久化钱包、每日赠币、Token 能量、spin、库存、展示位、保底计数、设置和幂等事件键。
6. 修复转轮图案居中、裁切和旋转图案带；旋转时不提前暴露最终结果。
7. 修复 Canvas 首帧就绪信号与 Windows 固定环境视觉基准。
8. 使用真实系统时钟并在跨日、窗口重新可见和恢复焦点时刷新。
9. 补齐 Node/pnpm 约束、包元数据、ISC `LICENSE`、GitHub Actions 和安装说明。
10. 交付预构建 `.tgz`；用户无需在 Desktop 内授权任意源码构建。

### 3.2 本次明确不做

- 不修改或 fork DSH Desktop/DeepSeek Harness 源码。
- 不访问 Electron API、私有 IPC、标题栏按钮或 Desktop 私有 launcher service。
- 不把老虎机做成操作系统桌面悬浮窗；当前公开且稳定的落点是 DSH 会话视图。
- 不读取或保存提示词、助手回复正文、工具参数或工具输出。
- 不提供现金、付费币、提现、交易、排行榜或影响模型能力的随机奖励。
- 不迁移旧浏览器 origin 的 `localStorage` 存档；正式插件从独立、可验证的 Host 存档开始。
- 不对不存在的 DSH 通用信号宣称“已验证任务奖励”或“有效专注奖励”。

## 4. 插件包结构

```text
dsh-desktop-slot-widget/
  package.json
  cordis.patch.yml
  LICENSE
  README.md
  lib/
    index.js
    client.js
    types/
      index.d.ts
      client/index.d.ts
  assets/
    scene-base.png
    reel-symbols.png
    collectibles.png
```

`package.json` 的发布契约：

```json
{
  "name": "dsh-desktop-slot-widget",
  "version": "0.2.0",
  "type": "module",
  "main": "./lib/index.js",
  "files": ["lib", "assets", "cordis.patch.yml", "README.md", "LICENSE"],
  "exports": {
    ".": {
      "types": "./lib/types/index.d.ts",
      "default": "./lib/index.js"
    },
    "./client": {
      "types": "./lib/types/client/index.d.ts",
      "default": "./lib/client.js"
    },
    "./package.json": "./package.json"
  },
  "engines": {
    "node": "^22.22.2 || >=24.15.0"
  },
  "packageManager": "pnpm@11.7.0",
  "license": "ISC",
  "author": "DSH Desktop Slot contributors",
  "description": "A pixel-art slot companion plugin for DSH Desktop.",
  "keywords": ["deepseek-harness", "dsh", "dsh-desktop", "plugin", "slot-widget"],
  "peerDependencies": {
    "@deepseek-ai/cordis": "^4.0.1",
    "@deepseek-ai/dsh-client-runtime": "0.1.1-rc.2",
    "@deepseek-ai/dsh-client-ui-conversation": "0.1.1-rc.2",
    "@deepseek-ai/dsh-host-webserver": "0.1.1-rc.2",
    "@deepseek-ai/dsh-session": "0.1.1-rc.2",
    "@deepseek-ai/dsh-storage-domain": "0.1.1-rc.2",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "inject": ["@deepseek-ai/dsh-client-ui-conversation"]
    }
  }
}
```

DSH runtime 与 Client contract 相关依赖锁定在同一 `0.1.1-rc.2` wave；保留 `jsdom@30` 时 Node engine 与 README 必须明确为 `^22.22.2 || >=24.15.0`，不再写不满足依赖约束的笼统“Node 20+”。Host 与 Client 构建都 externalize 全部 peer dependency，禁止把第二套 Cordis、DSH runtime、React 或 React DOM 打进产物。没有真实仓库 URL 时不虚构 `repository` 字段。

`cordis.patch.yml` 只插入本插件，不修改 DSH 的安全、审批、sandbox、credential 或其他 row：

```yaml
- insert:
    - id: dsh-desktop-slot-widget
      name: dsh-desktop-slot-widget
```

Client 构建产物必须是 DSH loader 可识别的 lazy-CJS factory，而不是普通 Vite ESM bundle。构建脚本在包外复现 DSH 的 wrapper，并用契约测试验证注册形状。

三个 PNG 在构建时以 data URL 内联到 Client bundle；Client 不假设 `/assets` 会被 DSH 自动托管。`assets/` 仍放入 tgz 供审计与 source map 定位，运行时以 `lib/client.js` 内联内容为准。

## 5. UI 集成

### 5.1 公开 slot

Client face 只通过 `ctx.slots.register` 注册：

```ts
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'

export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('conversation.view', () =>
    ctx.slots.register(
      {
        name: 'conversation.view',
        id: 'dsh-slot-widget',
        label: '老虎机',
        order: 20,
      },
      SlotWidgetView,
    ),
  )
}
```

`conversation.view` 是 session-scoped 视图标签。插件不替换 `root`、conversation shell 或 Desktop frame。普通 Web DSH 也可加载同一插件。本版本完全不注入或消费 `desktopWindow`：会话视图已经处在 Desktop 内容 viewport 内，自行补偿安全区反而会重复偏移。

### 5.2 布局与只读状态

- 384×288 Canvas 保持固定逻辑分辨率，在可用内容区内按整数倍率缩放。
- 组件不得越出 DSH Desktop 内容 viewport，也不得重复补偿 Desktop 已消费的安全区。
- 控件在 drag region 内必须为 `no-drag`。
- Host 不可写、连接断开、revision 冲突、命令执行中或 Canvas 资源尚未 ready 时，投币、拉杆、购买、展示切换等对应按钮真正 `disabled`，并呈现清晰不可用样式。
- 不再出现“看起来可点、实际被控制器拒绝”的只读按钮。
- 键盘、ARIA 名称、焦点可见性与 `prefers-reduced-motion` 保持完整。

## 6. Host 权威状态与 API

### 6.1 存储 domain

Host 通过 `ctx.storageDomain.open()` 打开 `dsh_slot_widget` version `1`：

```text
global:
  GameSnapshot
```

`GameSnapshot` 包含：

- `revision`：每次物质变更递增的非负整数。
- `wallet`、`daily`、`pityCount`。
- `tokenEnergy`：当前 `0..2999` 的跨回合余量，以及按本地日期记录的 Token 奖币数。
- `inventory`、`displaySlots`、`settings`。
- `pendingSpin`：已扣币且已锁定结果的完整 spin，或 `null`。
- `recentCommands`：带请求摘要和成功结果的有界 command receipt，用于网络重试幂等。
- `tokenUsageWatermarks`：每个 session 已原子处理的最大 usage seq，持久空间为 O(session)。
- `schemaVersion`：领域对象内部版本；当前为 `2`。DSH `gameDomainSpec.version` 仍为 `1`，因为 domain version mismatch 会发生在 Zod 读取/迁移之前，二者不能混用。
- `legacyTokenUsageReceipts`：仅由内部 schema v1 迁移生成的 session→seq 临时精确分组。活跃 session 在完整前缀 replay 时补 hole、推进 watermark 并原子删除自己的分组；cold/disposed session 的分组保留到首次 resume，v2 永不新增。

DSH session usage 使用显式 `usageSeqs` 与每个 step 一一对应；标准 v2 replay 只要任一 seq `<= watermark` 就整 turn 拒绝，成功处理（包括当日已封顶）必须在同一次 `global.set()` 推进 watermark。一次写失败会阻断该 generation 内同 session 的更高 seq，交给 Host 重启后的有序完整前缀 replay 恢复，避免 watermark 越过未提交 hole。receipt/watermark 不保存会话正文。外部 provider 的旧事件超过保留窗口时直接拒绝，不因 receipt 清理而重新发币。

Host 在 session scan 之前安装 listener。bootstrap 期间缓冲 raw `(session,event)`，而不是只缓冲 completed aggregate；每个 authoritative `session.events` snapshot 作为完整 prefix/high-water 送入同一个 per-session reducer，保留 open turn，再只 drain `seq > high-water` 的 raw suffix。存储 await 期间的新 raw 会进入下一轮 drain，buffer 真空后才同步切到 live，因而不存在 scan/listener gap 或 open-prefix 丢失。

`agent/status` 与 turn feedback 是 session-local、generation 内的易失投影，不写进存档。Host 按 session 维护活动 Agent 集合；任一对应 Agent running 即为 `working`，全部 idle 才为 `idle`，generation 重启时从 idle 开始。Client 请求携带当前 session id，只会收到本会话的状态，不让后台会话改变当前老虎机。

使用 JSON backend 即可满足当前低频写入；若压测显示频繁事件造成整文件写放大，才切换到同一 storage seam 的 SQLite route。业务代码不直接读写 DSH Home 文件或某个具体 backend。

兼容基线的 Desktop Web composition 必须已挂载 `@deepseek-ai/dsh-storage`、`@deepseek-ai/dsh-storage-json` 与 `@deepseek-ai/dsh-storage-domain`，并把 `dsh_slot_widget` 路由到 `json` backend。插件不重复插入这些宿主 row；required inject 或 backend route 缺失时启动失败并输出明确诊断，绝不回退到 `localStorage`。fresh-profile smoke 将这一前置条件作为强制验收。

Host face 明示 `inject = ['sessions', 'webServer', 'storageDomain']`。`gameDomainSpec` 使用静态 `defineDomain(...)` 与 schema 声明，而不是运行时拼字符串。两个 exact route 的 disposer、事件 listener、串行队列与 `domain.close()` 全部绑定在当前 Cordis effect；generation dispose 后不保留任何 service reference 或定时工作。

### 6.2 插件 API

Host 用 `ctx.webServer.register` 注册以下 exact routes，Client 全部使用同源相对路径：

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/dsh-slot-widget/state?sessionId=…` | 返回脱敏后的权威投影、revision 与本会话能力状态 |
| POST | `/api/dsh-slot-widget/command` | 执行一个游戏命令 |

命令联合类型只包含 `claimDaily`、`insertCoin`、`pullLever`、`settleSpin`、`buyItem`、`setDisplay` 和 `updateSettings`。每个 POST 必须携带：

- `commandId`：客户端生成的 UUID，用于重试幂等。
- `sessionId`：当前 `conversation.view` 的 Session id，只用于选择 session-local live projection。
- `expectedRevision`：拒绝陈旧写入。
- `type` 与该命令的最小 payload。

Host 串行化命令，先校验 schema、状态机、余额、revision 和 commandId，再写入 storage domain；持久化成功后才返回新投影。revision 冲突返回 `409` 与当前投影，客户端重新渲染，不自动重复有副作用的用户操作。

生命周期事件、provider 事件与 HTTP 命令共享同一个 Host 串行队列。一次处理固定为：取得队列 slot → 读取当前 snapshot/receipt → 识别重复请求 → 执行日期 rollover → 验证一个 transition → 用一次 `global.set()` 原子提交新 snapshot 与 receipt → 发布投影。临时 Agent 状态不递增经济 revision，因此不会无故冲突用户命令。

同一 commandId 重试时，Host 先校验 `type + canonical payload hash` 是否与原请求一致：一致则忽略已经过期的 `expectedRevision` 并返回原成功结果；不一致则返回稳定的 `command-id-reused` 错误。receipt 保存结果 revision 与返回投影；客户端命令包含 `issuedAt`，Host 拒绝超时请求，从而可以安全地有界保留 recent receipt。

spin 使用三阶段 Host 状态：`paid`（投币已扣费并锁定结果）→ `spinning`（拉杆命令已接受）→ settled（结算原子写入钱包/库存并清空 `pendingSpin`）。Client 动画只是这三阶段的表现。若在 `spinning` 时关闭或刷新，下一次读取会恢复并完成同一结果；`settleSpin` 重试由 command receipt 和 spin id 双重去重。

安全约束：

- 只在 DSH 已有 Web carrier 下注册，不新开端口；每个 route 都是 `kind: 'exact'`。
- 威胁模型是“本机可信 profile”：WebServer route 不构成跨进程认证，其他本地进程仍可能请求它。handler 仍必须校验正确 method、Host、可用时的 Origin/Fetch Metadata、JSON、body 上限与严格 schema；API 因此只暴露低影响游戏动作和非敏感投影。
- 不接受文件路径、URL、命令文本、提示词或任意对象字段。
- 不读取 credential，不发外网请求，不执行 shell。
- API 错误使用稳定 code；日志不打印完整请求体。

### 6.3 客户端同步

- 视图挂载时读取一次 snapshot。
- 视图可见期间每 2 秒拉取轻量 snapshot，以收到 Host 事件与 Agent 状态变化。
- 命令成功后立即采用响应中的 snapshot，不等待下一次轮询。
- `visibilitychange`、窗口 `focus` 和网络恢复时立即刷新。
- 轮询请求可取消；视图卸载后不保留 generation service 或定时器。

轮询是 v0.2 的刻意选择：它使用已公开的普通 Host route，不要求把第三方 Remote 加入 DSH 的中央 `api-remotes` assembly，也不引入自定义 WebSocket 协议。

## 7. 真实 DSH 事件映射

### 7.1 可直接使用

| DSH 信号 | 插件用途 | 是否自动发币 |
|---|---|---:|
| `agent/status` = `running` | UI 显示 working 动画 | 否 |
| `agent/status` = `idle` | UI 返回 idle 动画 | 否 |
| `session/event` 的失败型 `turn/end.reason` | 短暂显示 error/aborted/interrupted | 否 |
| `session/event` 的 completed `turn/end` | 显示一次完成反馈并记录统计 | 否 |

`turn/end completed` 不等于“用户真实任务完成”，所以不能直接奖励。一个 turn 可以没有工具步骤，Agent drain 也可能跨多个 turn。

### 7.2 生产奖励来源

v0.2 默认自动发放：

| 来源 | 奖励 | 幂等条件 |
|---|---:|---|
| 本地自然日首次打开 | 3 枚 | 日期键只成功一次 |
| 符合资格的主会话 Token 能量 | 每累计 3,000 有效 Token 发 1 枚 | 每个成功 model step 的稳定 usage key 只计一次；同一 turn 最多 1 枚 |

Token 是每日赠币之外的附加奖励，不被描述为“任务完成证明”。有效 Token 使用 DSH provider 实际上报的互斥字段计算：

```text
effective = outputTokens
          + floor(inputTokens * 0.10)
          + floor(cacheWriteTokens * 0.10)
          + floor(cacheReadTokens * 0.02)
creditedForTurn = min(3000, effective)
```

- `reasoningTokens` 已包含在 `outputTokens` 中，绝不再次相加。
- 只统计由真人用户消息直接触发的 root/main session turn：`session.header.parentSession === undefined` 且 `session.header.delegationDepth ?? 0 === 0`；`turn/start` 后第一个 admitted `user/message` 固定 trigger provenance，只有其 `source.kind === 'user'` 才 eligible。任何 matching assistant step（即使 usage 缺失、非法或 interrupted）在尚无 trigger 时都会先冻结为 ineligible；后续真人 steering 永不升级 plugin/goal/background/synthetic origin。最终 `turn/end.reason.kind` 还必须为 `completed`。
- 子代理、后台/定时任务、synthetic injection、compaction、失败 attempt、被中断/取消/达到 token 上限的 turn 不计；一次 turn 先汇总其中成功 model step，再统一入账。
- usage 必须来自 DSH adapter/provider 的原始报告；字段缺失按 `0`，整次 usage 缺失则不估算、不奖励。
- 每个符合资格的 turn 最多贡献 3,000 有效 Token，因此最多发 1 枚；不足部分保存在 `tokenEnergy.progress`，跨 turn、跨本地自然日结转。
- Token 奖励每天最多 8 枚，并计入同日 25 枚 work reward 总上限。任一上限已满后，当日后续 Token 不计入 progress，防止把封顶后的消耗囤到次日。
- usage receipt、progress、日期 ledger、wallet 与 revision 必须在同一次 `global.set()` 中原子提交。重复 event/step、Host 重启、Client 轮询和网络重试都不得重复发币。
- UI 固定显示 `Token 能量：<progress> / 3000` 与 `今日 Token 奖励：<coins> / 8`；这两个值来自 Host 投影，Client 不自行累计。

真实任务、测试验证和有效专注的奖励接口保留为 Host 内部 provider contract，但默认没有 provider，因此 UI 会明确显示“未连接任务奖励来源”，而不是提供可点击的模拟按钮。

未来 provider 必须提供：

- 任务：稳定 `taskId`、状态由非模型权威来源确认 completed。
- 验证：受控测试工具输出明确的 `verificationId` 与 `status=passed`；不能把任意 shell 退出 0 当验证。
- 专注：可信计时器提供稳定 `eventId`、确认后的分钟数；不能使用 DSH 运行时长、Agent running 时长或工具调用数。

所有 provider event 使用 Host-only envelope：`providerId`、`eventId`、`occurredAt`（UTC instant）、`reportedAt`、`subjectId`、`kind` 与经 schema 验证的最小 payload。奖励按 `occurredAt` 映射到 Host 本地自然日并计入该日上限；同一 provider 内的撤销/更正必须引用原 stable id，本版本拒绝自动扣成负余额。校验、额度计算、receipt 与钱包变更在同一次 snapshot 提交完成。

原有每日工作上限、专注上限与验证概率规则只在对应 provider 存在时启用。开发/测试 harness 可以注入假的 provider 验证经济逻辑，但这些控件和 `MockDshAdapter` 不进入生产 Client bundle。

## 8. 时间与跨日

- 生产 Host 和 Client 使用 `SystemClock`；`FixedClock` 只允许测试与开发 harness 注入。
- 日期以运行设备本地自然日为准，Host 是唯一发奖者。
- Client 在挂载、focus、visibility 恢复时请求状态；首次挂载和跨日轮询自动发送幂等 `claimDaily`，没有需要用户点击的“领取”按钮。
- 页面长期开启也会在下一次轮询最多 2 秒内跨日，不要求刷新。
- `daily` 明确保存 `lastGrantedLocalDate` 与按日期的 reward ledger。只有当前日期严格晚于最后领取日才发币；当前日期早于最后领取日时返回 `clock-skew` 能力状态且不写入、不发币，恢复到不早于该日期后才继续。

## 9. 转轮渲染与动画

### 9.1 所有图标统一居中

三列保留机身美术的准确内孔尺寸（左 `22×37`、中 `22×37`、右 `21×37`），但共享同一格中心公式：

```text
centerX = window.x + window.width / 2
centerY = window.y + window.height / 2
drawX = round(centerX - frame.width / 2 + opticalOffsetX)
drawY = round(centerY - frame.height / 2 + opticalOffsetY)
```

- 构建产物把五个符号重新生成到 `90×18` 的 runtime atlas（五个 `18×18` cell）；现有 `320×64` 图只作为源资产，不进入 runtime 绘制路径。`ASSET_FRAMES`、透明边距与每符号 optical offset 同步更新。
- 光学校正是符号图集元数据的一部分，且同一符号在静止和旋转时共享同一 offset。
- 每列在 `ctx.save()` 后对精确转轮窗口做 `clip()`；绘制后 `restore()`。
- clip 范围与格子内缘一致，任何中间 frame 都不能越过边框。
- 单元测试逐个符号、逐列断言几何中心和边界；像素测试断言 clip 外 alpha 不变。

### 9.2 混合图案带

旋转阶段不重复最终图案。每个滚筒有确定性混合图案带，例如：

```text
coin, leaf, moon, crystal, robot, leaf, coin, crystal, moon, robot
```

- 投币时锁定最终结果，但每列旋转带根据 `spin.id + reelIndex` 选定相位，并在该列停止前完全排除该列的 final symbol，因此任何旋转 frame 都不会提前显示最终图案。
- 动画保持单调的未取模距离；renderer 用 `floor(distance / cellHeight)` 与局部余数选择当前四个相邻图案。
- 三个滚筒按左、中、右停止。某列进入 stopped 后才把最终符号对齐到格中心。
- 最终符号只在该列停止的瞬间出现；掉帧或 reduced-motion 仍遵循相同状态顺序。
- 刷新时若 `pendingSpin` 已开始，Host 保存的结果不变；Client 从状态直接完成同一结果，不二次扣币、不重抽。

## 10. Canvas 首帧与视觉测试

`GameCanvas` 公开机器可读状态：

```text
data-render-state="loading | ready | failed"
```

资源全部加载后必须：

1. 禁用图像平滑。
2. 同步绘制 elapsed `0` 的完整首帧。
3. 只有同步绘制成功后才把状态设为 `ready`。
4. 之后再启动 `requestAnimationFrame`。

Playwright 截图测试先等待 `ready`，再等待一个稳定帧；资源失败则直接失败并输出缺失资源，不截图 loading 帧。

视觉基准环境固定为：

- GitHub Actions `windows-2022`，避免 `windows-latest` 镜像切换。
- 锁定到精确 patch 的 Node 24、pnpm、Playwright 包与 Chromium revision。
- 1024×768、1280×720、1440×900 三个 viewport。
- Windows 基准只在上述环境中通过显式 `test:visual:update` 重建。

普通功能 E2E 可在 Linux 运行，但不得拿 Linux Canvas 输出覆盖 Windows baseline。预缩放的 1:1 像素图集进一步消除 Chromium 图像重采样产生的约 30 像素漂移。

## 11. 发布与 CI

### 11.1 GitHub Actions 门禁

1. Node `22.22.2`、`24.15.0`、`26`：安装、lint、typecheck、unit、build；每个版本必须满足 test-only `jsdom` 的实际 engine。
2. 运行包契约测试：manifest、patch、exports、lazy-CJS wrapper、必需文件与禁止文件。
3. `pnpm pack` 后检查 tar 清单；包内不得包含源码测试报告、`node_modules`、旧 Vite standalone `dist` 或演示控制台。
4. Linux gate 在隔离 `DSH_HOME` 的 stock `web` profile 安装本地 `.tgz`，运行 `dsh --profile web --dump-config` 与 `dsh web --host 127.0.0.1 --port 0 --no-open`；确认 root boot manifest、`/plugins/dsh-desktop-slot-widget/client.js` 与真实 state/claimDaily routes。
5. Windows 固定 Chromium 环境运行功能 E2E 与三张视觉截图。
6. 首次优雅 SIGINT 停止后占用旧端口，再用同一 DSH Home 和新的 OS-assigned port 重启，验证 Host-backed wallet/revision 仍存在，随后卸载并确认 config row 消失。

### 11.2 安装与卸载

README 使用明确命令：

```powershell
dsh plugin --profile desktop add .\dsh-desktop-slot-widget-0.2.0.tgz
```

安装后重启 DSH Desktop。卸载同样通过 `dsh plugin --profile desktop remove dsh-desktop-slot-widget`，不指导用户手改 profile manifest。切换 profile 不会复制插件；每个 profile 必须单独安装。

### 11.3 发布内容

- `dsh-desktop-slot-widget-0.2.0.tgz`：可直接安装的预构建插件。
- `dsh-desktop-slot-widget-0.2.0-source.zip`：由显式 `npm run build:source` 仅从 tracked `HEAD` 生成，带固定 release prefix 和严格 allowlist；包含源码、测试、文档与 lockfile，不含 `.superpowers`、`.research`、`node_modules`、根生成物、构建缓存和测试报告。
- `README.md`：前置条件、安装、重启、使用、卸载、兼容范围、存档位置语义与已知限制。
- `LICENSE`：与 package manifest 一致的 ISC 文本。

## 12. 测试策略

所有行为修改按 TDD 完成，测试分层如下：

| 层 | 重点 |
|---|---|
| 纯领域单元测试 | 状态机、概率、保底、重复品、Token 权重/余量/封顶、revision、幂等、日期 rollover |
| Host 契约测试 | storage schema、usage/turn 关联、事件映射、API validation、冲突、失败后不变更 |
| Client 单元测试 | slot 注册、disabled 状态、同步/错误/冲突处理、轮询清理 |
| Renderer 测试 | 三列所有图标居中、clip、混合图案带、最终结果延迟出现 |
| 包测试 | `dsh.bundle.patch`、exports、lazy-CJS、tar 白名单 |
| DSH smoke | pinned Linux stock web profile 安装、真实 manifest/route、持久化重启、卸载 |
| Playwright | 投币到结算、键盘、reduced-motion、三个 Windows viewport 截图 |

关键失败路径必须单独覆盖：余额不足、重复 commandId、revision 过期、存储写失败、资源加载失败、Host 断线、跨日、旋转中刷新、Desktop generation dispose。

## 13. 错误处理与恢复

- storage domain 版本不匹配或内容损坏时，插件启动失败并输出可操作诊断；不静默清空钱包。
- API 写入失败时，内存投影不得先行提交；Client 保留当前画面并显示“未保存”。
- Client 失联时停用所有有副作用控件，恢复后重新读取权威 snapshot。
- 同一 commandId 重试返回原命令结果或明确的重复响应，不重复扣币或结算。
- 视觉资源失败时显示有文字的错误占位，不留下透明、可点击的 Canvas。
- DSH/Desktop 版本不兼容时在启动日志中给出期望版本；不尝试修改宿主配置绕过。

## 14. 兼容与风险声明

- DeepSeek Harness 当前仍是 developer preview，事件、Client bundle 与持久化格式可能破坏性变化；本包按 Desktop 固定提交 `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` 对应的精确 `0.1.1-rc.2` package set 锁定和测试，upstream HEAD 只作非阻塞 canary。
- `anywhere-labs/dsh-desktop` 是社区维护的独立桌面发行版，不是 DeepSeek 官方产品或背书；本包面向其公开 Desktop 2.x contract。
- 由于 DSH 尚未提供稳定的第三方全局页面/系统桌面悬浮 slot，本版使用已公开的 `conversation.view`。若未来出现正式全局 extension point，可新增表现面，但 Host 状态、API 与游戏引擎无需重写。
- 第三方 DSH bundle 在 Host 进程内执行，用户只应安装自己信任的包。我们的 patch 最小化且不触碰安全配置，README 会列出其完整内容供审查。

## 15. 验收标准

全部条件同时满足才可称为“完成”：

1. `.tgz` 能通过命令安装到 `desktop` profile，重启 DSH Desktop 后出现“老虎机”会话视图，且不打开外部浏览器。
2. 生产包没有 `MockDshAdapter`、演示按钮或 Vite standalone 页面入口。
3. 钱包与收藏在 Desktop 随机端口变化和进程重启后仍保留。
4. 每列每个符号静止和旋转时均位于格子中央，clip 外没有符号像素。
5. 旋转显示混合图案，停止前不连续铺最终图案，也不提前揭示最终结果。
6. 页面持续打开跨过本地午夜后最多 2 秒内进入新日期；每日币不重复。
7. 功能 E2E、单元、类型、构建、包 smoke 与三个固定 Windows 视觉测试全部通过。
8. package metadata、Node/pnpm 约束、ISC LICENSE、GitHub Actions、安装/卸载说明齐全。
9. 真实 DSH 状态只用于它能证明的语义；未连接权威 provider 时不伪造任务、验证或专注奖励。
10. 一个有效 turn 的 Token usage 只计一次；计算严格按权重公式，`reasoningTokens` 不重复相加，单 turn 最多 1 枚、每日最多 8 枚，并受每日 25 枚 work reward 总上限约束。
11. Token usage 缺失、失败/中断 turn、子代理或后台 turn 均不发币；UI 显示 Host 权威的 `progress / 3000` 与 `coins / 8`。

## 16. 一手资料

- [DeepSeek Harness 官方仓库与 developer preview 说明](https://github.com/deepseek-ai/deepseek-harness)
- [官方 bundle 发布与安装指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)
- [官方 Client module 打包契约](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/client-modules.md)
- [官方 conversation UI slot contract](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-conversation/README.md)
- [官方 session event 文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/session.md)
- [官方 storage domain 文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/storage.md)
- [官方 Web server 文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/web-server.md)
- [DSH Desktop 架构](https://github.com/anywhere-labs/dsh-desktop/blob/master/docs/architecture.md)
- [DSH Desktop 公开插件 service contract](https://github.com/anywhere-labs/dsh-desktop/blob/master/dsh-plugin-desktop/docs/plugin-services.zh.md)
- [DSH Desktop 用户指南](https://github.com/anywhere-labs/dsh-desktop/blob/master/docs/user-guide.md)
