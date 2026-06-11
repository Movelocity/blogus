# Blogus

Blogus 是一个自托管 Node.js 博客系统，基于 React、Vite、Fastify、PostgreSQL、Drizzle ORM，并提供面向 Agent/开发者的命令行接口。

## 前置要求

- Node.js 22 或兼容版本。
- pnpm 9.15.4，版本由根目录 `package.json` 的 `packageManager` 固定。
- Docker / Docker Compose 仅用于启动本地 PostgreSQL、Redis、可选 MinIO 服务。

## 项目结构

```text
client/       React + Vite 单页应用
client/cli/   blogus-cli 命令行工具
server/       Fastify API 服务
shared/       前后端共享 TypeScript 类型
```

## 本地开发

```bash
pnpm install
cp .env.example .env
pnpm dev
```

`pnpm dev` 会同时启动 Vite 前端和 Fastify 后端。

本地服务依赖 PostgreSQL 和 Redis。需要启动容器时，先确认本机已有所需镜像，再执行：

```bash
make services-up
```

注意：在 Agent 执行任务时，构建镜像、启动容器、重启容器等非纯代码动作必须先由用户显式确认。

## 端口和依赖服务

| 项目 | 默认值 | 说明 |
| --- | --- | --- |
| Web 开发服务 | `http://127.0.0.1:5173` | Vite dev server；`/api` 代理到 API 服务 |
| API 服务 | `http://127.0.0.1:3009` | Fastify；由 `HOST`、`PORT` 配置 |
| PostgreSQL | `localhost:5633` | Docker Compose 暴露；`DATABASE_URL` 默认连接这里 |
| Redis | `localhost:6379` | 当前只记录配置，后续阶段接入更多会话/队列能力 |
| MinIO API | `localhost:9010` | 可选；仅 `STORAGE_DRIVER=minio` 且启用 `minio` profile 时使用 |
| MinIO Console | `localhost:9011` | 可选管理控制台 |

关键环境变量记录在 `.env.example`：

- `HOST`、`PORT`、`CLIENT_ORIGIN`：API 监听地址和 CORS 来源。
- `DATABASE_URL`、`REDIS_URL`：后端依赖服务连接地址。
- `JWT_SECRET`、`JWT_EXPIRY`、`JWT_REFRESH_EXPIRY`：JWT 和 cookie 会话配置。
- `BLOGUS_DEFAULT_INVITE_CODE`：默认测试邀请码；非生产环境不配置时默认使用 `blogus-dev-invite`，生产环境仅显式配置时生效。
- `BLOGUS_ENABLE_DEV_LOGIN`：开发便捷登录开关；生产环境强制关闭。
- `STORAGE_DRIVER`：上传存储后端，支持 `local` 和 `minio`。
- `UPLOAD_DIR`、`UPLOAD_PUBLIC_PATH`：本地上传目录和公开访问路径。
- `MINIO_*`：MinIO/S3 兼容存储配置，仅 MinIO 模式使用。
- `UPLOAD_MAX_SIZE_MB`、`UPLOAD_CHUNK_SIZE_MB`：上传大小和分片配置。
- `BLOGUS_DATA_DIR`：Docker Compose 服务数据目录。

## 常用脚本

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm --filter @blogus/cli dev --help
```

也可以使用 `make` 中封装的常用命令：

```bash
make help
make install
make dev
make typecheck
make services-up
```

CLI 开发命令直接通过 pnpm 传参，例如：

```bash
pnpm --filter @blogus/cli dev post list
pnpm --filter @blogus/cli dev post create -t "Hello Blogus" -f ./draft.md -e "短摘要" --tags "blogus,release"
pnpm --filter @blogus/cli dev upload ./cover.png
pnpm --filter @blogus/cli dev register -e admin@example.com -p blogus-dev-password
pnpm --filter @blogus/cli dev invite create -c team-code
pnpm --filter @blogus/cli dev register -e writer@example.com -p blogus-dev-password -i team-code
```

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

## 当前功能清单

### API

| 路由 | 状态 | 说明 |
| --- | --- | --- |
| `GET /api/health` | 可用 | 返回 API 存活状态 |
| `POST /api/auth/login` | 可用 | 邮箱密码登录，签发 access/refresh token 和 cookie |
| `POST /api/auth/register` | 可用 | 首个注册用户成为管理员；后续注册需要邀请码 |
| `POST /api/auth/dev-login` | dev-only | 非生产便捷登录；生产环境不可用 |
| `GET /api/auth/whoami` | 可用 | 读取当前 access token 用户 |
| `POST /api/auth/refresh` | 可用 | 使用 refresh cookie 验证并轮换 token |
| `POST /api/auth/logout` | 可用 | 吊销当前会话并清理鉴权 cookie |
| `GET /api/auth/invites` | 可用 | 管理员查看邀请码 |
| `POST /api/auth/invites` | 可用 | 管理员创建可多次使用的邀请码 |
| `POST /api/auth/invites/:id/disable` | 可用 | 管理员停用邀请码 |
| `GET /api/posts` | 可用 | 默认只返回已发布文章；`visibility=all` 需要登录 |
| `GET /api/posts/:slug` | 可用 | 按 slug 读取已发布文章；`visibility=all` 需要登录 |
| `POST /api/posts` | 可用 | 创建文章；支持正文、摘要、封面图、标签和发布状态；需要登录 |
| `PATCH /api/posts/:id` | 可用 | 更新文章内容、元数据或状态；撤回发布会清空发布时间；需要登录 |
| `DELETE /api/posts/:id` | 可用 | 删除文章；需要登录，普通用户和管理员都可写作 |
| `POST /api/upload` | 可用 | 需要登录；上传到本地目录或 MinIO，文件安全策略后续加固 |

### Web

| 页面 | 状态 | 说明 |
| --- | --- | --- |
| `/` | 可用 | 展示已发布文章列表，包含摘要、封面和标签 |
| `/archive` | 可用 | 按月份展示已发布文章归档，包含发布时间和阅读时长 |
| `/posts/:slug` | 可用 | 按 slug 展示已发布文章详情，刷新后可直接访问 |
| `/admin` | 可用 | 登录后可创建、编辑、预览、插图、发布、撤回和删除文章 |
| `/login` | 可用 | 邮箱密码登录并写入 cookie 会话 |

### CLI

| 命令 | 状态 | 说明 |
| --- | --- | --- |
| `blogus-cli login` | 可用 | 使用邮箱密码登录，或通过 `--token` 保存已有 access token |
| `blogus-cli register` | 可用 | 注册用户并保存 token；首个注册用户成为管理员，后续需邀请码 |
| `blogus-cli logout` | 可用 | 尝试吊销服务端会话并清理本地 token |
| `blogus-cli whoami` | 可用 | 调用 `/api/auth/whoami` |
| `blogus-cli invite list` | 可用 | 管理员查看邀请码 |
| `blogus-cli invite create` | 可用 | 管理员创建可多次使用的邀请码 |
| `blogus-cli invite disable` | 可用 | 管理员停用邀请码 |
| `blogus-cli post list` | 可用 | 登录后列出草稿和发布文章 |
| `blogus-cli post create` | 可用 | 登录后创建草稿，可从 Markdown 文件读取正文，并设置摘要、封面和标签 |
| `blogus-cli post edit` | 可用 | 登录后替换文章正文或更新标题、摘要、封面、标签和状态 |
| `blogus-cli post publish` | 可用 | 登录后将文章状态改为 `published` |
| `blogus-cli upload` | 可用 | 上传文件并打印 URL，需要有效 token |

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

## 非生产能力

以下能力只适合开发或脚手架阶段，不能直接用于生产：

- `POST /api/auth/dev-login` 允许任意邮箱生成 token。
- `JWT_SECRET=dev-secret`、非生产默认测试邀请码、MinIO 默认账号密码等默认值必须替换。
- Markdown 由前端 React 组件安全渲染，不直接执行文章中的 HTML；当前覆盖常见标题、段落、列表、引用、代码、链接和图片语法。
- 上传接口已有鉴权和大小限制，但文件类型策略仍需在后续阶段继续加固。
- Docker Compose 配置 `pull_policy: never`，依赖本机已有镜像；镜像拉取和构建需人工确认。

## 开发规划

开发阶段和验收检查点记录在 [docs/development-checkpoints.md](docs/development-checkpoints.md)。
