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

## 阶段一：脚手架、文档、基础样式与主题

- [ ] 去掉脚手架附带但未选用的 Tailwind 配置，安装 Base UI 与测试依赖，配置 lint、typecheck、unit、coverage、e2e 命令。
- [ ] 建立模块目录、API 环境变量、README、AGENT、PROGRESS 和此实施计划；归档必要的 UI 参考图。
- [ ] 测试主题偏好解析和主题切换，再实现全局浅/暗 theme tokens、reset、字体、focus 和 reduced-motion 基线。
- [ ] 验证：lint、typecheck、单元测试、初始 build。

## 阶段二：首页导航与瀑布流

- [ ] 先写分类导航、模型/排序筛选、卡片与 masonry 数据呈现的组件测试。
- [ ] 建立与 OpenAPI 匹配的 prompt/category 类型和服务端 API client，覆盖 loading、empty、error、retry 状态。
- [ ] 实现顶部品牌锁定、搜索栏、主题/语言/账户入口、分类条、筛选器、瀑布流和卡片交互。
- [ ] 通过 UI 截图校准桌面列数、间距、卡片比例、标题和按钮状态；自测窄屏布局。
- [ ] 验证：unit/component tests、lint、typecheck、首页 E2E 和两主题截图。

## 阶段三：搜索体验

- [ ] 测试最近搜索本地存储、热门搜索读取、建议高亮和查询参数处理。
- [ ] 实现搜索展开层、联想列表、键盘导航、最近/热门状态与结果页分页。
- [ ] 对照搜索展开、输入联想和结果页 UI 图检查层级、留白与不同屏宽。
- [ ] 验证：unit/component tests、搜索 E2E、lint、typecheck。

## 阶段四：详情弹窗、独立详情路由与 SEO

- [ ] 测试详情内容映射、错误/404 处理、metadata 与 canonical 生成。
- [ ] 实现 Next.js intercepting/parallel routes：画廊内以 modal 导航，直达 URL 输出完整 SSR 详情页。
- [ ] 使用 Base UI 管理 dialog 键盘/焦点行为；实现作品展示、作者/模型、提示词、复制、点赞/收藏入口和相似内容。
- [ ] 实现移动端详情纵向布局与安全区固定复制操作。
- [ ] 验证：直接请求 URL、刷新/后退 E2E、桌面与手机截图、SEO HTML 检查、unit/component tests。

## 阶段五：登录与个性化状态

- [ ] 测试邮件输入校验、验证码发送/确认状态与登录后会话错误处理。
- [ ] 实现 Google 与邮箱验证码登录弹窗；微信登录保持不实现。
- [ ] 根据真实后端授权契约处理会话；不得将长期 JWT 存在 localStorage，也不得复制/显示真实密钥。
- [ ] 验证：表单组件测试、认证流程 mock E2E、移动端对照和登录/已登录首页截图。

## 阶段六：整体验收与交接

- [ ] 完成 sitemap、robots、默认 metadata、图片尺寸/加载策略和公开/私有页面索引边界。
- [ ] 对 UI 参考的每个页面状态运行 Playwright；检查浏览器 console、网络失败和服务端错误状态。
- [ ] 运行 lint、typecheck、unit、coverage、e2e、production build；记录真实输出和环境限制。
- [ ] 完成 README/AGENT/PROGRESS 与 TDD 证据记录，列出未接入的真实服务、部署步骤和后续缺口。
