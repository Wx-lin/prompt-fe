# GitHub 自动发布主站

推送 `main` 自动执行 lint、typecheck、单元测试、生产构建和腾讯云部署。PR 只执行检查。标准 Ubuntu Runner 只构建一次 Next.js Linux standalone 运行包，附带静态资源和 public 后压缩上传；源码也从同一 commit 导出。服务器基于固定身份的官方 Node 24 基础镜像离线构建新镜像；基础镜像不存在时由 CI 打包上传并在服务器验证，存在时复用。

仓库 Actions secrets：

- `DEPLOY_HOST`、`DEPLOY_USER`：现有服务器地址、部署用户。
- `DEPLOY_SSH_KEY`：专用部署私钥，只通过 secret 注入。
- `DEPLOY_KNOWN_HOSTS`：通过已可信连接核实过的服务器 SSH 公钥记录；禁止临时接受未知主机。

Actions variable `NEXT_PUBLIC_GOOGLE_CLIENT_ID` 是公开 OAuth 客户端 ID，必须与生产域名授权一致。站点构建 URL 固定为 `https://aigc-prompt.com`。

服务器需要现有 `/opt/aigc-prompt` Compose、运行中的 frontend/gateway、Docker Compose、rsync、flock、curl，以及部署用户现有的无交互 sudo 权限。流水线不会创建凭据或修改 sudo 配置。

`deploy/update-frontend.sh` 校验所有归档 SHA256、拒绝归档路径越界和链接，获取跨组件发布锁和旧后端脚本锁，上传前和服务器处理前按运行包、源码、旧源码备份、基础镜像和 2 GiB 余量估算峰值磁盘使用；Docker 数据目录和发布目录不在同一文件系统时拒绝发布。此估算仍需在真实 Docker 发布环境核实。保留旧镜像及源码到独立 release 目录；上线前核对镜像没有被其他发布替换。只更新 frontend 并 reload 网关，失败恢复旧镜像和源码。不会修改数据库。`.env*`、runtime.env 和本地依赖保持服务器原有配置。

首次必须在真实 GitHub Actions 验证构建、上传、镜像切换及公网首页结果；本地语法测试不代表线上发布成功。发布备份保留，不自动清理镜像、卷或其他项目。

轻量发布固定使用 `deploy/runtime-base.env` 指定的官方 Node 24.21.0 linux/amd64 基础镜像，不自动更新 Node 或系统安全补丁。需要升级运行环境时，单独审查和验证固定 digest、镜像 ID 及兼容性。每次发布核对 Node 版本、架构、node 用户及新镜像 commit 标签；首次上传的无标签基础镜像归档须通过固定镜像 ID 和逐层哈希校验。保留的旧版镜像和构建缓存不会自动释放，新版镜像更小不代表磁盘马上增加可用空间。
