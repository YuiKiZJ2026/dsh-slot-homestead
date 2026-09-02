# Contributing

感谢你改进 DSH Desktop Slot Widget。提交代码前，请先确认改动仍符合插件的安全边界：插件只管理游戏状态，不读取提示词、回复、凭据或工具输出，也不改变 DSH 的审批和沙箱设置。

## 开发环境

- Node.js `^22.22.2 || >=24.15.0`
- npm `11.9.0`
- Chromium，仅在运行 Playwright 测试时需要

安装依赖：

```bash
npm ci --legacy-peer-deps
```

## 提交改动

1. 为行为变化补测试，再修改实现。
2. 不要提交根目录的 `lib/`、`assets/`、`companion/`、覆盖率报告、QA 临时截图、
   生成源素材、测试报告或 tgz。`public/assets/` 与 `src/plugin/client/assets/` 中的受审
   运行时素材除外。
3. 更新影响用户的 README 和 CHANGELOG 条目。
4. 新增或替换图像时更新 [ASSETS.md](ASSETS.md)，保留来源和转换证据，并确认可公开
   修改与再分发；不要复制第三方游戏素材。
5. 安全问题请按 [SECURITY.md](SECURITY.md) 报告，不要在公开 Issue 中附带利用细节。

提交前运行：

```bash
npm run typecheck
npm run test:coverage
npm run build
npm run test:package
npm run test:e2e
```

发布候选还必须在干净 checkout 中运行：

```bash
npm ci --legacy-peer-deps
npm run verify:release-artifact
npm run verify:release-metadata -- --tag v0.8.0-beta.1
```

最后一条只有在素材权利状态已经由维护者明确确认时才会通过。不要从带未提交
改动或额外依赖的工作目录中生成正式包。

涉及界面像素变化时，请在 Windows 上运行 `npm run test:visual`。视觉快照必须来自经过确认的预期界面，不能用更新快照掩盖回归。

## Pull Request

PR 描述请写清用户看到的变化、存档兼容性和验证命令。一个 PR 只处理一组相关问题，避免夹带格式化或依赖升级。
