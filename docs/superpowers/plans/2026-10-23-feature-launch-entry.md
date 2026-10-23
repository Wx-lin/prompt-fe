# 图片转提示词入口与上新提示实施记录

**Goal:** 按用户确认的深浅主题稿，提供图片＋文字图标、轻量文字入口、NEW 标识及首次可关闭的功能介绍。

**Architecture:** 保留原解析 Dialog、搜索 Popover 和安全 BFF。独立入口组件组合原 Base UI Dialog.Trigger 与非模态 Popover；只用无个人信息的本地关闭标记记录活动状态。

**Tech Stack:** React、Next.js、Base UI、CSS Modules、next-intl、Vitest、Playwright。

## 已确认的设计

- 图标采用图片框和文字短横线，使用 currentColor 矢量；入口为透明背景文字操作，点击高度至少 44px。
- 中文入口为「图片转提示词」，解析面板标题维持「反推提示词」。中英文消息同步。
- 上新气泡包含标题、短说明、上传图片入口和关闭按钮。首次默认首页显示，不抢焦点、不加遮罩。
- 用户关闭、进入功能、开始搜索或操作其他页头控件后，记住关闭，不在结果页和筛选页再次提示。
- 活动结束时间为北京时间 2026-11-07 00:00，届时隐藏气泡与 NEW，保留常驻功能入口。
- 桌面保持参考稿锚定位置；窄屏气泡避开整个页头的导航和筛选，并保持视口内可见。

## 文件职责

- `components/image-prompt-entry.tsx` / `.module.css`：唯一入口、矢量图标、上新 Popover 和响应式样式。
- `lib/announcement.ts`：SSR 快照、活动截止、本地关闭标记、跨标签同步和存储异常降级。
- `image-prompt-launcher.tsx`：继续提供原解析面板，仅替换入口并抑制打开面板时的上新提示。
- `search-trigger-group.tsx` / `search-popover.tsx`：搜索框与入口并列，搜索及过滤场景不再弹出上新提示。
- `site-header.tsx`：在用户开始其他页头任务时结束上新提示，兼容其他 Portal 菜单。
- `messages/{zh,en}.json`：中英文入口及上新文案。
- `e2e/image-prompt-entry.spec.ts`：主题、语言、响应式、关闭记忆、焦点、CTA 与零付费请求验证。

## TDD 与检查

- [x] 首次 E2E RED：旧入口仍为「反推提示词」，缺少已确认的新入口和提示。
- [x] 新组件与状态测试 RED→GREEN，覆盖 SSR、关闭、跨标签同步、活动结束、存储受限及打开工作台。
- [x] 浏览器回归发现受控 Popover 的暂时隐藏不等于关闭；新增 true→false→true 回归，先确认关闭标记为 null，再通过 effect 记住关闭。
- [x] 旧搜索和筛选回归发现上新层遮挡，调整默认画廊显示条件、页头任务关闭与窄屏定位，保留旧回归断言。
- [x] 最终全量单元/覆盖率、lint、typecheck、production build 和浏览器结果写入 PROGRESS.md。

## 边界

仅修改前端展示和活动关闭状态；不修改后端、登录、上传、解析、历史保存接口，不引入依赖。展示测试阻断解析 POST 并确认零模型调用。当前为本地开发验收，不代表已部署生产。
