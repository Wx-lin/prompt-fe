# AIGC 提示词库前端

面向中文用户的免费 AI 图片提示词画廊。前端以 Next.js 服务端渲染公开内容，保留瀑布流与详情弹窗体验，并为每条公开提示词提供可直接访问、可被搜索引擎读取的 URL。

## 项目目标

- 按飞书「UI」文档中的浅色、暗黑和移动端设计稿还原首页、搜索、详情和登录交互。
- 维持 FastAPI 后端独立，通过仅供服务端读取的 `API_BASE_URL` 指向后端 API。
- 公共页面的首屏内容和详情 metadata 在服务端生成；交互增强按需进入客户端组件。
- 将颜色集中到主题变量，切换暗黑配色时只改主题 token，不逐个改组件。
- 代码按功能域拆分，小组件职责明确；重要设计决定和每个完成功能都记录在项目文档。

## 技术栈

| 领域 | 选型 |
| --- | --- |
| 框架 | Next.js App Router、React、TypeScript |
| 交互基座 | Base UI（无预设样式的可访问交互原语） |
| 样式 | CSS Modules、CSS 自定义属性；不使用整套预设视觉组件主题 |
| API | 现有 Python/FastAPI 服务，独立部署 |
| 测试 | Vitest、React Testing Library、Playwright |

## 开发环境

需要 Node.js 20.9 或更高版本及 npm。复制环境模板后配置后端地址：

```bash
cp .env.example .env.local
npm install
npm run dev
```

本地默认前端地址为 `http://localhost:3000`。`npm run dev` 使用 webpack，避开本机已复现的 Turbopack HMR 整页刷新循环；生产构建命令保持不变。开发环境默认显示归档 UI 图裁出的演示素材，保证视觉校准稳定；设置 `AIGC_DEMO_MODE=false` 可查看真实后端内容。production 始终忽略演示素材，仅显示真实内容或空状态。

需要分别连接图库与新版创作服务时，可通过仅服务端读取的 `PROMPT_CREATION_API_BASE_URL` 指定图片资产、解析及会话的上游；留空沿用 `API_BASE_URL`，图库、登录、账户与收藏仍使用原地址，浏览器不能指定该配置。

## 常用检查

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run test:e2e
npm run build
```

详情见 [`AGENT.md`](./AGENT.md) 的接手顺序、[`PROGRESS.md`](./PROGRESS.md) 的开发记录和 [`docs/implementation-plan.md`](./docs/implementation-plan.md) 的分阶段任务。

## 代码目录

```text
src/
  app/                 App Router 页面、路由和全局 CSS
  components/          可复用的基础控件
  features/            gallery、search、prompt-detail、auth 等功能域
  lib/                 API 客户端、配置与纯工具
  types/               API 与领域数据类型
```

组件样式与组件同目录；共享 token 位于 `src/app/theme.css`。业务组件不直接散写主题色值。

## 搜索与筛选交互

首页搜索框打开 Base UI Dialog；回车或点击最近/热门词后关闭输入弹层，导航到 `/?q=关键词` 并在首页瀑布流显示结果。关键词和筛选保留在 URL，支持刷新、重新编辑和清除。搜索结果不使用弹窗。排序和模型菜单使用 Base UI Select，向下展开，支持方向键、Enter、Escape、点击外部关闭和选中标识。

## 首页提示词创作

首页统一输入支持文字想法、上传/粘贴/拖入图片及图库「带图创作」。选图只预览，发送后在同页展开聊天；可以基于上一版继续修改、切换中英文、编辑复制和重开私有历史。搜索仍在图库分类与筛选栏。

会话状态在 locale Provider 内存中保存，搜索与收起不会丢失；刷新后通过服务端历史重开，不在 localStorage 存放图片或提示词。网站沿用邮箱验证码/Google 与 HttpOnly 会话，不新增微信登录。

本功能需要配套后端 API 和 Worker，以及按顺序执行文字迁移 `f15c86be7423`、会话迁移 `27f86a5d9c10`；仅更新前端不能启用真实生成。技术栈、接口边界、本地隔离验证和未验证项见 [实现与本地验证记录](./docs/reference/ui/idea-to-prompt/2026-10-26/网站实现与本地验证记录-v1.md)。
