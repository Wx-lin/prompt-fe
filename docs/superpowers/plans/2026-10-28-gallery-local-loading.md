# 图库局部加载 Implementation Plan

**Goal:** 分类、排序、模型与搜索更新时，仅作品列表显示骨架；页头、创作输入、筛选和已打开聊天保持挂载与可交互。

**Architecture:** 现有GalleryRoute在查询参数变化时重置整个Suspense，fallback包含页头骨架，是整页闪烁根因。沿用RSC数据与原骨架组件：外层只承担首次shell，按规范化过滤参数设置的Suspense移到feed slot。提取GalleryFeed保留分页、错误和空状态；CreationGallery为列表和骨架提供聊天紧凑列数与参考图回调。数据保持SSR/流式输出，URL筛选/SEO不改为纯客户端取数。

**Tech Stack:** 现有Next.js 16.4.2、React 19、TypeScript、next-intl、Base UI、CSS Modules、Vitest、Playwright；无新依赖。

## 执行与验证

- [x] TDD：先写局部fallback、不等待feed即可返回shell、query改变保持outer key、紧凑骨架与旧分页响应丢弃回归并确认RED。
- [x] GalleryPage保留页面壳，新增feedContent slot；列表/分页移入GalleryFeed。CreationGallery补feed/skeleton上下文包装，原直接items调用兼容。
- [x] GalleryRoute先启动feedPromise，仅await壳数据；内层FeedContent等待结果。保留真实错误/空状态/分页链接及server-rendered作品。
- [x] 精确控制隔离fixture feed请求的gate，验证分类/排序/模型/搜索慢响应期间shell节点与草稿不变、骨架局限feed；侧栏紧凑桌面3列、手机2列；快速切换不被晚到响应覆盖。
- [x] 运行关联与全量单测、覆盖率≥80%、lint/typecheck/build、关键桌面/手机深浅主题E2E；在现有AGENT/PROGRESS与UI实现档案记录证据。

## 边界

用户已要求修复局部加载交互，沿用现有组件/样式，不增加产品入口。当前分类控件走同pathname查询导航，保留其shell；直接跨首页与独立/category路径是不同Next segment，保持SSR/SEO契约。本次不提交、推送、部署、调用真实模型或更改用户会话。
