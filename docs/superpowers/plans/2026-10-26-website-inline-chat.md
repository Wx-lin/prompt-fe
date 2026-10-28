# 网站首页与同页提示词聊天实施计划

> **For agentic workers:** 按职责分工并行实施，TDD 后集成审查；用户已在本聊天批准开发，无需再次选择执行方式。

**Goal:** 按12首页图与08同页交互实现文字/图片统一输入、真实连续追问、版本、双语编辑复制与私有历史。

**Architecture:** 保留Next服务端公开图库与SEO、既有HttpOnly认证和BFF；locale层客户端Provider在筛选导航外持有私密会话状态。首页发送后原位展开右侧聊天，图库保留锚点。后端以现有耐久分析任务承载每一轮，增加会话关联及服务器冻结的上一版有效结果上下文，复用队列、预算、租约和发送栅栏。

**Tech Stack:** Next.js16.4.2、React19、TypeScript、Base UI、Lucide、CSS Modules/现有主题token；FastAPI、PostgreSQL、Redis、SQLAlchemy/Alembic、现有独立Worker。无新增UI框架。

## 验收与边界

- 顶部文案精确「提示词创作」，Logo不变，页头无通栏线；创作框上提与28px圆角。搜索位于图库分类栏右侧，不恢复两个分区大标题。
- 一处输入接文字、上传/粘贴/拖入图片或带图素材；选图只预览，发送才上传和生成。
- 同页桌面约60/40图库/聊天；折叠恢复图库与浏览锚点；窄屏同页纵向，深浅/中英兼容。
- 第一轮立即进入真实状态；后续按上一版上下文生成新版本，显示并可回看旧版本。每张卡的语言、编辑、复制和保存对应其版本。
- 失败保留输入、显式重试；未知派发结果只查询，不自动重新调用。保持幂等与防重；账号切换/401清理私密内容并栅栏晚到响应。
- 模型调用只用隔离本地替身验证；本轮不部署、推送、生产迁移或使用真实付费模型。既有小程序合同保持兼容。

## Task 1: 后端耐久会话（backend代理）

- [x] RED：真实隔离PG/Redis覆盖首轮文字/图片+文字、同会话续写、跨用户/父版本冲突、幂等、防并发、删除/到期、dispatch后删除与unknown。
- [x] GREEN：扩展PromptAnalysis的conversation_id/parent/user_message/version/context快照，保留旧任务；新增会话create/list/detail/send/retry/delete与受控公开作品图片导入。
- [x] Worker使用chat-v1模板，读取服务器冻结的有效人工编辑结果，继续现有租约/预算/队列，不重复派发。
- [x] migration接f15c86be7423，不扩大部署自动迁移白名单；验证升级和安全降级边界。

## Task 2: 类型、BFF与客户端（client代理）

- [x] RED：会话响应/请求验证、同源写保护、私有响应、受控from-prompt、超限、非法父版本与幂等头。
- [x] GREEN：新增types/prompt-conversation.ts、features/prompt-creation/lib/client.ts和app/api/prompt-conversations路由；更新旧analysis parser兼容文字/nullable asset。
- [x] API约定：create/send/retry返回ConversationTurn；detail返回{id,title,created_at,updated_at,turns}；history返回items与cursor pagination；删除204。正文使用安全envelope与受控错误代码。

## Task 3: 首页与图库布局（layout代理）

- [x] RED：自定义品牌、搜索位置、composer/panel slots、紧凑三列、卡片带图按钮与原详情链接并存。
- [x] GREEN：GalleryPage props扩展creationComposer/chatPanel/chatOpen/onUseReference/activeReferenceId，抽GalleryToolbar；BrandLogo新增optional label默认旧行为。
- [x] 不卸载图库，恢复可见作品锚点；window原滚动/分页继续，右栏sticky独立内容滚动。窄屏纵向。

## Task 4: 私密会话状态与界面（根代理）

- [x] RED：先测试createConversationWorkflow的文本首轮/图片发送/续写、同key重试、状态查询、身份清理、草稿保留与编辑revision；再实现。
- [x] GREEN：lib/workflow.ts负责内存私密状态与请求栅栏、use-workflow.ts负责React订阅；不使用浏览器持久化保存图片/提示词/身份。
- [x] components/creation-provider.tsx在locale层包装；creation-gallery.tsx同步当前user并提供layout slots；composer/result/thread/history使用现有按钮、Tabs/可访问原语、主题和上传校验。
- [x] 初次匿名发送可原位复用LoginPage，认证成功确认/api/auth/me后继续；过期身份401清空旧输入，避免跨账号自动重发。
- [x] result编辑只改当前语言；取消不保存，保存失败保留草稿；新建/切历史/离开前保护未保存编辑。复制只取当前卡当前语言。
- [x] 中英文完整翻译，隐私说明与技术栈/运行说明写入现有项目文档。

## Task 5: 集成和走查

- [x] 前端lint/typecheck/全量614单测与覆盖率、production build；独立新模块覆盖率见最终验证记录，不把其他模块覆盖率当新模块证据。
- [x] 后端Ruff/全量780测试与新模块覆盖率；迁移在隔离数据库验证。
- [x] Playwright连接隔离PG/Redis和假供应商，真实走BFF→API→Worker→历史/编辑；删除由组件与隔离SQL/API测试覆盖。没有生产图片或实际模型调用。
- [x] 桌面浅/暗、中英、390px无横溢出；搜索/分类/详情、键盘/焦点、折叠/恢复/账号切换浏览器回归；分页由原组件单测和会话游标集成测试覆盖。
- [x] 用实际截图与原稿对照；48项浏览器验证及准确未验证边界已记录，不以HTTP200/构建代替功能验收。

## 分工与现有改动保护

前端原有未跟踪设计稿与e2e __pycache__保留；当前分支feat/website-inline-prompt-chat。后端feat/idea-to-prompt-miniprogram上的文字生成未提交改动为本轮基线，必须完整保留；不重置/清理用户文件，不输出密钥。

## 2026-10-27 输入与动效细化

用户明确要求移除textarea拖拽角与「支持粘贴」文字，按ChatGPT输入习惯优化换行及侧栏过渡。保留图片粘贴能力，输入高度从CSS最小高度自动增长，最多208px后内部滚动，删减内容可缩回，宽度变化重测。

桌面Enter发送、Shift+Enter换行，兼容Ctrl/⌘+Enter；移动粗指针Enter保留换行并由按钮发送。IME组合输入、Safari229及重复Enter不提交。快捷键说明仅聚焦时低调显示并作为可访问描述。

复用现有组件与主题、不加动效依赖。侧栏展开/收起约240ms，按钮/焦点/预览/新消息160–180ms、输入高度140ms；减少动画偏好直接完成。只保留公开的布局数值，不缓存卸载的私密聊天节点。当前3137继续读取真实API，不以模型替身代替用户预览；新聊天接口未部署的边界不变。
