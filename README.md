# DSH Desktop Slot Widget

一个面向社区版 DSH Desktop 2.x 的像素老虎机 companion 插件。它通过公开的
`conversation.view` slot 嵌入会话内容区，由 Host 保存钱包、收藏、Token 能量和待结算
spin；它不是 DeepSeek 官方产品，也不代表 DeepSeek 或 DSH Desktop 的背书。

游戏硬币和收藏品只用于插件内的装饰与进度，没有现金价值，不能交易、提现，也不会提升
模型、Token、工具或审批权限。

## 兼容与前置条件

- Node.js `^22.22.2 || >=24.15.0`。
- DSH Desktop 2.x；兼容基线为 DeepSeek Harness `0.1.1-rc.2` package set。
- Host profile 必须为 `storageDomain` 配置可用的持久化 backend route。插件无法打开存储
  domain 时会中止启动并给出诊断，不会回退到浏览器 `localStorage` 或静默清空存档。
- 插件使用 Host 的同源 Web server 和公开 conversation UI slot；不访问 Electron 私有
  IPC，也不创建外部浏览器窗口。

## 安装、检查与卸载

在包含预构建包的目录运行：

```bash
dsh plugin --profile desktop add ./dsh-desktop-slot-widget-0.2.0.tgz
dsh --profile desktop --dump-config
# restart DSH Desktop
dsh plugin --profile desktop remove dsh-desktop-slot-widget
```

安装后必须重启 DSH Desktop，让插件进入新的 Cordis generation。随后打开任一会话，
选择“老虎机”视图。插件按 profile 安装；切换 profile 不会复制插件。

发布包只插入以下 Cordis row，不修改安全、审批、sandbox 或 credential 配置：

```yaml
- insert:
    - id: dsh-desktop-slot-widget
      name: dsh-desktop-slot-widget
```

## 硬币与 Token 能量

- 每个本地自然日首次打开可领取 3 枚每日硬币，重复命令不会重复发放。
- 只有由顶层用户消息触发、成功完成且提供权威 usage 的 turn 才累计 Token 能量；usage
  缺失、失败或中断、子代理、后台或 synthetic turn 均不发币。
- 有效用量为 `output + floor(input×10%) + floor(cacheWrite×10%) +
  floor(cacheRead×2%)`；`reasoningTokens` 不重复计算。
- 每个 turn 最多计 3,000 点；每满 3,000 点发 1 枚，每个 turn 最多 1 枚。余量跨 turn
  和日期保留；Token 奖励每日最多 8 枚，并受每日 25 枚工作奖励总上限约束。
- 当前没有权威 provider 时，插件不会从助手文本、shell 退出码、工具次数或程序运行时间
  猜测“任务完成”“测试通过”或“有效专注”奖励。

## 存储、隐私与恢复

权威状态保存在 DSH Host storage domain 中，可跨 Desktop 的随机 loopback 端口和 Host
重启保留。正式插件不会读取或迁移旧浏览器原型的 `localStorage` 存档，也不会保存提示词、
助手回复、工具参数或工具输出。Client 断线时保持只读；恢复连接后重新读取 Host 投影。

## 从源码验证

DSH peer 由宿主提供；本仓库的 ambient contract 只用于离线类型检查。常用命令：

```bash
npm ci --legacy-peer-deps
npm run typecheck
npm run test:unit
npm run test:coverage
npm run build
npm run test:package
npm run test:e2e
```

`npm run build` 生成 `lib/index.js`、lazy-CJS `lib/client.js`、声明与 source map、审计用
`assets/`，以及 `dsh-desktop-slot-widget-0.2.0.tgz`。生产 Client 将 CSS 与三张 PNG 内联；
根 `assets/` 只用于包审计，不是运行时 URL。

发布源码归档是显式、release-only 步骤，不属于普通 `npm run build`：

```bash
npm run build:source
```

该命令只需要 Git 与 Node.js，只从已提交的 `HEAD` 读取严格 allowlist 内的源码、测试、配置和
文档，并生成 `../dsh-desktop-slot-widget-0.2.0-source.zip`，归档前缀为
`dsh-desktop-slot-widget-0.2.0/`。工作树改动不会混入归档；根 `.superpowers/`、
`.research/`、`node_modules/`、生成的根 `lib/`、`assets/`、tgz、`test-results/`、`tmp/`
和 `dist/` 均排除。`public/assets/` 与 `src/plugin/client/assets/` 是受审源码资源，会保留。

CI 另有固定 `ubuntu-24.04`、`pnpm@11.7.0` 和官方
`@deepseek-ai/dsh@0.1.1-rc.2` 的真实 Web profile 生命周期 gate；它安装本地 tgz、验证
boot manifest/Client/真实路由、优雅重启与持久化后再卸载插件。Windows gate 也会执行
typecheck、完整 unit/build/package 流程和零像素容差视觉基线。覆盖率门禁要求 statements、
branches、functions、lines 均不低于 80%。真实 DSH smoke 同时支持 Linux 的 `dsh` 命令和
Windows 下通过 `--dsh-entry <lib/bin.js>` 直接调用固定 DSH 入口。

## 已知限制

DeepSeek Harness 仍处于 developer preview，公开事件、Client loader 和持久化格式可能发生
破坏性变化。本版固定面向上述兼容基线，使用当前公开的会话视图；它不提供系统桌面悬浮窗，
也不声称与未知的未来 DSH/Desktop 版本兼容。只应安装你信任的第三方 Host 插件。
