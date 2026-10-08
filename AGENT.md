# AGENT.md — AIGC 提示词库前端协作指南

本文给后续开发者和 AI 模型提供可立即接手的项目上下文。开始任务前先读本文、`README.md`、`PROGRESS.md`、`docs/implementation-plan.md`，再读相关功能目录和后端文档。文档中的旧记录可能已过时，执行前要核对当前代码与接口。

## 项目是什么

这是 `/Users/wangxinlin/Desktop/aigc-prompt-backend` 配套的独立 Next.js 前端，面向免费的 AI 图片提示词发现与复制场景。它需要还原飞书 UI 文档中的画廊、搜索、详情弹窗、登录与浅色/暗黑状态，并提供 SEO 友好的公开页面。

## 已确认的决定

- **技术栈：** Next.js App Router、React、TypeScript、Base UI、CSS Modules。
- **样式所有权：** 自建视觉组件；Base UI 只承担 Dialog、Popover、Select、Combobox 等复杂交互与无障碍行为，不使用完整预设主题库。
- **主题：** 所有主题色集中在 `src/app/theme.css` 的 CSS 自定义属性中。组件引用语义 token；不要散落硬编码颜色或在多个组件里维护暗黑配色。
- **详情：** 站内点击使用路由弹窗保留画廊上下文；直接打开 `/prompt/{id}`、刷新或爬虫请求时必须返回完整详情 HTML。不要把产品改成只在客户端存在的详情弹窗。
- **图片：** 作品图保留原始比例和颜色；暗黑模式不得覆盖图片滤镜；首屏外图片延迟加载并避免布局跳动。
- **响应式：** 桌面多列瀑布流与双栏详情，移动端纵向详情并保留底部复制操作。每项功能均在窄屏验证。
- **认证：** Google 登录为主，邮箱验证码为辅；暂不接微信登录。不可把密钥写入源码或文档。
- **MVP 边界：** 前端不增加站内图片生成、UGC 投稿、视频提示词、付费或浏览器插件。
- **代码质量：** 文件小而聚焦、命名清楚、复杂逻辑写简短注释；注释解释原因和约束，不重复代码表面语义。

## 视觉来源

唯一视觉基准是飞书知识库「UI」文档（AIGC-提示词库 UI 参考），包含浅色与暗黑模式的首页、详情、登录和搜索状态。当前本地快照归档在 `docs/reference/ui/`。图中数据和文案是样例；不把样例账号或内容当成产品数据。需要精确颜色/间距时从原始截图校准，不把近似 token 文字当成设计源值。

## 后端边界

后端源码与 API 契约位于 `/Users/wangxinlin/Desktop/aigc-prompt-backend`。常用公开接口包括 `/api/prompts`、`/api/prompts/search`、`/api/prompts/{prompt_id}`、`/api/prompts/{prompt_id}/similar`、`/api/categories` 和 `/api/search/trending`。认证与收藏等接口要按 `docs/openapi.json` 核对参数和响应，不要猜字段。

前端环境变量只在 `.env.local` 配置；提交 `.env.example` 的变量名与无敏感示例值。服务端公共数据可以缓存并重新验证；个性化用户数据不得进入共享缓存。若需要浏览器携带 JWT，使用经过设计的安全会话/BFF，不把 token 放在 `localStorage`。

## 目录职责

- `src/app/`：路由组成、页面 metadata、主题入口与全局 CSS；页面级服务端组件尽量不承载复杂交互。
- `src/components/`：跨功能复用的按钮、图标按钮、弹窗和状态组件。
- `src/features/gallery/`：首页、分类筛选、排序、模型筛选和瀑布流卡片。
- `src/features/search/`：搜索输入、最近/热门搜索、联想和结果页。
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

当前阶段、已完成页面和真实验证结果以 `PROGRESS.md` 最新条目为准。计划与任务清单见 `docs/implementation-plan.md`。不要假设本项目与后端共享依赖、端口、构建或部署进程。
