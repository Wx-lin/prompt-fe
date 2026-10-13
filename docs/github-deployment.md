# GitHub 自动发布主站

推送 `main` 自动执行 lint、typecheck、单元测试、生产构建和腾讯云部署。PR 只执行检查。标准 Ubuntu Runner 只构建一次 Next.js Linux standalone 运行包，附带静态资源和 public 后压缩上传；源码也从同一 commit 导出。服务器基于已运行的 Node 24 镜像，彻底替换镜像内 /app，离线构建新镜像，无需从海外仓库拉取基础镜像。

仓库 Actions secrets：

- `DEPLOY_HOST`、`DEPLOY_USER`：现有服务器地址、部署用户。
- `DEPLOY_SSH_KEY`：专用部署私钥，只通过 secret 注入。
- `DEPLOY_KNOWN_HOSTS`：通过已可信连接核实过的服务器 SSH 公钥记录；禁止临时接受未知主机。

Actions variable `NEXT_PUBLIC_GOOGLE_CLIENT_ID` 是公开 OAuth 客户端 ID，必须与生产域名授权一致。站点构建 URL 固定为 `https://aigc-prompt.com`。

服务器需要现有 `/opt/aigc-prompt` Compose、运行中的 frontend/gateway、Docker Compose、rsync、flock、curl，以及部署用户现有的无交互 sudo 权限。流水线不会创建凭据或修改 sudo 配置。

`deploy/update-frontend.sh` 校验所有归档 SHA256、拒绝归档路径越界和链接，获取跨组件发布锁和旧后端脚本锁，要求至少 2 GiB 可用磁盘。保留旧镜像及源码到独立 release 目录；上线前核对镜像没有被其他发布替换。只更新 frontend 并 reload 网关，失败恢复旧镜像和源码。不会修改数据库。`.env*`、runtime.env 和本地依赖保持服务器原有配置。

首次必须在真实 GitHub Actions 验证构建、上传、镜像切换及公网首页结果；本地语法测试不代表线上发布成功。发布备份保留，不自动清理镜像、卷或其他项目。

轻量发布继承现有 Node 24 基础镜像，不自动更新其 Node 版本和系统安全补丁。需要升级基础运行环境时，安排单独的完整基础镜像更新。每次发布验证 Node 主版本和新镜像 commit 标签；运行包必须完整替换旧依赖，禁止合并旧 node_modules。
