# AGENT.md — AIGC 提示词库前端协作指南

本文给后续开发者和 AI 模型提供可立即接手的项目上下文。开始任务前先读本文、`README.md`、`PROGRESS.md`、`docs/implementation-plan.md`，再读相关功能目录和后端文档。文档中的旧记录可能已过时，执行前要核对当前代码与接口。

## 项目是什么

这是 `/Users/wangxinlin/Desktop/aigc-prompt-backend` 配套的独立 Next.js 前端，面向免费的 AI 图片提示词发现与复制场景。它需要还原飞书 UI 文档中的画廊、搜索、详情弹窗、登录与浅色/暗黑状态，并提供 SEO 友好的公开页面。

## 已确认的决定

- **技术栈：** Next.js App Router、React、TypeScript、Base UI、CSS Modules。
- **样式所有权：** 自建视觉组件；Base UI 只承担 Dialog、Popover、Select、Combobox 等复杂交互与无障碍行为，不使用完整预设主题库。
- **主题：** 所有主题色集中在 `src/app/theme.css` 的 CSS 自定义属性中。组件引用语义 token；不要散落硬编码颜色或在多个组件里维护暗黑配色。
- **搜索：** 搜索输入使用 Base UI Dialog；回车、热门词和最近搜索都导航到 `/?q=关键词`，结果与空状态直接出现在首页画廊。`/search` 只显示输入；旧 `/search?q=` 自动重定向。`@modal/page.tsx` 必须返回 null，确保首页软导航清除弹层。
- **筛选：** 使用 Base UI Select，显式关闭 `alignItemWithTrigger`，菜单位于按钮下方；选择/重置保留关键词和其他筛选条件。不要自己实现方向键、焦点或点击外部关闭。
- **详情：** 站内点击使用路由弹窗保留画廊上下文；直接打开 `/prompt/{id}`、刷新或爬虫请求时必须返回完整详情 HTML。不要把产品改成只在客户端存在的详情弹窗。
- **图片：** 作品图保留原始比例和颜色；暗黑模式不得覆盖图片滤镜；首屏外图片延迟加载并避免布局跳动。瀑布流卡片与详情弹窗舞台的容器尺寸都应跟随图片真实宽高比动态计算（不是固定盒子里塞图再裁切/留白），参考小红书网页版的实现方式：容器形状先贴合图片形状，`object-fit` 才不会裁切或拉伸变形；详情弹窗图片比例通过 `<img onLoad>` 读取 `naturalWidth/naturalHeight` 写入 CSS 变量。
- **响应式：** 桌面多列瀑布流与双栏详情，移动端纵向详情并保留底部复制操作。每项功能均在窄屏验证。
- **认证：** Google 登录为主，邮箱验证码为辅；暂不接微信登录。不可把密钥写入源码或文档。
- **MVP 边界：** 前端不增加站内图片生成、UGC 投稿、视频提示词、付费或浏览器插件。
- **代码质量：** 文件小而聚焦、命名清楚、复杂逻辑写简短注释；注释解释原因和约束，不重复代码表面语义。

## 视觉来源

唯一视觉基准是飞书知识库「UI」文档（AIGC-提示词库 UI 参考），包含浅色与暗黑模式的首页、详情、登录和搜索状态。当前本地快照归档在 `docs/reference/ui/`。图中数据和文案是样例；不把样例账号或内容当成产品数据。需要精确颜色/间距时从原始截图校准，不把近似 token 文字当成设计源值。

## 后端边界

后端源码与 API 契约位于 `/Users/wangxinlin/Desktop/aigc-prompt-backend`。常用公开接口包括 `/api/prompts`、`/api/prompts/search`、`/api/prompts/{prompt_id}`、`/api/prompts/{prompt_id}/similar`、`/api/categories` 和 `/api/search/trending`。当前搜索 API 只有 q/page/page_size；组合分类、模型、热门排序暂由 `src/lib/api/client.ts` 在服务端取完整匹配结果后处理，避免过滤第一页造成漏项。该适配会随结果数量增加耗时；后端原生支持后应替换它，普通 latest 搜索保持单次请求。

认证与收藏等接口要按 `docs/openapi.json` 核对参数和响应，不要猜字段。

前端环境变量只在 `.env.local` 配置；提交 `.env.example` 的变量名与无敏感示例值。服务端公共数据可以缓存并重新验证；个性化用户数据不得进入共享缓存。若需要浏览器携带 JWT，使用经过设计的安全会话/BFF，不把 token 放在 `localStorage`。

## 目录职责

- `src/app/`：路由组成、页面 metadata、主题入口与全局 CSS；页面级服务端组件尽量不承载复杂交互。
- `src/components/`：跨功能复用的按钮、图标按钮、弹窗和状态组件。
- `src/features/gallery/`：首页、分类筛选、排序、模型筛选和瀑布流卡片。
- `src/features/search/`：搜索输入 Dialog、最近/热门搜索与导航；搜索结果复用 gallery。
- `src/features/prompt-detail/`：详情数据、详情内容、桌面/移动布局及相似内容。
- `src/features/auth/`：登录弹窗、邮箱验证码和 Google 登录。
- `src/lib/api/`：服务端 API 客户端、错误映射和请求参数规范化。
- `src/types/`：从 OpenAPI 手工维护且与契约核对的共享类型。
- `tests/`：纯逻辑单元测试；组件测试和端到端测试放在相邻 `*.test.tsx` / `e2e/` 文件中。

## 开发流程

1. 先读对应 UI 截图、PRD 与 API schema，再定位最小功能边界。
2. 新行为先补可见行为测试，执行测试确认 RED，再实现到 GREEN。
3. 一个功能完成后立即在 `PROGRESS.md` 追加日期、范围、文件、测试结果和剩余事项。
4. 任何主题色都从 `src/app/theme.css` 读取；新颜色 token 同步记录其语义和浅/暗主题值。
5. 页面自测至少包括桌面宽屏与 390 px 手机宽度，主题覆盖浅色与暗色。详情 URL 需要直接请求与浏览器刷新验证。
6. 完成前运行 lint、typecheck、单测/覆盖率、关键 Playwright 流程及 production build；如有未运行的检查，明确记下。
7. 新的重要产品/架构决定写入本文件；不要把阶段性进度只留在聊天记录。

## 当前状态与接手入口

当前实现包含服务端画廊、桌面五列与手机双列瀑布流（卡片高度随图片真实比例布局，非固定裁切）、首屏之后的滚动分页加载、中英双语路由（`/zh`/`/en`，next-intl）、主题切换、分类/排序/模型筛选、搜索弹层与结果、最近搜索、详情并行弹窗（图片舞台同样跟随真实比例自适应）与可独立访问的 SEO URL、验证码登录 BFF、robots 与 sitemap。开发环境默认用截图裁出的 UI fixture 保持截图自测稳定；设 `AIGC_DEMO_MODE=false` 读取后端真实作品。production 始终忽略 fixture，仅显示真实内容或空状态。

有意保留的接手事项：Google OAuth 按钮目前仅提示客户端尚未配置，邮箱验证码可调用后端；收藏/点赞需要接入带 HttpOnly cookie 的 BFF 交互路由；搜索联想暂未实现（搜索结果分页已接入，见下）。修改这些行为前先确认后端契约，不要在浏览器 localStorage 保存 JWT。

国际化（`next-intl`）已接入：路由为 `/zh`、`/en` 前缀（`localePrefix: "always"`），语言切换按钮为真实可用的 `LanguageToggle` 组件；文案集中在 `messages/{locale}.json`，新增用户可见文案时两个语言文件都要补齐，不要只改一侧。`fallbackCategories`（后端分类接口不可用时的兜底）和搜索热门词列表仍是写死中文/静态文案，未做完整多语言兜底，后续如需严谨国际化需补上。

画廊首页已接入服务端分页与前端无限滚动（滚动到底部自动加载下一页，`src/app/api/prompts/route.ts` 作为 BFF 代理）；Demo 模式下固定只有 10 条样例数据，不会触发滚动加载，这是设计上的预期行为，不是 bug。

当前阶段、已完成页面和真实验证结果以 `PROGRESS.md` 最新条目为准。计划与任务清单见 `docs/implementation-plan.md`。不要假设本项目与后端共享依赖、端口、构建或部署进程。
