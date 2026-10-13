# CNB 免费额度接入：主站

已完成 CNB 登录、实名认证及私有仓库创建：https://cnb.cool/wx-lin-aigc-prompt/frontend 。代码上传、云端构建和生产发布尚未完成。

## 前提与费用

1. 用户完成 CNB 登录，建立组织与**私有**前端仓库；导入代码前确认可见性。
2. 仅使用组织默认免费额度，不绑定预算、不购买资源包、不提高用量上限。
   当前标准免费额度为每个顶级组织共享每月构建 160 核时、Git 与制品存储各 100 GiB；以组织账单页面为准。
   镜像保留会占用制品空间，定期清理无用候选镜像，保留线上版本和回滚版本。
3. 仓库保护 main，只允许可信管理员修改流水线/手动发布镜像。运行时数据库、Redis、COS、JWT
   和 SSH 密钥不进入此配置，不向 PR 注入生产凭据。

## 操作

- 构建节点固定 4 核 / 8 GiB，防止默认选用更大规格；构建核时按实际运行累计。
- `.cnb.yml` 的 main 与其他分支兜底 push / pull_request 只运行 npm ci、lint、typecheck、单元和组件测试。
- main 分支详情页点击“构建主站镜像”，输入 Google **公开** Web OAuth client ID。
  缺少客户端 ID 会在构建前失败，不会生成缺少登录配置的候选镜像。
- 手动流水线重复执行检查后构建 linux/amd64 镜像，站点地址固定为 https://aigc-prompt.com。
  CNB 的 docker service 提供制品库认证，无需创建或提交 registry token。
- 每个镜像使用 `sha-完整提交SHA-构建流水号` 标签，避免同一提交重复构建覆盖旧候选。
  发布阶段以后使用输出的 `仓库@sha256:...` 固定摘要；标签本身不是制品库不可变策略。
- 此流水线**不部署**。生产服务器继续用现有 Compose，后续单独接入人工发布、备份、
  健康检查和回滚。真实云端权限、平台配置和生产登录仍须验证。

## 官方依据

- [触发规则](https://docs.cnb.cool/zh/build/trigger-rule.html)
- [手动按钮与权限](https://docs.cnb.cool/zh/build/web-trigger.html)
- [Docker service 与制品推送](https://docs.cnb.cool/zh/build/showcase/docker-build-and-push-to-cnb-artifact.html)
- [免费额度与计费](https://docs.cnb.cool/zh/pricing.html)
