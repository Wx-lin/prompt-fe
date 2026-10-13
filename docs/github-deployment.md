# GitHub 自动发布主站

推送 `main` 自动执行 lint、typecheck、单元测试、生产构建和腾讯云部署。PR 只执行检查。标准 Ubuntu Runner 云端构建 amd64 镜像并压缩上传，无需服务器访问海外镜像仓库；源码也从同一 commit 导出。

仓库 Actions secrets：

- `DEPLOY_HOST`、`DEPLOY_USER`：现有服务器地址、部署用户。
- `DEPLOY_SSH_KEY`：专用部署私钥，只通过 secret 注入。
- `DEPLOY_KNOWN_HOSTS`：通过已可信连接核实过的服务器 SSH 公钥记录；禁止临时接受未知主机。

Actions variable `NEXT_PUBLIC_GOOGLE_CLIENT_ID` 是公开 OAuth 客户端 ID，必须与生产域名授权一致。站点构建 URL 固定为 `https://aigc-prompt.com`。

服务器需要现有 `/opt/aigc-prompt` Compose、运行中的 frontend/gateway、Docker Compose、rsync、flock、curl，以及部署用户现有的无交互 sudo 权限。流水线不会创建凭据或修改 sudo 配置。

`deploy/update-frontend.sh` 校验所有归档 SHA256，获取跨组件发布锁和旧后端脚本锁，要求至少 2 GiB 可用磁盘。保留旧镜像及源码到独立 release 目录；上线前核对镜像没有被其他发布替换。只更新 frontend 并 reload 网关，失败恢复旧镜像和源码。不会修改数据库。`.env*`、runtime.env 和本地依赖保持服务器原有配置。

首次必须在真实 GitHub Actions 验证构建、上传、镜像切换及公网首页结果；本地语法测试不代表线上发布成功。发布备份保留，不自动清理镜像、卷或其他项目。
