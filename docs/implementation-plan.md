# AIGC 提示词库前端实施计划

> **Goal:** 用可维护、SEO 友好且响应式的 Next.js 前端实现飞书 UI 文档中的提示词库页面。
>
> **Architecture:** Next.js App Router 服务端渲染公开内容与 metadata，FastAPI 保持独立 API。交互组件按 gallery、search、prompt-detail、auth 分域，Base UI 只负责无样式的复杂交互原语，CSS Modules 与主题 token 控制全部视觉。
>
> **Tech Stack:** Next.js、React、TypeScript、Base UI、CSS Modules、Vitest、React Testing Library、Playwright。

## 参考与验收基线

- 视觉来源：项目内 `docs/reference/ui/` 和飞书「UI」文档。
- 产品边界：后端目录 `docs/aigc-prompt-PRD.md`、`docs/openapi.json` 与 `AGENT.md`。
- 页面验收：浅色/暗黑首页、搜索展开/联想/结果、桌面详情弹窗、移动详情、登录、收藏登录态。
- SEO 验收：公开详情可以直接 HTTP 请求和刷新，HTML 内已有主要详情内容、唯一 title/description/canonical/OG metadata 和正确状态码。
- 响应式验收：桌面截图匹配设计基线；390 px 手机无横向溢出，关键操作保持可用。

## 阶段一：脚手架、文档、基础样式与主题 · 已完成

- [x] 去掉 Tailwind，安装 Base UI 与测试依赖，配置 lint、typecheck、unit、coverage、e2e 命令。
- [x] 建立模块目录、API 环境变量、README、AGENT、PROGRESS 和此实施计划；归档必要的 UI 参考图。
- [x] 测试主题偏好解析和主题切换，再实现全局浅/暗 theme tokens、reset、字体、focus 和 reduced-motion 基线。
- [x] 验证：lint、typecheck、单元测试、production build。

## 阶段二：首页导航与瀑布流 · 已完成，持续视觉校准

- [x] 建立与 OpenAPI 匹配的 prompt/category 类型和服务端 API client，处理空列表与 API 不可用回退。
- [x] 实现顶部品牌、搜索入口、主题/语言/账户入口、分类、筛选、瀑布流和复制/收藏入口。
- [x] 从最新 UI 截图裁出临时素材，匹配桌面五列宽度与图像比例；手机使用双列并检查横向溢出。
- [x] 验证：首页桌面/手机 Playwright、主题切换、lint、typecheck、coverage、build。

## 阶段三：搜索体验 · 部分完成

- [x] 测试最近搜索本地存储，加入热门搜索与 Base UI 搜索输入弹层；回车关闭弹层，在首页展示结果和空状态。
- [ ] 完成输入联想、高亮、键盘导航、服务端热门词和分页。
- [ ] 对照搜索展开、联想和结果页 UI 图进一步校准不同屏宽。

## 阶段四：详情弹窗、独立详情路由与 SEO · 部分完成

- [x] 实现 Next.js intercepting/parallel routes：画廊内以 modal 导航，直达 URL 输出服务端详情页与 metadata/canonical。
- [x] 实现作品展示、作者/模型、提示词、复制、下载、分享、点赞/收藏入口和相似内容；手机详情固定复制操作。
- [ ] 接入真实收藏/点赞 API、Base UI Dialog 的焦点管理和详情分页图组。
- [x] 验证：直接打开详情、桌面/手机布局、画廊内弹层导航 E2E。

## 阶段五：登录与个性化状态 · 部分完成

- [x] 实现邮箱验证码发送/确认 UI 与 BFF；访问 token 只写入 HttpOnly、SameSite Cookie。
- [ ] 配置 Google OAuth 客户端和完整登录回调；微信登录保持不实现。
- [ ] 加入认证流程 mock E2E 与登录/已登录首页状态。

## 阶段六：整体验收与交接 · 进行中

- [x] 加入 sitemap、robots、默认 metadata、图片尺寸/加载策略和页面索引边界。
- [ ] 对 UI 参考的每个页面状态运行 Playwright；检查浏览器 console、网络失败和服务端错误状态。
- [ ] 运行 lint、typecheck、unit、coverage、e2e、production build；记录真实输出和环境限制。
- [ ] 完成 README/AGENT/PROGRESS 与 TDD 证据记录，列出未接入的真实服务、部署步骤和后续缺口。

## 2026-10-13 第二部分：用户投稿与模型版本标签

**Goal:** 登录用户提交作品、查看审核状态，运营审核通过后公开；模型标签按家族分组但保留具体版本。
**Architecture:** 投稿复用未发布 Prompt，记录提交人、审核状态和拒绝理由；图片作为私有上传资产，提交时检查所有权并绑定，审核通过才公开。主站 BFF 延续 HttpOnly 会话，写请求校验同源。模型目录来自后端，别名标准化与筛选发生在数据库分页前。

- [x] 后端：新增上传资产模型、Prompt 投稿字段及 Alembic 迁移。图片限 JPEG/PNG/WebP、5 MiB、2000万像素，实际解码重编码；上传/投稿按用户 Redis 限流。测试先覆盖格式伪装、跨用户/重复资产、匿名访问、审核前不可公开。
- [x] 投稿与审核：新增用户上传/提交/分页列表和独立后台审核接口，待审→通过或拒绝使用行锁；拒绝保存理由；公开详情/收藏查询只返回已发布内容。用隔离 PostgreSQL schema 验证审批、拒绝、私有边界、事务和迁移。
- [x] 主站和后台：发布作品表单、我的作品、登录回跳、后台投稿审核列表/预览/通过/拒绝。先写可见行为和 BFF 边界测试，再实现；保留中英、深浅主题和手机布局。
- [x] 模型目录：同版本别名统一（MJ V6→Midjourney V6，Flux.1→FLUX.1），不同版本分开；保留未知标签避免丢失历史数据。主站筛选/提交、后台编辑共用家族分组目录；搜索原生支持category/models/sort。
- [x] 验收：Python单测/隔离数据库集成、前端与后台lint/typecheck/build、主站组件与浏览器回归、后台审核浏览器验证。更新原“不做UGC”约束和API契约，部署另行执行。

## 2026-10-13 发布图片上传组件（用户已确认方案）

**目标：** 拖拽上传区和缩略图列表，支持点击、多文件拖拽和 Ctrl/Cmd+V 粘贴；即时本地预览，逐张显示上传、成功、失败，支持重试和删除，第一张为封面。

**边界：** 保留 /api/submissions/upload 和 /api/submissions；最多 6 张 JPEG/PNG/WebP，每张不超过 5 MiB。组件管理本地预览和上传状态，表单仅接收成功 ID 及是否可提交。粘贴图片不干扰文字输入，清理 object URL，删除后异步结果不得重新插入图片。桌面和手机、深浅主题均需可用。

- [x] 先写组件测试并确认 RED：点击、拖拽、粘贴、校验、重试删除、顺序及提交门禁。
- [x] 实现 image-upload.tsx/CSS 和中英文文案，替换 publish-form 原生上传区。
- [x] 运行 lint/typecheck/全量 Vitest 和新组件覆盖率，保留提交 ID 回归测试。
- [x] 使用隔离 fixture API 验证浏览器上传及提交路径，并检查桌面/手机深浅主题截图。
- [x] 独立代码审阅并修复实际问题。开发验收完成；用户要求“提交代码”后按项目部署约定推送 main，等待自动部署并验证。

浏览器验收使用本地模拟后端，不访问生产数据库或 COS。测试接口返回合法 UUID，实际 Next 页面和 BFF 仍执行原有校验。需要在三个终端分别运行：

```bash
# 前端仓库目录，终端 1：只监听 127.0.0.1 的测试接口
python3 e2e/helpers/upload-fixture.py
# 终端 2：若已有该项目 dev 服务，先自行协调端口和构建目录，勿重复启动
API_BASE_URL=http://127.0.0.1:8017 AIGC_DEMO_MODE=false npm run dev -- --port 3000
# 终端 3：桌面及手机上传交互回归
UPLOAD_FIXTURE=1 npx playwright test e2e/upload-component.spec.ts --workers=1
```

组件采用 Base UI Button、共享 Icon、既有主题/间距/圆角 token；没有引入新的组件库。全量 Vitest：107 个测试通过（本机并发负载下使用 `--maxWorkers=2 --testTimeout=15000`）；组件覆盖率语句 97.97%、分支 84.93%、函数 96.87%、行 98.73%。

最终浏览器回归：桌面、手机共 2 个测试通过，包含三种上传、重试删除、首张封面对应 ID、提交门禁、深浅主题悬停色及无横向溢出；模拟后端验收不代表生产 COS/账户验收。

## 2026-10-13 账户菜单交互与图标（用户已确认示意图）

- 新增 lucide-react，账户菜单按需导入现成图标；不替换其他页面的既有 Icon。收藏 Star 使用 `--color-favorite` 金黄色主题 token，文字保持原色。
- 外观与语言各收为一行，右侧显示当前偏好/语言。桌面复用 Base UI 子菜单和单选项，手机在菜单内进入选择页并提供返回，避免屏外侧向展开。
- 保留系统主题偏好、locale 路由及 query、收藏/作品入口与退出登录语义；支持现有中英文、深浅主题、键盘和移动端。
- 验收：lint/typecheck、112 个 Vitest 测试通过；偏好组件覆盖率语句/函数/行 100%、分支 84.9%。桌面/手机浏览器 2 个测试通过，包括主题/系统跟随、语言路径和 query 保留、手机返回与焦点、断点切换恢复，菜单无屏外溢出。隔离副本的默认 Turbopack 生产构建通过。浏览器登录后端为本地模拟服务。保留此前已批准的模型菜单去重改动。提交和部署等待用户指令。
