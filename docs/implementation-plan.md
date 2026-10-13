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
