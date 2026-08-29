# Contributing

感谢你改进 DSH Desktop Slot Widget。提交代码前，请先确认改动仍符合插件的安全边界：插件只管理游戏状态，不读取提示词、回复、凭据或工具输出，也不改变 DSH 的审批和沙箱设置。

## 开发环境

- Node.js `^22.22.2 || >=24.15.0`
- npm 10 或兼容版本
- Chromium，仅在运行 Playwright 测试时需要

安装依赖：

```bash
npm ci --legacy-peer-deps
```

## 提交改动

1. 为行为变化补测试，再修改实现。
2. 不要提交 `lib/`、`assets/`、`companion/`、覆盖率报告、测试报告或 tgz。
3. 更新影响用户的 README 和 CHANGELOG 条目。
4. 安全问题请按 [SECURITY.md](SECURITY.md) 报告，不要在公开 Issue 中附带利用细节。

提交前运行：

```bash
npm run typecheck
npm run test:coverage
npm run build
npm run test:package
npm run test:e2e
```

涉及界面像素变化时，请在 Windows 上运行 `npm run test:visual`。视觉快照必须来自经过确认的预期界面，不能用更新快照掩盖回归。

## Pull Request

PR 描述请写清用户看到的变化、存档兼容性和验证命令。一个 PR 只处理一组相关问题，避免夹带格式化或依赖升级。
