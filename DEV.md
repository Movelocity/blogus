# 开发指南

## Make 命令

```bash
make help            # 查看所有可用命令
make install         # 安装依赖
make dev             # 启动前端 + 后端
make dev-client      # 仅启动 Vite
make dev-server      # 仅启动 Fastify
make build           # 构建所有包
make start           # 启动生产服务（需先 build）
make typecheck       # 类型检查
make install-cli     # 构建并全局安装 blogus-cli（改动 CLI 源码后重新执行）
make services-up     # 启动 PostgreSQL、Redis、MinIO
make services-down   # 停止容器
make services-logs   # 查看容器日志
```

## CLI 开发工作流

构建并安装 `blogus-cli` 到全局，之后直接使用：

```bash
make install-cli

blogus-cli post list
blogus-cli post create -t "Hello Blogus" -f ./draft.md -e "短摘要" --tags "blogus,release" --folder "项目札记"
blogus-cli post edit <post-id> --cover /uploads/2026/06/cover.png --tags "blogus,release" --folder "项目札记"
blogus-cli post edit <post-id> --folder ""   # 传空串把文章移回根目录
blogus-cli folder list
blogus-cli folder create "项目札记"          # post --folder 按目录名解析，需先创建
blogus-cli folder rename <folder-id> "新名字"
blogus-cli folder delete <folder-id>         # 组内文章自动移回根目录
blogus-cli post publish <post-id>
blogus-cli upload ./cover.png
blogus-cli register -e admin@example.com -p blogus-dev-password
blogus-cli invite create -c team-code
blogus-cli register -e writer@example.com -p blogus-dev-password -i team-code
```

修改 CLI 源码后重新执行 `make install-cli` 即可更新。

## 局域网访问

`make dev` 启动后，Vite 会监听 `0.0.0.0:5177`，终端里除 `Local` 外还会显示 `Network` 地址（如 `http://192.168.x.x:5177`）。同一局域网内的手机或其它设备可直接用该地址访问；API 请求仍经 Vite 代理到本机后端，无需额外暴露 `3009` 端口。

开发模式下 CORS 会回显实际请求来源，因此无论用 `127.0.0.1` 还是局域网 IP 打开前端都能正常登录。

## 端口和依赖服务

| 项目 | 默认值 | 说明 |
| --- | --- | --- |
| Web 开发服务 | `http://127.0.0.1:5177` | Vite dev server；`/api` 代理到 API 服务；启动时会同时输出局域网地址（`Network`） |
| API 服务 | `http://127.0.0.1:3009` | Fastify；由 `HOST`、`PORT` 配置；开发模式下仅本机访问即可（浏览器经 Vite 代理） |
| PostgreSQL | `localhost:5633` | Docker Compose 暴露；`DATABASE_URL` 默认连接这里 |
| Redis | `localhost:6379` | 当前只记录配置，后续阶段接入更多会话/队列能力 |
| MinIO API | `localhost:9010` | 可选；仅 `STORAGE_DRIVER=minio` 且启用 `minio` profile 时使用 |
| MinIO Console | `localhost:9011` | 可选管理控制台 |

## 环境变量

关键环境变量记录在 `.env.example`：

- `HOST`、`PORT`、`CLIENT_ORIGIN`：API 监听地址和 CORS 来源。
- `SERVE_CLIENT`：设为 `true` 时后端托管 `client/dist/`，生产单进程部署用。
- `DATABASE_URL`、`REDIS_URL`：后端依赖服务连接地址。
- `JWT_SECRET`、`JWT_EXPIRY`、`JWT_REFRESH_EXPIRY`：JWT 和 cookie 会话配置。
- `BLOGUS_DEFAULT_INVITE_CODE`：默认测试邀请码；非生产环境不配置时默认使用 `blogus-dev-invite`，生产环境仅显式配置时生效。
- `BLOGUS_ENABLE_DEV_LOGIN`：开发便捷登录开关；生产环境强制关闭。
- `STORAGE_DRIVER`：上传存储后端，支持 `local` 和 `minio`。
- `UPLOAD_DIR`、`UPLOAD_PUBLIC_PATH`：本地上传目录和公开访问路径。
- `MINIO_*`：MinIO/S3 兼容存储配置，仅 MinIO 模式使用。
- `UPLOAD_MAX_SIZE_MB`、`UPLOAD_CHUNK_SIZE_MB`：上传大小和分片配置。
- `BLOGUS_DATA_DIR`：Docker Compose 服务数据目录。

## 配置说明

- API 服务通过 `DATABASE_URL` 连接 PostgreSQL。
- 开发默认使用 `localhost:5633` 上的 PostgreSQL、`localhost:6379` 上的 Redis，以及 `UPLOAD_DIR` 指向的本地磁盘上传目录。
- MinIO 是可选存储后端。需要 S3 兼容存储时，设置 `STORAGE_DRIVER=minio`，并启动 Docker Compose 的 `minio` profile，例如 `docker-compose --profile minio up -d`。
- Docker Compose 使用 `pull_policy: never` 复用本地镜像；只有在明确拉取过镜像后，才建议修改镜像标签。
- 服务数据默认保存在 `BLOGUS_DATA_DIR` 指向的目录，默认值为 `./.data`。可以在 `.env` 中改到其它位置，例如 `BLOGUS_DATA_DIR=/Volumes/dev/blogus-data`。
- 上传文件默认保存在本地目录；也可以切换到 MinIO 的 `vault-files` bucket，通过 S3 兼容 API 存储。
- 管理端/浏览器鉴权使用 access token cookie 和 refresh token cookie；`/api/auth/refresh` 会验证并轮换 refresh token。
- API 启动时会确保 `users`、`invite_codes`、`auth_sessions`、`posts` 表存在。首个注册用户会成为管理员；后续用户需要使用有效邀请码注册。管理员可以创建和停用可多次使用的邀请码。
- CLI token 默认保存在 `~/.blogus-cli/config.json`。
- 生产环境必须显式设置安全的 `JWT_SECRET`；默认 `dev-secret` 会导致服务启动失败。

## 自动发版

打 tag 自动部署到生产，push main 不触发：

```bash
git tag v1.0.0
git push origin v1.0.0
```

流程：GitHub webhook → 服务器验签 → `deploy.sh v1.0.0` → checkout tag → build → pm2 restart。

服务器端：
- `scripts/webhook-server.py`：由 pm2 管理（`blogus-webhook`），监听 9000 端口
- `scripts/deploy.sh`：带 flock 防并发，日志写入 `deploy.log`
- GitHub Webhook Secret 存在服务器 wrapper 脚本中，不入库

## 质量门禁

每个阶段完成前必须至少通过：

```bash
pnpm typecheck
```

阶段 5 起发布准备还要求：

```bash
pnpm build
```

服务端核心文章路由有 `pnpm --filter @blogus/server test` 覆盖。

## 生产部署

最简部署只需后端进程，无需 nginx：

```bash
cp .env.example .env
# 编辑 .env，至少设置 NODE_ENV=production、JWT_SECRET=<随机密钥>、DATABASE_URL

make build        # 构建前端 + 后端
make start        # 启动生产服务

# 或一步到位
make serve
```

`SERVE_CLIENT=true` 时 Fastify 同时提供 API 和前端静态文件（含 SPA fallback），单端口 `:3009` 搞定。

必须替换的生产配置：
- `JWT_SECRET`：随机密钥，禁止使用 `dev-secret`（生产环境启动会失败）。
- `NODE_ENV=production`：关闭 dev-login 等开发功能。
- `BLOGUS_ENABLE_DEV_LOGIN`：生产环境不设置时自动关闭。
- `CLIENT_ORIGIN`：如使用外部反代且前后端不同源，需设置为前端实际域名。

可选进程管理：PM2 (`ecosystem.config.cjs`) 或 systemd (`blogus.service`)，详见 [docs/deployment.md](docs/deployment.md)。

## 非生产能力

以下能力只适合开发或脚手架阶段，不能直接用于生产：

- `POST /api/auth/dev-login` 允许任意邮箱生成 token。
- `JWT_SECRET=dev-secret`、非生产默认测试邀请码、MinIO 默认账号密码等默认值必须替换。
- Markdown 由前端 React 组件安全渲染，不直接执行文章中的 HTML；当前覆盖常见标题、段落、列表、引用、代码、链接和图片语法。
- 上传接口已有鉴权和大小限制，但文件类型策略仍需在后续阶段继续加固。
- Docker Compose 配置 `pull_policy: never`，依赖本机已有镜像；镜像拉取和构建需人工确认。

## 开发规划

开发阶段和验收检查点记录在 [docs/development-checkpoints.md](docs/development-checkpoints.md)。
