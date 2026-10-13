# Google 登录发布检查

## 构建配置

浏览器使用 `NEXT_PUBLIC_GOOGLE_CLIENT_ID`，它是公开客户端标识，不是 client secret。
Next.js 在构建时将其写入浏览器 JS；只在容器运行时配置或重启容器不能修复遗漏。
不要上传 `.env.local`，不要向前端注入 client secret。

腾讯云已有 Compose 项目可以合并本仓库 `deploy/compose.google.yml`：

```sh
cd /opt/aigc-prompt
# 在当前 shell 或 Compose 的受保护环境文件中设置公开客户端 ID。
docker compose -f compose.yml -f frontend/deploy/compose.google.yml config --quiet
docker compose -f compose.yml -f frontend/deploy/compose.google.yml build frontend
docker compose -f compose.yml -f frontend/deploy/compose.google.yml up -d --no-deps --no-build frontend
```

合并配置会在变量为空时拒绝继续。直接使用 docker build 时，必须传入
`--build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID` 并在构建进程环境中设置同名变量。
上线前仍须保存旧镜像回滚标签、源码及配置备份，验证构建成功后才切换。

## Google 与后端配置

- Google Web OAuth 客户端的 Authorized JavaScript origins 必须包含完整线上 origin（协议、域名及非默认端口，不含路径）。
- Google 不允许将非 localhost 的裸 IP 注册为 JavaScript origin。当前 IP 入口需要改用用户拥有的 HTTPS 域名，不能仅补客户端 ID 就宣称登录已修复。
- 后端验签使用的 Google client ID 必须与前端一致；不得为通过测试而关闭 token 验签。
- 来源规则：https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow#origin-validation

## 验收

1. 从实际线上登录页定位 JS，确认构建包含预期的公开客户端 ID。
2. 检查 Google 按钮与 SDK 初始化，确认没有 origin/client 配置错误。
3. 使用用户授权的测试账号完成选账号，确认登录接口成功并设置 HttpOnly、Secure 会话 Cookie。
4. 刷新首页仍有登录态；未验证真实账号流程时须明确标注，不能以页面 HTTP 200 替代。
