# Design QA — 生态场景与老虎机共用一张桌

## Comparison target

- Source visual truth（用户指出问题的私有实机截图，不随仓库分发）：
  - 鱼缸，1022 × 696 px
  - 种植园，1097 × 627 px
  - 牧场，929 × 666 px
- Perspective and material reference:
  - `public/assets/scene-base.png`（老虎机原桌）
  - 为本项目生成的无家具长桌原图（本地迭代源文件，不随仓库分发）
- Browser-rendered implementation: 本地 QA 截图已用于比较，临时证据目录不随源码归档分发。
- URL: `http://127.0.0.1:5173/`
- State: 初始存档；鱼缸 1 条金鱼、种植园 1 株胡萝卜幼苗、牧场 1 只小鸡。

## Viewport and normalization

- 用户截图来自 Windows 显示缩放环境；浏览器复核时实测 `devicePixelRatio = 1.5`，浏览器截图 API 输出 CSS 像素。因此整页截图不以占屏比例做逐像素结论。
- 全视图分别按用户文件的 1022 × 696、1097 × 627、929 × 666 输出尺寸复核，确认没有场景破图、按钮碰撞或桌面断开。
- 关键桌面区域另以 578 × 282 px 的同裁切实现图复核；三个用户截图和三个最终局部图已在同一比较输入中打开检查。
- 几何结论使用渲染后的 CSS 坐标和素材像素测量，不把 DPI、浏览器缩放或截图裁边造成的差异记为产品缺陷。

## Findings

- No actionable P0/P1/P2 findings remain.
- [P3] 项目原有三张 Playwright 严格视觉基线早于本次素材修复，未在本轮重录；本轮按 Product Design 的浏览器约束只使用应用内浏览器，没有调用 Playwright CLI。因此不把 `test:visual` 列入已通过项。当前 UI 已由同视口手工截图、局部同图对照和真实几何测量覆盖。

## Required fidelity surfaces

- Fonts and typography: 本次未改文字系统。等宽像素 UI、金色标题、青色状态文字、字号和行高与问题截图一致；三种状态均无新增截断或重叠。
- Spacing and layout rhythm: 生态区右边缘与老虎机画布裁切后的第一个可见像素完全闭合，浏览器实测差值 `-0.0000057 px`。共享桌背沿、桌面前沿、前梁与底边均改到老虎机原桌的同一透视平面。
- Colors and visual tokens: 共享桌木色经真实素材调色后，主木纹均值约 `RGB(114.2, 48.3, 14.9)`；老虎机桌对应区域约 `RGB(113.5, 48.3, 15.3)`。深蓝背景、金色金属件和青色状态色未漂移。
- Image quality and asset fidelity: 共享桌为 784 × 576 RGBA 像素 PNG，透明范围约 `(59, 198)–(784, 543)`；无 CSS 木纹、无 SVG 代画、无拉伸，也没有中间方案中重复出现的凳子、底座或老虎机脚。源图 SHA-256 为 `472923D0954681E2E04835EDE53E4051DF81626FF58D4EE49AE0370514FF965C`，处理环境 Pillow 12.3.0，最终输出 SHA-256 为 `05E471B6EF41DD0C70B56888B8102DB6A777CD84CF6AF8220A9E4C0ECB0F3296`。
- Copy and content: 场景名、资源名、照料动作、已有数量和当前目标仍来自真实应用状态，未用占位文案替换。
- Icons: 左右切换箭头、老虎机图形和桌面金属装饰均沿用项目真实像素素材，方向、比例和光照一致。
- States and interactions: 在浏览器内依次切换鱼缸、种植园、牧场并返回；三种场景都保持同一桌面接缝。定向组件测试同时覆盖切换、居民互动和照料禁用状态。
- Accessibility: 场景切换、居民互动和照料仍使用语义按钮及 `aria-label`；焦点样式、`role=status` 和 reduced-motion 规则未受本次素材修复影响。
- Responsiveness: 1022 × 696、1097 × 627、929 × 666 和默认 1065 × 898 视图均完成浏览器检查；没有水平/垂直页面溢出，桌前沿不会随视口缩放重新错层。

## Comparison history

1. Earlier P1（用户截图）：旧 `ecosystem-shared-table.png` 只让后沿看似相接，左桌前沿实际在逻辑 `y≈250.7`，老虎机桌前沿在 `y≈228`，固定相差约 `22.7` 逻辑像素；在用户截图的显示缩放下约为 `31 px`。左桌还更红、更亮，所以视觉上明确是两张桌。
2. Earlier false pass corrected：旧报告的 `seamDelta≈0` 只证明两个 DOM 盒子的横坐标相邻，不能证明图内的桌沿、厚度和材质连续。本轮将该结论撤销。
3. TDD red pass：先把组件与插件样式契约改为真实共享桌、40 px 原生画布裁切和完整 784 × 576 桌面坐标；定向测试出现 2 个预期失败。
4. Blocked intermediate P1：曾验证过直接裁取 `scene-base.png` 的 `ecosystem-table-extension.png`。它能对齐前沿，但把圆台、方台和老虎机脚一并烘焙进左桌，在牧场和种植园下产生重复家具，因此未作为最终方案交付。
5. Final fix：使用无家具的真实长桌素材；归一到 784 × 576、去除连通深蓝背景，以 `y_out = round(1.46 × y_in) - 136` 一次性仿射到透明画布，再将木色匹配老虎机原桌。运行时恢复整图 `object-fit: contain`、右下对齐，并把老虎机左裁切恢复为 40 px。
6. Post-fix evidence：共享桌 alpha bbox 为 `(59, 198, 784, 543)`；渲染接缝误差为 `-0.0000057 px`；两侧主木纹 RGB 差值小于 1；三个最终局部截图均无台阶、重复家具或悬空底座。
7. Contract correction：把误导性的 `source-overlap-24px` 改成 `visible-edge-closed`，并新增从发布插件 CSS 读取 `280 + (-24) + (-16) + 40 = 280` 的真实几何回归测试，防止再次只验证自报标签。

## Browser verification

- Primary interactions tested: 上一场景、下一场景；鱼缸、种植园、牧场三种状态均实际渲染。
- Broken assets: none.
- Console errors: 0；console warnings: 0。仅有 Vite 开发连接/热更新 debug 日志和 React DevTools 开发提示。
- Visual golden suite: 未运行、未声称通过；现有三张 baseline 需在获准使用 Playwright CLI 时另行重录。
- Full-view evidence: 本地 QA 保留的三个场景整页截图。
- Focused seam evidence: 本地 QA 保留的三个桌面接缝局部截图。

## Verification

- 定向回归：2 个文件、11 项通过。
- Coverage run：47 个文件、500 项通过。
- Package contract：1 个文件、7 项通过；合计 48 个文件、507 项。
- Coverage：Statements 88.14%，Branches 80.16%，Functions 87.38%，Lines 90.34%。
- TypeScript 类型检查通过。
- Web preview 构建通过。
- 插件 Host、Client、Companion 构建及当时的 0.8.0 开发安装包重打包通过。
- `public` 与插件内共享桌素材 SHA-256 完全一致。

## Implementation checklist

- [x] 撤销仅验证 DOM 邻接的错误验收标准。
- [x] 去除重复家具的中间裁片方案。
- [x] 用真实、干净的同风格长桌素材重建左侧桌面。
- [x] 对齐后沿、前沿、前梁和底边四个视觉基准。
- [x] 匹配两侧木色，保留像素锐度和透明边缘。
- [x] 同步网页样式、插件内嵌样式、默认资产和插件资产。
- [x] 三场景同图对照、浏览器检查、测试、类型检查、构建和打包全部完成。

## Follow-up polish

- [P3] 如需继续维护项目的 Playwright 严格像素基线，在获得运行 Playwright CLI 的授权后重录 `desktop-1440x900`、`desktop-1280x720`、`desktop-1024x768` 三张 Windows snapshot。

final result: passed
