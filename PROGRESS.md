# 开发进度记录

每完成一个可独立验收的功能，就追加一条记录：目标、实现范围、文件边界、自测命令和实际结果、视觉对照结果、未完成项。不要用计划代替已验证结果。

## 2026-10-10 · Google 登录构建配置修复（未上线）

- 根因：Docker 构建未注入 `NEXT_PUBLIC_GOOGLE_CLIENT_ID`，线上 JS 未包含客户端 ID。本地 `.env.local` 有值不代表 Docker 自动读取。
- 修复：Dockerfile 新增公开客户端 ID 的 ARG/ENV；新增 `deploy/compose.google.yml`，在 Compose 构建时强制要求显式传入该值。没有写入 client secret 或上传本地环境文件。
- 验证：回归测试先失败后通过，2 项部署配置检查通过；其余 35 项测试通过，lint/typecheck 通过。使用上一发布源码快照在本地注入实际公开 ID 后 production build 成功，并确认登录 JS 包含该 ID。未执行修复后的 Docker 构建或线上真实账号登录。
- 发布阻碍：Google 官方明确禁止非 localhost 裸 IP 作为 JavaScript origin；当前 IP 入口需要用户提供正式 HTTPS 域名并配置 Google 授权来源。SSH 连接失效且密钥认证失败，本次未修改线上服务。
- 操作说明：`docs/google-login-deployment.md`。不能将“客户端配置已修复”表述为“线上 Google 登录已恢复”。

## 2026-10-10 · 前端发布 frontend-20261010-1413

- 上线入口：https://62.234.69.93:8443 。仅更新前端，包括超长图过滤；未更新后端、管理端、数据库或采集任务。
- 发布源码：当前工作区独立快照，SHA256 `8773aab878f41d9b25d42297d8d0d989a4143906fb93426de23ba6c21501ba26`；排除环境变量文件、凭据和依赖目录。本地与服务器构建使用同一快照。
- 验证：lint、typecheck、35 项单测、覆盖率阈值、本地/远端 production build 通过；固定 zh-CN 后桌面与手机语言切换 E2E 通过。
- 已有问题：390 px 窄屏文档宽度为 493 px，新版和切换前旧线上版本均复现，相关 2 项 E2E 未通过；本次未修复。全套 E2E、Google/邮箱真实登录未重测。
- 上线后：HTTPS 证书校验通过，首页、health、登录页、真实详情和图片、管理后台及 JS 均返回 200，匿名管理接口返回 401。桌面与手机浏览器页面渲染及已加载图片比例抽检通过，不代表遍历全部内容。
- 新镜像：`sha256:5847cb4c4a85fc8f249f0214854474cbc21faa80197ef024515e3e724f09f126`；容器 restart=0。仅 reload 网关解析新前端容器；其他服务及定时器状态未变。
- 服务器备份与发布记录：`/opt/aigc-prompt/releases/frontend-20261010-1413/`；回滚镜像 `aigc-prompt-frontend:rollback-20261010-1413`，完整操作在该目录 `RELEASE.md`。磁盘剩余约 2.7 GB，未清理其他资产。

## 2026-10-10 · 画廊过滤超长图

- 规则：图片高度严格超过宽度 3 倍时隐藏列表卡片；恰好 3:1 和普通竖图保留，不删除后端数据，不改详情页。
- 实现：`image-visibility.ts` 统一阈值；`PromptCard` 加载后根据自然尺寸上报超长图片；`GalleryGrid` 按图片 URL 排除后重新分列，桌面和移动布局共用规则。所有卡片被过滤时仍保留分页触发点。
- 测试：新增 6 个组件回归用例，覆盖已知尺寸、运行时识别、无尺寸、3:1 边界、重新分列、空列表分页和下一页追加；`npm test` 共 35 项通过。
- 真实浏览器：检查本地真实数据首页及截图，当前 40 张卡片、39 张图片加载成功；已加载图片没有超过 3:1 的长图，卡片框无异常超高，分页触发点存在。没有声称已遍历全部分页或完成手机实机验证。
- 限制：接口没有实际尺寸时需图片加载后才能判断；尺寸未知期间沿用正常占位比例。

## 2026-10-08 · 项目初始化与实施计划

- 在桌面创建独立前端目录 `aigc-prompt-frontend`，技术栈为 Next.js App Router、TypeScript、Base UI 与 CSS Modules。
- 记录项目目标、API 边界、模块分层、TDD/验证方式和后续模型接手顺序；归档 UI 浅色/暗色参考图。
- 建立全局主题变量文件，暗色调色只在 `src/app/theme.css` 维护语义 token。

## 2026-10-08 · 首页画廊和主题

- 目标：复刻最新首页图并在手机使用双列瀑布流。
- 实现：Next 服务端读取分类、提示词与 query filters；开发环境默认用本地演示图稳定视觉，设置 `AIGC_DEMO_MODE=false` 查看 API 作品。用用户首页图裁出十张素材，桌面五列按截图列宽与图片自然比例排布；移动双列。加入可访问主题切换、Base UI 排序/模型筛选、查看/复制/收藏入口。
- 文件：`src/app/page.tsx`、`src/app/theme.css`、`src/features/gallery/`、`src/components/brand/`、`src/components/theme-provider/`、`src/components/select-field/`、`public/demo/`。
- 视觉检查：Playwright 桌面 1536×1024 与移动 390px 截图；桌面五列坐标、Logo/顶栏、卡片比例按最新版截图校准；移动页面无水平溢出。做了截图人工并排检查，尚未做逐像素差分。
- 自测：`npm run test`、`npm run typecheck`、`npm run lint`、`npm run test:e2e`；覆盖率结果记录在最终验收条目。
- 未完成：后端公开提示词为空；生产没有 demo 数据。语言按钮还未切换英文；登录状态首页未接真实用户资料。

## 2026-10-08 · 搜索、详情 SEO 与登录骨架

- 目标：让核心路径可以演示，并为公开详情保留独立可抓取 URL。
- 实现：搜索弹层、热门词、最近搜索 localStorage、搜索结果页；详情 parallel/intercepting route 让站内打开保留画廊，独立 URL SSR 并生成 title/description/canonical/OG；加入 robots 与后端提示词 sitemap；详情复制、下载、分享和移动端底部复制 CTA；邮箱验证码通过 Next Route Handler 转发后端，token 写入 HttpOnly Cookie。
- 文件：`src/app/@modal/`、`src/app/prompt/`、`src/app/search/`、`src/app/login/`、`src/app/api/auth/`、`src/features/search/`、`src/features/prompt-detail/`、`src/features/auth/`、`src/app/robots.ts`、`src/app/sitemap.ts`。
- 自测：Playwright 覆盖直接详情 URL、画廊内详情/搜索/登录弹层、手机 CTA、主题切换及视口溢出。
- 未完成：Google OAuth 客户端未配置；真实点赞/收藏 BFF、搜索联想/分页、登录后用户状态与完整双语需下一阶段接入。后端 OpenAPI 对匿名详情的 Bearer 标记与路由实现存在差异，前端按路由实现的公开行为处理。

## 2026-10-08 · 当前验收结果

- 单元测试：Vitest 4 个文件、10 个用例通过。
- 覆盖率：纳入的纯逻辑工具 statements 97.91%、branches 90.9%、functions 100%、lines 100%。该统计不包含 React 页面/组件；页面关键行为另由浏览器 E2E 覆盖，后续可扩充组件级 coverage。
- Playwright：桌面与移动两个项目共 10 项通过，包含首页图卡、390px 无横向溢出、暗色主题、直达详情、详情/搜索/登录弹层导航和移动 CTA。
- 视觉核验：人工查看 1536×1024 首页、390px 手机首页、详情桌面/手机和暗黑首页截图；首页列宽、卡片比例、Logo、搜索框和导航与参考图逐项校准。尚未执行图像逐像素 diff，因此不把目测结果表述为数学意义上的 100%。
- 静态检查：`npm run lint`、`npm run typecheck`、`npm run build` 和 `git diff --check` 通过；`npm audit --omit=dev` 显示 0 个漏洞。
- 后端：本机 `localhost:8000` 可用；开发默认显示从最新 UI 图裁出的样例，设 `AIGC_DEMO_MODE=false` 可切换 API 真实内容，production 不展示样例。
- 环境：本机 Google Chrome 可用于 Playwright；E2E 通过 `webapp-testing` skill 的 `with_server.py` 启动 Next dev server。

## 2026-10-09 · 搜索从全屏弹层改为锚定下拉面板

- 用户反馈：cmdk 全屏弹层视觉太重、⌘K 快捷键不生效，要求改成类似小红书的「输入框下方内嵌下拉」交互。
- 实现：搜索输入从「点击跳转 /search 路由触发全屏 Dialog」整体改为「header 内常驻 `<input>` + Base UI `Popover`（`modal={false}`）锚定在输入框下方的非模态下拉」，下拉内部沿用 cmdk `Command` 做最近搜索/热门词的键盘可达列表（`shouldFilter={false}`，不做库内过滤）。新增 `SearchPopover`（下拉面板本体）与 `SearchTriggerGroup`（持有 input ref，供 ⌘K/Ctrl+K 直接 `focus()`，不再做路由跳转）。
- 路由收尾：`/search` 不再承载任何 UI，整体 307 重定向到首页（带 query/filters），仅保留旧链接兼容；移除 `@modal/(.)search` 拦截路由、`SearchPage`/`search-page.module.css`、`search-keyboard-shortcut.tsx`。
- 主题适配：下拉面板颜色全部走 `--color-*` 语义 token（`--color-surface`/`--color-border`/`--color-hover` 等），cmdk `[data-selected="true"]` 复用同一套 token 做键盘高亮，深浅主题切换无需额外处理；Popover 过渡用 `[data-starting-style]`/`[data-ending-style]` 做轻量淡入位移。
- 根因修复（意外发现）：E2E 全量失败定位到 Next.js 16 的 `allowedDevOrigins` 跨域保护拦截了 `127.0.0.1` 的 HMR/dev client 资源请求，导致页面 DOM 渲染正常但 React 事件完全没有 hydrate（按钮点击、`toggleTheme` 等全部静默失效，与本次搜索改动无关）。在 `next.config.ts` 显式加入 `allowedDevOrigins: ["127.0.0.1", "localhost"]` 修复；`playwright.config.ts` 的 `baseURL` 支持 `PLAYWRIGHT_BASE_URL` 环境变量覆盖，方便本机端口被占用时切换。
- 文件：`src/features/search/components/search-popover.tsx`、`search-popover.module.css`、`src/features/gallery/components/search-trigger-group.tsx`、`src/features/gallery/components/site-header.tsx`/`.module.css`、`src/app/search/page.tsx`、`next.config.ts`、`playwright.config.ts`、`e2e/search.spec.ts`、`e2e/home.spec.ts`。
- 自测：`npm run typecheck`、`npm run lint`、`npm run build` 均通过；Vitest 6 文件 29 用例通过；Playwright 桌面/手机共 30 项全部通过，覆盖 ⌘K/Ctrl+K 聚焦并打开下拉、Enter 搜索保持非弹层态、Esc 收起下拉不离开页面、空结果、旧 `/search` 链接重定向、筛选保留与详情返回。
- 未完成：移动端下拉面板宽度固定为 `calc(100vw - 24px)`，未做触屏单独验收；热门词仍是前端静态列表，未接后端热搜接口。

## 2026-10-09 · 搜索框迁移至 cmdk（已废弃，见下一条）

- 目标：将搜索弹层内的输入区替换为 cmdk `Command` 组件，保留 Base UI Dialog 做遮罩/Esc/外部关闭，适配深浅主题。
- 实现：安装 `cmdk@1.1.1`；`search-page.tsx` 用 `Command` + `Command.Input` 替换裸 `<form><input>`，最近搜索与热门词改为 `Command.Item`（`role="option"`），通过 `onSelect` 触发导航；传 `shouldFilter={false}` 禁用库内过滤，弹层只负责收集 query；Enter 在 `onKeyDown` 里拦截处理，Esc 直接冒泡到 Base UI Dialog 关闭。
- 主题适配：所有颜色继续引用 `--color-*` 语义 token；`[data-selected="true"]` 属性选择器复用 `--color-hover` 高亮当前键盘焦点项，深浅主题无需额外处理。
- 文件：`src/features/search/components/search-page.tsx`、`src/features/search/components/search-page.module.css`、`e2e/search.spec.ts`（选择器从 `role=textbox` 更新为 `role=combobox`，最近/热门词从 `role=link` 更新为 `role=option`）、`package.json`。
- 自测：`npm run typecheck` 通过；Vitest 6 文件 29 用例通过；`npm run lint` 通过；Playwright 桌面/手机共 28 项全部通过，覆盖 Enter 搜索、Esc 关闭、空白提交留弹层、最近搜索/热门词点击、筛选保留和详情返回。
- 说明：全屏弹层视觉效果不理想，已在下一条记录中改为锚定下拉面板，相关文件已删除，此条仅保留历史脉络。

## 2026-10-09 · 修复选择框与搜索交互

- 用户反馈：排序/模型下拉交互不正确；搜索提交应关闭输入弹层，在首页画廊展示结果。
- 根因：Select 已经使用 Base UI，但默认 `alignItemWithTrigger=true` 让选中项覆盖按钮，且可访问名称放在不产生 DOM 的 Root；搜索错误地导航到被拦截的 `/search?q=` 并在弹层里渲染结果。
- 修复：Base UI Select 显式向下、右对齐、保留边界避让与库内键盘行为，加入选中标识和可伸缩菜单。搜索输入改用 Base UI Dialog 管理焦点、Esc 和外部关闭；回车、最近搜索、热门词全部导航到首页 `/?q=`，保留筛选、关键词、空结果与清除入口。补 `@modal/page.tsx` 清空软导航后的弹层；旧 `/search?q=` 兼容重定向。
- 结果正确性：演示列表应用不可变排序；真实搜索接口暂不支持分类/模型/排序，服务端适配在需要这些条件时按每页 50 项读取完整匹配集后过滤、排序、分页，避免只检查第一页导致误报无结果。普通 latest 搜索仍为单次请求。API 故障显示加载失败，不当成空结果。
- 文件：`src/components/select-field/`、`src/features/search/components/`、`src/features/gallery/components/`、`src/features/gallery/lib/sort-items.ts`、`src/app/page.tsx`、`src/app/search/page.tsx`、`src/app/@modal/`、`src/lib/api/client.ts`、相关单元与 E2E 测试。README、AGENT 和实施计划已同步。
- TDD 证据：先补浏览器测试，实际复现菜单覆盖、缺少名称，以及搜索提交停留在 `/search?q=`；API 边界测试复现跨页匹配/排序失败，再实现修复。
- 自测：Vitest 6 文件、29 用例通过；纳入的纯逻辑与 API 客户端 statements 98.87%、branches 94.66%、functions/lines 100%，不包含 React 页面组件。Playwright 桌面/手机共 28 项通过，覆盖选择/重置、Enter/方向键/Escape/外部关闭、回车搜索、空结果、清除、刷新、旧链接、最近/热门词、筛选保留和详情返回。Lint、typecheck、production build、git diff --check 均通过。
- 视觉检查：人工查看桌面菜单、手机菜单、搜索输入与首页搜索结果截图；额外等待图片完成加载，确认搜索结果图片均有有效自然尺寸。
- 后续边界：组合搜索筛选暂由前端服务端聚合，多页数据越多响应越慢，后端原生支持这些参数后应替换适配；本轮不增加结果分页 UI。

## 2026-10-09 · 修复搜索输入框焦点白框、登录弹层对齐参考图

- 用户反馈：搜索输入框聚焦有多余白色描边；登录弹层样式和 UI 参考图（`docs/reference/ui/light/login-modal.png`）不一致。
- 根因 1：`globals.css` 全局 `input:focus-visible { outline: 2px solid currentColor }` 盖过了搜索输入框自身的 `outline: 0`（两者特指度相同，取决于声明顺序）。
- 修复 1：`search-popover.module.css` 补充 `.input:focus-visible { outline: 0 }` 覆盖规则。
- 根因 2：登录弹层把品牌 Logo 和关闭按钮放在卡片外部固定定位的 header 里，参考图是放在卡片内部顶部，且 Logo 是小号；Google 按钮文案和底部条款样式也有差异。
- 修复 2：`login-page.tsx` 把 header 移入 `.dialog` 内部；`BrandLogo` 新增可选 `size="compact"` prop（默认沿用原尺寸，不影响 `site-header`/`detail-page` 现有调用），登录页头部用紧凑 Logo；Google 按钮文案改为「使用 Google 登录」；补充「无需密码，验证码将发送至你的邮箱」提示；条款文字加下划线链接样式。
- 文件：`src/features/search/components/search-popover.module.css`、`src/features/auth/components/login-page.tsx`/`.module.css`、`src/components/brand/brand-logo.tsx`/`.module.css`。
- 自测：`npm run typecheck`、`npm run lint` 通过；Vitest 6 文件 29 用例通过；Playwright 桌面/手机共 30 项全部通过（含登录/首页/搜索/select-field 全量，无回归）。
- 视觉检查：浏览器实测首页点击登录弹出态，桌面浅色/暗色两种主题下与参考图逐项核对 Logo 位置与尺寸、Google 按钮文案、邮箱表单、提示文案、条款链接样式；均一致。
- 已知边界：直接访问独立 `/login`、`/prompt/[id]` URL（非站内拦截路由）时背后是纯色遮罩，没有画廊内容可模糊——这是这些独立 SSR 路由本身没有画廊数据的既有限制，非本次改动引入，本轮未处理。

## 2026-10-09 · 修复 Google 图标误用文字、补齐独立路由背景

- 用户反馈：登录卡片里 Google 图标是纯蓝色字母 "G"，不是官方图标；刷新 `/login` 页面背景变白（丢了画廊模糊背景）。
- 修复 1：`login-page.tsx` 把 `<span>G</span>` 换成内联四色官方 Google SVG 图标（标准 48×48 viewBox 四色路径）。
- 修复 2：新增 `GalleryBackdrop`（`src/features/gallery/components/gallery-backdrop.tsx`），服务端渲染只读画廊网格作为独立路由的背景；用 `inert` + `pointer-events: none` 保证背景不可交互、不占无障碍树。接入 `src/app/login/page.tsx`，直接访问或刷新 `/login` 现在也有模糊画廊背景，不再是纯色。
- 文件：`src/features/auth/components/login-page.tsx`/`.module.css`、`src/features/gallery/components/gallery-backdrop.tsx`（新增）/`.module.css`（新增）、`src/app/login/page.tsx`。
- 自测：`npm run typecheck`、`npm run lint` 通过；Vitest 6 文件 29 用例通过；Playwright 桌面/手机共 30 项全部通过。
- 视觉检查：浏览器直接访问 `http://localhost:3001/login`（非站内跳转），暗色模式下核对 Google 四色图标与背景画廊模糊效果，均符合预期。
- 后续边界：`/prompt/[id]` 独立 URL 直接访问时仍是纯色背景（同一类问题，未在本轮一并处理，因未被要求）；若需要可复用同一个 `GalleryBackdrop` 组件接入。

## 2026-10-09 · 接入 next-intl 实现中英双语国际化

- 用户诉求：发现语言切换按钮是摆设，要求做成真实可用的中英双语站点，选择方案 B（`next-intl` + `/zh`/`/en` 路由前缀，SEO 友好）。
- 路由改造：`src/app/{page.tsx,login/,search/,prompt/,@modal/}` 整体迁移到 `src/app/[locale]/` 下；根 `src/app/layout.tsx` 收窄为只负责 `<html lang>` 与主题引导脚本的壳层；新建 `src/app/[locale]/layout.tsx` 承担 `generateStaticParams`、按 locale 翻译的 `generateMetadata`、`NextIntlClientProvider` 包裹和 `@modal` 并行路由出口。`middleware.ts` 按 Next.js 16 新规范改名为根目录 `proxy.ts`，用 `next-intl/middleware` 的 `createMiddleware(routing)`。
- 新增 `src/i18n/{routing,navigation,request}.ts`：`routing.ts` 定义 `locales = ["zh","en"]`、`defaultLocale = "zh"`、`localePrefix: "always"`；`navigation.ts` 用 `createNavigation` 导出替代 `next/link`/`next/navigation` 的 `Link`/`redirect`/`usePathname`/`useRouter`，自动带 locale 前缀；`request.ts` 按 `requestLocale` 加载 `messages/{locale}.json`。
- 文案抽取：`messages/zh.json`/`en.json` 覆盖 `metadata`/`brand`/`theme`/`header`/`categories`/`search`/`gallery`/`card`/`detail`/`login` 共 10 个命名空间；全部组件迁移到 `useTranslations()`：`site-header`、`gallery-grid`、`gallery-page`、`prompt-card`、`search-popover`、`login-page`、`detail-page`、`brand-logo`、`theme-toggle`；多个原本的服务端组件为了用 hook 转为 `"use client"`。新增 `language-toggle.tsx`（纯客户端，`useLocale`/`Link locale=`切换，保留当前路径和 query）。
- 路由页面同步：`[locale]/login`、`[locale]/prompt/[id]`、`[locale]/search` 均补上 `generateMetadata` 的 locale 感知翻译与 `setRequestLocale`；`robots.ts`/`sitemap.ts` 升级为多语言感知（disallow 规则兼容 `/*/login`，sitemap 为每个 locale 生成独立 URL 并带 `alternates.languages`）。
- 测试同步：`theme-toggle.test.tsx` 补 `NextIntlClientProvider` 包裹（否则 `useTranslations` 直接抛错）；`e2e/home.spec.ts`、`e2e/search.spec.ts`、`e2e/select-field.spec.ts` 全部 `page.goto` 加 `/zh` 前缀，新增一条语言切换到 `/en` 并验证英文文案的 E2E 用例。
- 自测：`npm run typecheck`、`npm run lint`、`npm run build`（产物含 `/[locale]`、`/[locale]/login`、`/[locale]/prompt/[id]` 等）均通过；Vitest 6 文件 29 用例通过。
- 视觉检查：浏览器实测 `http://localhost:3001/zh`、`/en`，分类导航、排序/模型筛选、详情页、登录页中英文案均正确切换；语言切换按钮保留当前路径和筛选 query。
- 已知边界：`fallbackCategories`（后端分类接口不可用时的兜底）仍是写死中文标签，未做多语言兜底；搜索的热门词列表仍是前端静态文案（随 locale 切换），未接后端热搜接口。

## 2026-10-09 · 切换到真实后端数据、修复画廊点击失效、瀑布流改为按图片真实比例布局

- 用户反馈 1：确认当前首页用的是 Demo 假数据非真实接口；要求切换到真实后端。
  - 根因：`[locale]/page.tsx` 里 `useDemoContent = NODE_ENV !== "production" && AIGC_DEMO_MODE !== "false"`，开发环境默认跳过真实请求直接渲染 `demoPrompts` 写死数据。
  - 修复：新增 `.env.local`（`API_BASE_URL=http://localhost:8000`、`AIGC_DEMO_MODE=false`），重启 dev server 后首页渲染后端 `/api/prompts` 真实返回数据。
- 用户反馈 2：首页点击画廊图片没有打开详情弹窗。
  - 根因：`prompt-card.module.css` 的 `.hoverTools` 悬浮层整体 `inset:0` + `pointer-events:auto`，鼠标悬停时该透明层整体拦截点击，导致底层 `<Link>` 点不到（只有层上的按钮能点）；移动端媒体查询里原本已有「只让按钮可点、容器不拦截」的正确写法，桌面端缺失。
  - 修复：桌面端改为只让 `.bookmark`、`.cardActions` 内的按钮/链接 `pointer-events: auto`，`.hoverTools` 容器本身不再拦截点击；移动端同步精简为一致写法。浏览器实测点击卡片图片，URL 正确变为 `/zh/prompt/{id}`，拦截路由弹窗正常打开。
- 用户反馈 3：详情弹窗图片被拉伸变形不好看，要求参考小红书。
  - 调研结论（浏览器实测小红书网页版 DOM）：瀑布流卡片容器高度不固定，由图片真实宽高比动态算出（`height = width / naturalAspectRatio`），容器形状已贴合图片形状，`object-fit: cover` 几乎不裁切；详情弹窗图片舞台是「宽度固定、高度 `auto` 跟随图片比例撑出来」（`.media-container { width: 979.5px; height: auto }`），而非先画一个固定矩形盒子再 `contain`/`cover` 塞图。
  - 实现 1（瀑布流卡片）：`prompt-card.tsx` 的 `.artworkFrame` 改为 `style={{ aspectRatio }}`，`aspectRatio` 初始取 `imageWidth/imageHeight`（demo 数据有、真实接口暂无则退回 3:4），图片 `onLoad` 读取 `naturalWidth/naturalHeight` 二次校正为精确比例；`<Image>` 从 `width/height` 改为 `fill` + 绝对定位容器。
  - 实现 2（详情弹窗）：`detail-page.module.css` 的 `.dialog` 从固定网格列改为 `flex` 布局，`.artworkPane` 用 `aspect-ratio: var(--art-ratio, 3/4)` 由组件通过内联 CSS 变量动态设置，`.details` 固定宽度 400px 不受图片比例影响；`detail-page.tsx` 同样用 `onLoad` 读取真实宽高比写入 `--art-ratio`，切换图片（上一张/下一张）时先清空再重新测量，避免显示上一张图的残留比例。
  - 效果：浅/深色模式下分别截图核验——方形图正确渲染为方形舞台、近方形的"竖版"海报也正确按真实比例渲染，均无裁切变形，黑边最小化（仅在该图片比例与舞台空间约束冲突时才会出现）。
- 文件：`.env.local`（新增，不入库）、`src/features/gallery/components/prompt-card.tsx`/`.module.css`、`src/features/prompt-detail/components/detail-page.tsx`/`.module.css`。
- 自测：`npm run typecheck`、`npm run lint`、`npm run test`（Vitest 6 文件 29 用例）均通过。
- 视觉检查：浏览器截图核验首页瀑布流错落效果、详情弹窗方形图/近方形图两种真实比例场景、深浅主题下的舞台背景色过渡。
- 已知边界：后端目前暂未返回图片原始宽高字段，前端只能靠 `<img onLoad>` 事后校正（首帧用默认 3:4 占位，图片加载完成后出现一次轻微高度跳动）；如后端未来在 `/api/prompts` 响应里补充 `width`/`height`，可去掉这个首帧占位误差，直接用真实数据算初始比例。

## 2026-10-09 · 画廊接入服务端分页 + 瀑布流无限滚动加载

- 用户反馈：首页瀑布流一次性只请求了第一页（20 条），没有「滚动到底加载下一页」的交互；确认后端 `/api/prompts` 本身已支持 `page`/`page_size`/`has_more` 分页。
- 实现：
  - 新增 `src/app/api/prompts/route.ts`：BFF 代理路由，转发 `getPromptFeed`/`searchPrompts`，供浏览器端增量请求下一页，不直接暴露后端 `API_BASE_URL`。
  - `gallery-grid.tsx` 新增底部哨兵元素（`sentinelRef`/`loadingMore`/`endOfList` props），展示「加载更多中…」/「已经到底啦」状态；新增中英文案 `loadingMore`/`noMoreItems`。
  - `gallery-page.tsx` 改为客户端维护分页状态（`loadedItems`/`page`/`canLoadMore`/`loadingMore`），用 `IntersectionObserver`（`rootMargin: "400px"`）监听哨兵元素，触底自动 `fetch(/api/prompts?...)` 追加下一页；筛选条件/搜索词变化时服务端首屏数据变化，用「渲染期间比较 props 变化重置 state」模式（而非在 `useEffect` 里同步 `setState`，避免 React 的 `set-state-in-effect` lint 告警）重置分页状态。
  - `[locale]/page.tsx` 服务端首屏仍只请求第一页，额外把 `hasMore`/`nextPage` 传给客户端组件作为后续加载起点。
- 自测：`npm run typecheck`、`npm run lint`、`npm run test`（Vitest 6 文件 29 用例）均通过。
- 浏览器验证：真实后端当前 `total=35`，首屏渲染 20 条；滚动到页面底部后自动追加剩余 15 条，总数变为 35；加载完毕后正确显示「已经到底啦」，不再发起多余请求。
- 已知边界：Demo 模式（`AIGC_DEMO_MODE != "false"`）下 `hasMore` 固定为 `false`，不触发滚动加载（demo 数据本身只有 10 条写死数据，设计上无需分页）；搜索结果分页复用同一套 `/api/prompts` 代理，筛选+搜索组合场景仍是后端原有的「拉取全量匹配再本地切片」适配逻辑，详见更早的「修复选择框与搜索交互」记录。

## 2026-10-09 · 修复详情弹窗切图时的布局抖动

- 用户反馈：详情弹窗切换上一张/下一张图片时整个弹窗会抖一下。
- 根因：`showPrevImage`/`showNextImage` 在切换前先 `setAspectRatio(null)`，让 `.artworkPane` 的 `aspect-ratio` 瞬间退回 CSS 默认值 `3/4`，待新图 `onLoad` 完成后才跳到真实比例——造成「先塌缩到默认比例、再跳变到目标比例」两次布局跳动；又因为 `.dialog` 宽度是 `width: fit-content` 完全跟随 `.artworkPane` 反推，所以整个弹窗（含右侧信息栏位置）都跟着一起抖。
- 修复：切换图片时不再清空 `aspectRatio`，保留旧图片比例直到新图片 `onLoad` 返回真实比例再更新，过程只有一次目标明确的尺寸变化；`.artworkPane` 新增 `transition: aspect-ratio 220ms ease`，让比例变化本身平滑过渡而非瞬间跳变，并按 `prefers-reduced-motion: reduce` 关闭该过渡。
- 文件：`src/features/prompt-detail/components/detail-page.tsx`、`detail-page.module.css`。
- 自测：`npm run typecheck`、`npm run lint`、`npm run test`（29/29）均通过。
- 浏览器验证：实测点击"下一张"，舞台宽度从 951px 平滑过渡到 1020px（新图真实比例），过程中不再出现回退到 3:4 的中间抖动帧。

## 2026-10-09 · i18n 路由改为 as-needed（默认语言不带前缀），修复 proxy.ts 文件位置导致中间件完全不执行的问题

- 用户反馈：地址栏里一直带着 `/zh`/`/en`，希望默认语言保持简洁地址栏；同时解释了为什么不能直接改成 localStorage 存语言（会丢失 SEO 收录与 hreflang 能力），确认改用折中方案。
- 改动 1（预期内）：`src/i18n/routing.ts` 的 `localePrefix` 从 `"always"` 改为 `"as-needed"`——默认语言（zh）服务于无前缀的 `/`，仅非默认语言（en）带 `/en` 前缀；同步更新 `sitemap.ts`/`robots.ts`/`[locale]/layout.tsx`/`[locale]/prompt/[id]/page.tsx` 里所有写死 `/${locale}` 的路径拼接逻辑，改为「默认 locale 省略前缀」的 `localizedPath()` 辅助函数；`e2e/{home,search,select-field}.spec.ts` 全部 `/zh` 前缀改回 `/`。
- 意外发现并修复的根因 bug：改完后发现 `/` 访问直接 404，中间件完全没有执行（用临时调试代码验证 `x-debug-middleware-ran` 响应头缺失、`.next/dev/server/middleware-manifest.json` 里 `middleware` 字段是空对象）。根因是 `proxy.ts`（Next.js 16 重命名自 `middleware.ts`）被放在了项目根目录，但本项目使用 `src/` 目录约定（`src/app/`）——Next.js 要求这种项目结构下 `proxy.ts` 必须和 `src/app/` 同级放在 `src/` 目录内，根目录下的 `proxy.ts` 会被静默忽略，不报任何错误、不留痕迹，表现就是「地址重写/重定向全部不生效」。移动到 `src/proxy.ts` 后立即生效（响应头出现 `x-middleware-rewrite: /zh`、`Link: <...>; rel="alternate"; hreflang=...`）。这是此前「always」前缀模式之所以一直能正常工作的原因是：当时所有路径都显式带 `/zh`/`/en`，根本不依赖中间件做任何重写，所以这个潜在 bug 此前被掩盖了，直到改成 `as-needed` 依赖中间件重写根路径才暴露。
- 文件：`src/i18n/routing.ts`、`src/app/sitemap.ts`、`src/app/robots.ts`、`src/app/[locale]/layout.tsx`、`src/app/[locale]/prompt/[id]/page.tsx`、`proxy.ts` → 移动为 `src/proxy.ts`（新增代码注释记录这个坑）、`e2e/home.spec.ts`、`e2e/search.spec.ts`、`e2e/select-field.spec.ts`。
- 自测：`npm run typecheck`、`npm run lint`、`npm run test`（29/29）、`npm run build`（production 产物正确生成 `ƒ Proxy (Middleware)`）均通过。
- 浏览器验证：`curl` 核对 `/` → 200（无前缀，内部 rewrite 到 `/zh`，响应头含 hreflang alternate links）、`/en` → 200、`/zh` → 307 重定向归一化到 `/`、`/login`/`/en/login` → 200；实测点击语言切换按钮，中文首页 `/` ↔ 英文 `/en` 往返跳转均正确，地址栏在默认语言下保持简洁、无 `/zh` 残留。

## 2026-10-09 · 登录态头像/点赞收藏接入真实后端 + 新建收藏列表页 + 头部与分类导航重新设计

- 用户诉求：验证后端已支持 `GET /api/auth/me`、`POST/DELETE /api/prompts/{id}/{like,collect}`、`GET /api/users/me/collects`（均为 `HTTPBearer` 鉴权），要求前端 100% 接入，UI 按参考设计稿还原，兼顾中英文案与深浅主题，不确定的地方先问。
- 登录态与会话：新增 `src/lib/auth/session.ts`（服务端读取 `aigc_session` HttpOnly cookie、调用 `getCurrentUser` 换取用户信息）；`src/lib/api/client.ts` 的 `request()` 支持可选 `accessToken`（带 token 的请求强制 `cache: "no-store"`，避免个性化数据被当成公共数据缓存）；新增 BFF 代理路由 `src/app/api/auth/{me,logout}/route.ts`、`src/app/api/prompts/[id]/{like,collect}/route.ts`、`src/app/api/users/me/collects/route.ts`，浏览器端永远只打本域代理，不直连后端。
- 详情页点赞/收藏：`detail-page.tsx` 新增 `liked/likeCount/collected` 状态（种子值来自 `PromptDetail.is_liked/is_collected`，`GalleryCard` 类型没有则默认 false），`toggleLike()`/`toggleCollect()` 调 BFF 路由，401 时 `router.push("/login")` 复用既有登录拦截弹层，成功后乐观更新本地状态；`[locale]/prompt/[id]/page.tsx` 与 `@modal/(.)prompt/[id]/page.tsx` 同步改为 `getSessionToken()` 后把 token 传给 `getPromptDetail(id, token)`，确保已登录用户首屏就能拿到真实点赞/收藏态（之前漏传，会导致已登录用户看到的还是未点赞未收藏的默认值）。
- 画廊卡片收藏按钮：确认后端 `/api/prompts`（列表接口）不返回 `is_collected`（只有详情接口才有），和用户确认后实现为**仅本次会话内的临时视觉反馈**（`prompt-card.tsx` 的 `collected` state 刷新后重置，不代表真实持久化状态），同样会调用 BFF 路由但不依赖它来初始化状态。
- 新建 `/collections` 我的收藏页：`src/app/[locale]/collections/page.tsx`（未登录 `redirect("/login")`）+ `src/features/collections/components/collections-page.tsx`（复用 `GalleryGrid`，`IntersectionObserver` 触底加载更多，同之前画廊页的分页模式）+ `/api/users/me/collects` BFF 分页代理。
- 头部用户菜单重做：`UserMenu`（`src/features/auth/components/user-menu.tsx`）从「头像+常驻昵称+下拉」改为**只保留一个圆形头像触发器**，昵称/邮箱移入下拉面板顶部的身份区块，面板内容为「身份信息 → 分隔线 → 我的收藏 → 退出登录」，参考主流产品头像菜单的常见模式（触发器极简，身份与操作收进弹层）；`SiteHeader` 头部不再有常驻的「我的收藏」文字链接和分隔线。
- 修复真实数据 bug：首页分类标签出现 `categories.image_edit` 这种未翻译原文——根因是 `messages/{zh,en}.json` 的 `categories` 翻译表还是旧版 7 分类残留（`head_avatar/logo/food/scene` 等），key 和后端当前真实的 8 分类体系（`portrait/avatar/poster/illustration/photography/character/image_edit/workflow`）完全不匹配；修复为与后端一致的 8 个 key 及对应中英文案。
- 分类导航交互重新设计（迭代两版，均经用户截图反馈修正）：
  - 第一版：8 个分类一次性全部等宽下划线 tab 平铺导致溢出截断，改为「全部 + 分类改成胶囊按钮横向可滚动 + 右侧渐隐遮罩」。
  - 第二版（用户给参考截图要求更简洁）：新增 `CategoryNav` 组件（`src/features/gallery/components/category-nav.tsx`），只常驻展示「全部 + 4 个高频分类」，剩余分类收进「全部分类」下拉触发器（复用 Base UI `Popover`，和搜索框弹层同一套组件），下拉内容为无分组的两列网格（后端没有分类分组字段，不编造分组结构）。
  - 第三版（用户再次给参考截图指出样式不对）：改为整条文字项统一放进一个灰色圆角容器（`.nav` 背景 `--color-surface-raised` + `border-radius: 23px`），选中态为黑色加粗 + 底部 2px 短下划线，去掉逐项描边胶囊的样式，和参考图的「推荐 人像 海报 插画 摄影 全部分类」视觉风格一致。
  - 同步隐藏导航行场景：`/collections` 收藏页和搜索结果页（`gallery-page.tsx` 当 `query` 非空时）都不展示分类导航行，因为这两个场景下分类筛选没有意义；`CollectionsRoute` 顺手去掉了不再需要的 `getCategories()` 请求。
- 清理：删掉详情页里一个从未绑定任何逻辑的无效「···」更多操作占位按钮，以及对应废弃的 `detail.more` i18n key（中英文）。
- 文件：`src/lib/auth/session.ts`（新增）、`src/lib/api/client.ts`、`src/app/api/auth/{me,logout}/route.ts`（新增）、`src/app/api/prompts/[id]/{like,collect}/route.ts`（新增）、`src/app/api/users/me/collects/route.ts`（新增）、`src/features/prompt-detail/components/detail-page.tsx`/`.module.css`、`src/app/[locale]/prompt/[id]/page.tsx`、`src/app/[locale]/@modal/(.)prompt/[id]/page.tsx`、`src/features/gallery/components/prompt-card.tsx`/`.module.css`、`src/app/[locale]/collections/page.tsx`（新增）、`src/features/collections/components/collections-page.tsx`/`.module.css`（新增）、`src/features/auth/components/user-menu.tsx`/`.module.css`、`src/features/gallery/components/site-header.tsx`/`.module.css`、`src/features/gallery/components/category-nav.tsx`/`.module.css`（新增）、`src/features/gallery/components/gallery-page.tsx`、`messages/{zh,en}.json`。
- 自测：`npm run typecheck`、`npm run lint`、`npm run test`（Vitest 6 文件 29 用例）、`npm run build`（production 产物正确生成 `/collections`、`/api/prompts/[id]/{like,collect}`、`/api/users/me/collects` 等路由）均通过。
- 真实后端联调验证：用脚本直接生成测试用户 JWT（绕开本地邮件发送限流）核实——未登录调用 `like`/`collect` → `401`；已登录调用 → `204`，`is_liked`/`like_count`/收藏列表均正确更新；`/collections` 未登录 → `307` 到 `/login`，已登录 → `200` 正确渲染标题与空态；详情页 SSR 正确渲染点赞激活态 class，证明 token 转发生效；登出接口 `204` 并清除 cookie。浏览器截图核验：头部仅剩主题切换/中英切换/圆形头像三项，点击头像弹出菜单正确展示身份信息、我的收藏、退出登录；分类导航常驻 4 个高频分类 + 全部分类下拉，下拉网格展示剩余分类且可正常跳转筛选；最终样式与用户提供的参考截图风格一致。
- 已知边界：画廊卡片收藏按钮是会话内临时视觉反馈，刷新后重置（后端列表接口暂不返回 `is_collected`，是用户认可的权衡方案，非 bug）；深浅主题下的像素级逐一比对未做，仅做了默认（浅色）主题下的 HTML/截图级验证。

本地开发访问地址：开发服务器固定监听 **3000** 端口，若该端口被其他进程占用会自动顺延到 **3001**（本机常驻环境下 3000 端口长期被另一进程占用，因此实际稳定访问地址基本是 `http://localhost:3001`）。启动命令：`npm run dev`（在项目根目录 `/Users/wangxinlin/Desktop/aigc-prompt-frontend` 下执行）；启动后终端输出的 `- Local: http://localhost:XXXX` 行是本次实际端口，以终端输出为准。

## 2026-10-13 · 前端体验优化（10.13 待优化内容第一批）

- 主题：外观菜单增加跟随系统、浅色、暗黑三个单选项，默认跟随系统；保留旧的显式选择，系统切换及跨标签修改即时同步，存储不可用时保持当前页面可用。中文、英文及首屏主题脚本同步更新。
- 全局滚动条：统一细滚动条与透明轨道，颜色使用 theme.css 的 `--color-scrollbar`（浅色 #b5b5b5 / 深色 #626262）和旧版 WebKit hover 的 `--color-scrollbar-hover`（浅色 #898989 / 深色 #8a8a8a）；保留分类导航隐藏横向滚动条的既有设计。
- 弹层滚动：详情和登录复用 `src/lib/scroll/use-scroll-lock.ts`；打开时锁定 html/body，最后一个弹层关闭时恢复原状态，支持重叠挂载和 React Strict Mode。内部滚动隔离；低高度登录页使用安全居中和内部滚动，避免锁住背景后内容无法访问。
- 图标：统一 bookmark 图形为五角星，覆盖卡片、详情、用户菜单，已收藏仍实心；第三方来源标识使用 24px 容器、20px 图形与主题文字色，长作者名截断时保持图标尺寸。
- 验证：滚动锁 3 项单测及桌面浏览器 3 项回归先失败后通过；全量 Vitest 71/71、lint、typecheck、生产 build 通过。既有覆盖率统计范围 lines 94.68%、branches 90.52%（不代表全应用覆盖率）。Playwright 桌面与移动尺寸 Chrome 42/42 通过，覆盖主题、弹层滚动、登录、详情、搜索与筛选。只读代码审查未发现阻塞问题。
- 边界：尚未部署、未改飞书勾选状态；移动验证采用 Chromium 设备模拟，未验证真机 iOS Safari。Demo 素材仍有既有旧分类翻译告警，本次未修改分类体系。


## 2026-10-13 · 第二部分：发布作品与模型具体版本

- 新增 `/publish` 上传/预览/删除图片、作品字段及提交审核；`/my-works` 展示待审/已公开/未通过/下架、审核理由及分页。发布入口与用户菜单真实链接，登录成功安全回跳并清除拦截登录弹层。
- BFF 使用 HttpOnly cookie 透传token、Host/Origin校验、JSON128KiB/上传5MiB+multipart开销限制，固定错误及no-store。浏览器联调发现Next内部URL主机名与浏览器Host不同，补测试后校正同源判断。
- 模型按家族分组而保留版本，目录由后端读取；支持首次补充模型版本。版本别名在后端统一，不合并V6/V7等不同版本；搜索直接用原生后端分页筛选。后台新增投稿审核及共用目录选择。
- 验证：主站88项单元/组件、lint/typecheck/build通过；后端133项测试（含真实隔离PostgreSQL）；数据库迁移升级/回退/再次升级通过；后台build/lint通过（6条原有警告）；隔离数据库浏览器投稿+后台通过/拒绝及游客场景8/8，COS/Redis/会话为测试替身。真实COS及线上流程未执行。
- 第一部分已提交为 `2f1baa8`；第二部分保留为工作区变更，尚未部署。新接口和迁移详见后端docs/openapi.json、AGENT.md、PROGRESS.md。

- 最终验收补充：常规桌面/移动Chrome浏览器46/46通过，4个opt-in真实数据库浏览器用例已在隔离服务另跑通过；所有临时schema和联调服务已清理。新投稿核心6模块语句覆盖80.4%（不是全应用覆盖率）。最终复核的ACL rollback过期ORM、清理100条后饥饿、后台PATCH并发3项均修复并验证，限定范围内无剩余阻塞。

## 2026-10-13 GitHub main 自动部署

- `.github/workflows/deploy.yml`：main push 自动 lint/typecheck/test/build 后发布；PR 只检查，不使用生产凭据。部署 SSH 凭据已接入 Actions Secrets。
- `deploy/update-frontend.sh`：传输 Linux standalone 运行包和同提交源码，在已验证 Node 24 基础镜像离线构建；共享发布锁、归档校验、旧镜像状态核对、HTTPS 健康检查及失败回滚。
- 针对公网 SCP 速度采用约 12 MiB 运行包，基础系统补丁不随轻量发布更新，见 docs/github-deployment.md。8 个真实 Bash mock 部署回归通过，前端 95 项测试及 lint/typecheck/build 通过；真实云端最终发布验收进行中。

## 2026-10-13 收藏配色调整

- 账户菜单收藏星标跟随菜单文字颜色，深色主题为白色。
- 首页卡片悬停收藏按钮复用收藏黄色 token；收藏成功后保留图标填充状态。
- 仅修改 CSS；diff 检查通过，ESLint 通过。未做浏览器视觉验收，未提交部署。

## 2026-10-13 未登录头部设置入口

- 未登录头部移除三点菜单，直接复用 ThemeToggleControl 与 LanguageToggle 展示外观和中英文入口。
- 已登录 UserMenu 与账户内偏好设置保持原样，语言切换保留路径和查询参数。
- TypeScript、ESLint 和相关组件测试通过；未进行浏览器视觉验收，未提交部署。

## 2026-10-14 十二分类接入（本地实现，待迁移与部署）

- 复用现有 CategoryNav、Base UI Select/SelectOptions 与主题样式；固定推荐、人像、头像、海报、插画入口，全部分类提供十二项、公开数量与零库存“暂无内容”禁选。手机保留既有横向导航与可滚动选择列表。推荐仍通过现有排序逻辑，不新增分类 key。
- 分类切换继续保留关键词、模型、排序并重置分页；搜索也显示筛选导航。组合条件无结果可清除筛选并保留关键词。摄影、图片编辑、workflow 旧 URL 保留查询条件并显示调整提示，不加入新目录或投稿。
- 十二分类 fallback 与中英文名称同步需求目录，增加目录一致性测试；详情用新分类名称；投稿十二项包含零库存，排除旧分类。SelectOptions 增加 disabled 支持，沿用既有控件。
- 核心文件：gallery/data/categories.ts、gallery/components/category-nav.tsx/gallery-page.tsx、select-field/select-options、publish-form、detail-page、messages/{zh,en}.json。用户已有 header/menu/card 样式修改保留。
- 验证：先 RED 后 GREEN；全量 141 个测试通过，随后新增清除筛选测试及该文件 12 个测试通过（共 142 个）；lint、typecheck、Turbopack 生产构建通过。分类导航语句/函数/行覆盖率 100%、分支 93.75%。本地无数据库 fixture 下桌面/手机 2 个 E2E 通过，覆盖中英、深浅、十二选项、零库存禁选、组合条件/分页及旧链接提示。
- 边界：浏览器测试验证界面及参数传递，真实数据库公开计数/兼容集合/组合分页由后端集成验证；尚未修改生产数据、提交或部署。后端新目录必须与已确认迁移和兼容集合一起上线。新 E2E 需运行具有十二分类目录与商品零库存的隔离数据。

分类测试稳定性复核：Select 的 portal 在 mounted/定位完成后才进入可访问树，改用 findByRole 等待实际选项可访问，不通过 hidden 绕过界面状态。发布脚本测试执行完整 30 次健康探测及子进程，仅该组超时设 15 秒，保留失败/回滚断言；全量 142 个测试连续两次通过（22.55 秒、28.87 秒）。

- 2026-10-14 父任务集成验收：主站142单测全量通过，lint/typecheck/生产build通过。连接真实FastAPI和本机PostgreSQL随机schema，分类主站与后台桌面/手机4 E2E通过，后台审核实际提交零库存branding成功；覆盖旧分类编辑展示、12项目录、零库存、双语深浅及保留筛选。新增e2e/admin-categories.spec.ts与后端tests/category_e2e_app.py为可复现本机fixture；测试服务与schema已清理，生产未发布。

## 2026-10-14 收藏配色修正

- 修正此前误解：卡片收藏按钮透明背景，未收藏白色线框，收藏成功后黄色填充图标。
- 账户菜单星标取消填充，跟随文字颜色，深色为白色线框、浅色为深色线框。
- 不改变收藏请求或登录菜单交互。CSS diff 检查及 ESLint 通过；本次尚未提交部署。


## 2026-10-14 X 原文入口

- 作者来源组件复用现有外链、平台图标与样式，支持 HTTPS 的 x.com / twitter.com 原帖，展示 X 标识和“查看原文”。保留精确域名/子域校验、noopener noreferrer，中英文文案同步。
- 验证：相关28项测试及全量158项测试、lint/typecheck/生产build通过，npm audit零漏洞，独立提交前审阅无阻断。公网旧版缺少X原文锚点，部署后需验证真实作品详情与图标。
- 用户已授权提交并部署此修复；不包含工作区收藏配色修改。


## 2026-10-15 撤回内容详情缓存修复

- 实测后台撤回与公开 API 404 已生效，但前端匿名详情仍可从旧持久缓存显示完整内容。
- 仅详情请求绕过持久缓存；保留其他公共列表缓存、登录态隔离、请求超时、现有页面与组件。
- 验证：回归测试先 RED 后 GREEN；全量159项测试、lint、typecheck、生产build通过。真实生产构建连接本地可切换API fixture，先访问成功200，再撤回立即404且正文消失、noindex；独立审阅无阻断。
- 用户已授权提交部署本修复；保留工作区其他修改，上线后逐条验证撤回内容的公开详情。

## 2026-10-16 模型筛选与清除搜索

- 后端模型目录增加已知模型及版本格式校验，隐藏非模型标签；保留原始作品标签，不直接删除未知模型。新模型需维护允许目录。
- 搜索框 × 清除关键词并导航到保留分类、模型和排序的结果；URL 关键词变化同步输入框，覆盖浏览器历史导航。
- 新增搜索组件回归测试；前端 161 项测试、lint、typecheck、production build 通过。后端标签/目录 18 项测试及 Ruff 通过。尚未提交部署。

## 2026-10-16 分享复制当前 URL

- 详情分享按钮统一复制点击时 window.location.href，保留路径、查询参数及 hash，不再调用系统分享面板。
- 保留成功后的“链接已复制”反馈；复制失败不会显示成功。
- 回归测试先确认原实现会调用系统分享导致失败，修改后通过；ESLint、TypeScript、diff 检查通过。尚未提交部署。

## 2026-10-16 SEO 基础（本地实现，未提交部署）

- 首页 metadata/H1/简介覆盖 AI 提示词、文生图、AI 绘图/生图；所有文案中英同步，复用现有画廊摘要、Link 和主题 token。
- 提取 GalleryRoute 共享服务端加载，新增 `/category/{key}` 分类落地页；首页公开分类链接与 sitemap 仅列有内容的分类。保留旧查询筛选导航。
- 服务端读取真实 page，分页页面独立 canonical，并与现有无限滚动共存提供下一页锚点；任意搜索与筛选查询 noindex/follow。
- 详情添加对应作品 hreflang/x-default 和安全 JSON-LD。sitemap 取消 250 条上限，latest 顺序、去重、无进展与上游失败明确报错，避免缓存仅首页或部分作品的成功响应。
- 正式域名默认值统一为 HTTPS；支持 Google/Baidu 可选 HTML 验证环境变量，`.env.example` 与实施计划已说明尚需账号授权，未伪造正式验证码。
- TDD：新增 SEO helper 缺失与 SSR page=3 测试先失败；旧 sitemap 对 300 作品仅产生 500 个详情 URL、吞上游错误、重复分页三个测试先 RED，实现后 GREEN。全量181测试通过，当前项目配置覆盖率语句92.85%、分支91.48%、函数92.85%、行94.04%；lint/typecheck/生产 build 通过。独立 SEO 模块覆盖率及生产浏览器验收结果待追加。
- 边界：本地实现不等于搜索引擎已收录；未进行推送、部署、站长平台账号授权。单 sitemap 达50000 URL 将明确失败，届时需拆分 sitemap 索引；页码分页面对同步新增/撤回可能在同一轮采集中产生变化，去重防重复但不提供数据库快照。
- 追加验收：独立新 SEO/sitemap 模块覆盖率语句95.65%、分支92.15%、函数/行100%，并纳入后续默认覆盖率范围。生产构建连接本机8039无数据库fixture，在桌面/手机均通过2 E2E，覆盖深浅无横向溢出、首页H1与分类链接、SSR第二页21–40和下一页、分类canonical、搜索noindex、94项sitemap、无效分类404、详情语言替代和JSON-LD、两个验证meta标签。已查看手机截图。最初测试构建因本机`.env.local`把站源编译为localhost而失败，按CI同样方式在构建时注入正式域名后通过，未修改本机私有环境文件。
- 最终默认覆盖率（已包含SEO新增模块）：181/181测试通过；语句93.75%、分支91.72%、函数95.55%、行95.72%，diff whitespace检查通过。

## 2026-10-18 恢复首页视觉布局并保留 SEO

- 按用户要求移除 SEO 新增的可见介绍段落和重复分类链接，导航后直接显示画廊；首页与分类 H1 保留辅助阅读语义，不占布局空间。
- metadata、canonical、hreflang、详情 JSON-LD、分类落地页、sitemap、robots、站长验证和分页链接保留；分类发现由 sitemap 与原有导航承担。AGENT.md 明确 SEO 不得未经确认改变布局。
- 回归测试先确认旧代码仍显示重复导航而失败，修复后全量 181 测试、lint、typecheck、production build、diff 检查通过；本地无数据库 fixture 的桌面/手机 SEO E2E 2 项通过，覆盖深浅主题及分页、分类 canonical、搜索 noindex、sitemap 和详情结构化数据。已查看桌面截图；独立审查无阻塞问题。尚未提交或部署。

## 2026-10-18 移除详情采集统一说明

- 详情页不再显示“采集收录，未经本平台逐条出图验证；原文与效果图来自所标注来源。提示词已整理为中文。”这段导入说明。仅过滤这段固定文本，保留作者实际说明、提示词和来源入口，不修改数据库。
- 组件回归测试先 RED 再 GREEN，覆盖纯说明隐藏及混合说明保留；2 项相关测试、lint、typecheck、diff 检查通过。尚未提交部署，未进行线上验收。

## 2026-10-19 匿名浏览器访客统计（本地实现，未部署）

- 根布局挂载不可见 VisitTracker：页面进入、路由切换、恢复可见/BFCache 时同源空体上报；30 分钟内同路径抑制重复，跨北京时间自然日重新上报，过滤常见 crawler。无新增视觉、依赖或本地存储，不上传路径、referrer、邮箱或登录标识。
- 新增 `/api/analytics/visit` BFF：校验浏览器 Host/Origin 与 Fetch-Site，流式限制请求体 64 字节且拒绝非空体；读取/生成独立 UUID 第一方 HttpOnly Cookie（Lax、生产 Secure、365 天），仅将 SHA256 hash 发往内部后端，3 秒超时和 no-store。上游失败返回通用 503，仍保留稳定 Cookie，不影响登录 Cookie 或页面。
- 核心文件：`src/app/api/analytics/visit/route.ts`、`src/lib/analytics/identity.ts`、`src/components/visit-tracker/visit-tracker.tsx`、`src/app/layout.tsx`；没有现有隐私政策页面可补充，未擅自新增可见页面。
- TDD：新路由/组件测试先因缺少实现 RED，再 GREEN；8 项专项测试覆盖来源/请求体、hash/私密 Cookie、上游失败、StrictMode 去重、事件清理和北京午夜。新模块覆盖率语句96.42%、分支91.66%、函数100%、行97.87%；全量190测试、lint、typecheck、production build、diff检查通过。浏览器联调由父任务追加；未提交、推送或修改生产。
- 安全审阅补充：首个 Cookie 响应完成前抑制重叠请求，防止快速切路由生成两个标识；浏览器请求设置 `referrerPolicy: no-referrer`。新增并发回归后专项 9 测试、typecheck、相关 ESLint 通过；最终专项覆盖率语句96.61%、分支92.1%、函数100%、行97.95%。完整 build/190 测试结果为此补充前执行，父任务负责最终集成浏览器及全量复验。

## 2026-10-21 投稿分类校验修复（本地完成，未部署）

- “表情包与贴纸”等 7 个现行分类被投稿 BFF 的旧 8 分类白名单误拦，`POST /api/submissions` 在转发后端前返回 400，表单统一显示“提交失败”。模型 `GPT Image 2.0` 与图片上传不受此次缺陷影响。
- `src/lib/submissions/validation.ts` 复用发布表单已有的 `isCurrentCategory()`，统一接受当前 12 分类、拒绝旧分类和非字符串值，移除重复白名单。
- TDD：分类单元及真实 POST handler 回归先出现 21 项预期失败，修复后专项 66 项全部通过，校验模块语句/分支/函数/行覆盖率均 100%；全量 249 项测试通过，默认覆盖率语句 93.75%、分支 91.72%、函数 95.55%、行 95.72%。lint、typecheck、生产构建和独立代码/安全审查通过。
- 生产构建连接本机隔离 PostgreSQL fixture，桌面/手机 2 项 E2E 通过：上传→选择表情包与贴纸→提交→核对落库 `category=sticker`→待审不可公开→测试管理员批准→公开详情可读。COS、Redis、会话使用测试替身，不代表生产账户/COS 验收；未提交、推送或部署。
- 本机 Next 16.4 会将 `127.0.0.1` 归一化为 `localhost`，直接以 `--hostname 127.0.0.1` 启动会让默认中文 rewrite 变成外部请求并循环跳转。测试服务使用 `NODE_OPTIONS=--dns-result-order=ipv4first`，配合 `npm run start -- --hostname localhost --port 3110`；Playwright 继续使用 `http://127.0.0.1:3110`。无需改动产品路由。
