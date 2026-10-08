# AIGC 提示词库前端

面向中文用户的免费 AI 图片提示词画廊。前端以 Next.js 服务端渲染公开内容，保留瀑布流与详情弹窗体验，并为每条公开提示词提供可直接访问、可被搜索引擎读取的 URL。

## 项目目标

- 按飞书「UI」文档中的浅色、暗黑和移动端设计稿还原首页、搜索、详情和登录交互。
- 维持 FastAPI 后端独立，通过 `NEXT_PUBLIC_API_BASE_URL` 指向后端 API。
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

本地默认前端地址为 `http://localhost:3000`。若后端尚无已发布的提示词数据，首页会显示规范定义的空状态；开发演示数据仅作为独立 fixture，不伪装成后端真实内容。

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
