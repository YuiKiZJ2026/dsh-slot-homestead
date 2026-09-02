# DSH Desktop Slot Widget

[![CI](https://github.com/YuiKiZJ2026/dsh-desktop-slot-widget/actions/workflows/ci.yml/badge.svg)](https://github.com/YuiKiZJ2026/dsh-desktop-slot-widget/actions/workflows/ci.yml)

![DSH Desktop Slot Widget 预览](docs/demo-preview.png)

一个面向社区版 DSH Desktop 2.x 的像素老虎机 companion 插件。DSH 启动后，Host 会创建
一个可在整个 Windows 桌面拖动的透明像素小窗；拖到屏幕边缘会自动收起，重新点击露出的
边缘标签即可展开。小窗与 DSH 属于同一进程生命周期，彻底退出 DSH 后会一并关闭。Host
负责保存钱包、收藏、Token 能量和待结算 spin。它不是 DeepSeek 官方产品，也不代表
DeepSeek 或 DSH Desktop 的背书。

> 当前版本为 `0.8.0-beta.1` 预发布版本，仅建议在可备份的测试 profile 中体验。
> [视觉素材权利声明](ASSETS.md) 已完成；安装时请使用 GitHub Release 提供并附带校验值的
> `.tgz`，不要把本仓库的源码快照直接当作可安装插件。

游戏硬币和收藏品只用于插件内的装饰与进度，没有现金价值，不能交易、提现，也不会提升
模型、Token、工具或审批权限。

项目维护说明见 [贡献指南](CONTRIBUTING.md)、[安全政策](SECURITY.md)、
[视觉素材来源说明](ASSETS.md) 和 [版本记录](CHANGELOG.md)。

## 兼容与前置条件

- Node.js `^22.22.2 || >=24.15.0`。
- DSH Desktop 2.x；兼容基线为 DeepSeek Harness `0.1.1-rc.2` package set。
- Host profile 必须为 `storageDomain` 配置可用的持久化 backend route。插件无法打开存储
  domain 时会中止启动并给出诊断，不会回退到浏览器 `localStorage` 或静默清空存档。
- 桌面伴生窗使用 DSH Desktop 自带的 Electron `BrowserWindow`，不会启动额外常驻进程；
  `contextIsolation`、renderer sandbox 和 `webSecurity` 保持开启，且不向页面暴露 Node 或
  Electron IPC。非 Electron Host 会回退到公开的 `shell.overlay` slot。

## 安装、升级与卸载

只使用 GitHub Release 中预构建并附带校验值的 `.tgz`。下载
`dsh-desktop-slot-widget-0.8.0-beta.1.tgz` 与 `SHA256SUMS.txt`，核对 SHA-256 后，在二者
所在目录运行：

```bash
dsh plugin --profile desktop add ./dsh-desktop-slot-widget-0.8.0-beta.1.tgz
dsh --profile desktop --dump-config
# restart DSH Desktop
dsh plugin --profile desktop remove dsh-desktop-slot-widget
```

安装后必须重启 DSH Desktop，让插件进入新的 Cordis generation。启动完成后，老虎机会
以桌面伴生小窗显示，不需要创建或打开会话。直接拖动老虎机机身即可移动整个小窗；桌面
圆台仍保留收藏品拖放命中区。靠近屏幕任一边缘后，窗口会缩成独立的 28×48 像素标签，
不会露出钱包或 Token 文字。拖动小窗的任一角可以在 0.75–1.60 倍之间缩放；桌面、老虎机、
按钮、文字和收藏品会保持同一比例，窗口不会出现系统滚动条，缩放值会写入 Host 存档并在
重启后恢复。插件按 profile 安装；切换 profile 不会复制插件。

从旧版本升级前先退出 DSH Desktop 并备份对应 profile。移除旧插件、添加新的预构建 tgz，
再重启 DSH Desktop；不要手工编辑 profile manifest。Beta 版本保留向 0.7.x 及更早存档的
迁移逻辑，但预发布期间仍建议保留可回滚备份。

不要把 GitHub 源码 URL 直接交给 `dsh plugin add`：源码仓库有意不跟踪 `lib/` 等构建产物，
而 DSH/pnpm 对 Git 依赖构建脚本还有独立许可边界。GitHub Release 的预构建 tgz 是当前受支持
的安装渠道。

发布包只插入以下 Cordis row，不修改安全、审批、sandbox 或 credential 配置：

```yaml
- insert:
    - id: dsh-desktop-slot-widget
      name: dsh-desktop-slot-widget
```

## 玩法与收藏盒

- 右侧实体摇杆是唯一的开局入口。钱包有硬币时拉一次即可自动投入 1 枚并开始转动，左侧不再有透明投币热点。
- 每次结算后会显示独立结果卡，说明金币来源、重复品折算或新收藏。新收藏可一键摆到第一个空桌位，也可留在收藏盒。
- “当前目标”只保留一条最值得继续的进度：下一枚 Token 硬币、保底、新桌面组合或星夜套装，避免同时堆叠任务。
- 收藏盒是 12 格仓库，每格只放一个收藏品。把已拥有的格子直接拖向桌面；靠近 12 个圆台或
  小台时会出现发光吸附圈，松手后精确落位。
- 桌面上的收藏品也能再次拖动换位；拖到已占用位置时，新物品替换旧物品，旧物品回仓库。
  把物品拖回仓库区域或点击格子上的“收回”可取消展示。
- 指定收藏同时摆上桌面会点亮“静谧书桌”“暖夜灯组”或“工坊伙伴”，并在场景里持续显示轻微像素闪光。
- 像素工坊只直接制作普通收藏；稀有品和“星夜观测”套装改为拉杆与保底发现目标。集齐星夜三件套会自动启用星夜桌面。
- 渲染按每件素材的可见像素边界做中心线和底边校正，并统一可见高度；透明留白不同的水晶、
  徽章等不会再看起来歪斜或比例失真。
- 旧版已经展示的收藏品会在首次读取时按原顺序迁移到可用桌位，不会丢失所有权。

## 养成生态

- 养成场景位于左侧，老虎机始终固定在右侧；使用箭头在鱼缸、种植园和牧场之间切换，不需要离开当前桌面。
- 场景不是静态插画：鱼会来回游动，水草会摇摆、气泡会上浮；作物会呼吸生长；小鸡会啄食、兔子会跳、羊驼会散步。系统开启“减少动态效果”时会自动切换为轻微呼吸动画。
- 拉杆除了硬币与桌面收藏，还会发现鱼、种子、动物及养成用品；第一次获得居民会自动入住对应场景。
- 重复居民不会占格子，会按照普通、稀有或高级品质自动折算为硬币，并在结算卡里明确显示金额。
- 像素工坊使用同一个钱包出售新鱼、种子、动物、鱼食、肥料和动物饲料；普通桌面收藏仍可直接制作。
- 投喂、施肥或喂食会消耗对应用品并推进成长。成长完成会增加生态心愿、记录收获并返还少量硬币，形成“工作与拉杆产出—工坊消费—养成成长—生态回馈”的循环。
- 完成真实工作也会同时推进三个场景。几天不打开只会暂停成长，不会让鱼死亡、作物枯萎或动物离开。
- 0.7.0 及更早存档会自动补齐生态数据，原有钱包、收藏、Token 进度和桌面摆放保持不变。

## 硬币与实际 Token

- 每个本地自然日首次打开可领取 3 枚每日硬币，重复命令不会重复发放。
- 只有由顶层用户消息触发、成功完成且提供权威 usage 的 turn 才累计实际 Token；usage
  缺失、失败或中断、子代理、后台或 synthetic turn 均不发币。
- 实际用量为 provider 权威上报的 `input + output + cacheWrite + cacheRead`；
  `reasoningTokens` 已包含在 output 中，不再重复相加。
- 每满 10,000 个实际 Token 发 1 枚，不再截断单次 turn，因此一个大 turn 可以产生多枚。
  不足 10,000 的余量跨 turn 和日期保留；Token 奖励每日最多 8 枚，并受每日 25 枚工作
  奖励总上限约束。达到当日上限后仍记录防重水位，但不累积超限用量。
- 从 0.5.8 或更早版本升级时，Host 会用会话历史重建实际 Token 余量，同时保留旧钱包，
  不会把历史上已经结算过的加权进度再次发成硬币。
- 当前没有权威 provider 时，插件不会从助手文本、shell 退出码、工具次数或程序运行时间
  猜测“任务完成”“测试通过”或“有效专注”奖励。

## 存储、隐私与恢复

权威状态保存在 DSH Host storage domain 中，可跨 Desktop 的随机 loopback 端口和 Host
重启保留。正式插件不会读取或迁移旧浏览器原型的 `localStorage` 存档，也不会保存提示词、
助手回复、工具参数或工具输出。Client 断线时保持只读；恢复连接后重新读取 Host 投影。

## 从源码验证与打包

仓库使用 `npm@11.9.0` 和 `package-lock.json`；`pnpm` 只在 CI 中安装官方 DSH CLI，不用于管理
本项目依赖。DSH peer 由宿主提供，本仓库的 ambient contract 只用于离线类型检查。

普通开发检查：

```bash
npm ci --legacy-peer-deps
npm run typecheck
npm run test:unit
npm run test:coverage
npm run build
npm run test:package
npm run test:e2e
```

`npm run build` 生成 `lib/index.js`、lazy-CJS `lib/client.js`、独立的
`lib/companion.js`、声明与 source map、伴生页、审计用 `assets/`，以及
`dsh-desktop-slot-widget-0.8.0-beta.1.tgz`。

发布候选必须从干净 checkout 使用锁文件重新安装，并按“构建 → 测试 → 打包 → 包契约”顺序
生成确切产物：

```bash
npm ci --legacy-peer-deps
npm run verify:release-artifact
```

`verify:release-artifact` 先生成但不打包 `lib/`、`assets/` 与 `companion/`，完成类型和单元
测试后才调用 `npm pack --ignore-scripts`，最后验证 tgz 的精确文件 allowlist。直接运行
`npm pack` 也受 `prepack` 保护，会先重新构建产物。正式创建 GitHub Release 前还必须运行
`npm run verify:release-metadata -- --tag v0.8.0-beta.1`；素材权利没有确认时该检查会主动失败。

发布源码归档是显式、release-only 步骤，不属于普通 `npm run build`：

```bash
npm run build:source
```

该命令只需要 Git 与 Node.js，只从已提交的 `HEAD` 读取严格 allowlist 内的源码、测试、配置和
文档，并生成 `../dsh-desktop-slot-widget-0.8.0-beta.1-source.zip`，归档前缀为
`dsh-desktop-slot-widget-0.8.0-beta.1/`。工作树改动不会混入归档；根 `.superpowers/`、
`.research/`、`node_modules/`、生成的根 `lib/`、`assets/`、tgz、`test-results/`、`tmp/`
和 `dist/` 均排除。`public/assets/` 与 `src/plugin/client/assets/` 是受审源码资源，会保留。

CI 使用 `npm@11.9.0` 复现仓库依赖；真实 DSH gate 另外固定 `ubuntu-24.04`、
`pnpm@11.7.0` 和官方 `@deepseek-ai/dsh@0.1.1-rc.2` 的真实 Web profile 生命周期 gate；
它安装本地 tgz、验证
boot manifest/Client/真实路由、优雅重启与持久化后再卸载插件。Windows gate 也会执行
typecheck、完整 unit/build/package 流程和零像素容差视觉基线。覆盖率门禁要求 statements、
branches、functions、lines 均不低于 80%。真实 DSH smoke 同时支持 Linux 的 `dsh` 命令和
Windows 下通过 `--dsh-entry <lib/bin.js>` 直接调用固定 DSH 入口。

## 已知限制

DeepSeek Harness 仍处于 developer preview，公开事件、Client loader、Electron 宿主和持久化
格式可能发生破坏性变化。本版固定面向上述 DSH Desktop 2.x / Electron 43 兼容基线，不声称
兼容未知的未来 DSH/Desktop 版本。只应安装你信任的第三方 Host 插件。

- `0.8.0-beta.1` 不是稳定版；升级前应备份测试 profile，遇到异常优先停止使用并附版本与
  复现条件提交 Issue。
- GitHub 源码安装不属于受支持发布路径；只验证 Release 中经校验的预构建 tgz。
- 游戏经济、收藏和养成数据没有现金价值，也不承诺跨未来 DSH 预览版本永久兼容。
- 视觉素材公开分发必须先完成 [ASSETS.md](ASSETS.md) 中的维护者权利确认。
