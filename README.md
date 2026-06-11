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
pnpm --filter @blogus/cli dev -- --help
```

也可以使用 `make` 中封装的常用命令：

```bash
make help
make install
make dev
make typecheck
make services-up
make dev-cli CLI_ARGS="post list"
```

## 配置说明

- API 服务通过 `DATABASE_URL` 连接 PostgreSQL。
- 开发默认使用 `localhost:5633` 上的 PostgreSQL、`localhost:6379` 上的 Redis，以及 `UPLOAD_DIR` 指向的本地磁盘上传目录。
- MinIO 是可选存储后端。需要 S3 兼容存储时，设置 `STORAGE_DRIVER=minio`，并启动 Docker Compose 的 `minio` profile，例如 `docker-compose --profile minio up -d`。
- Docker Compose 使用 `pull_policy: never` 复用本地镜像；只有在明确拉取过镜像后，才建议修改镜像标签。
- 服务数据默认保存在 `BLOGUS_DATA_DIR` 指向的目录，默认值为 `./.data`。可以在 `.env` 中改到其它位置，例如 `BLOGUS_DATA_DIR=/Volumes/dev/blogus-data`。
- 上传文件默认保存在本地目录；也可以切换到 MinIO 的 `vault-files` bucket，通过 S3 兼容 API 存储。
- 管理端/浏览器鉴权使用 access token cookie 和 refresh token cookie；`/api/auth/refresh` 会轮换这两个 token。
- CLI token 默认保存在 `~/.blogus-cli/config.json`。
- 当前认证和 CRUD 路由仍带有开发友好的脚手架行为，生产使用前需要继续加固。

## 当前功能清单

### API

| 路由 | 状态 | 说明 |
| --- | --- | --- |
| `GET /api/health` | 可用 | 返回 API 存活状态 |
| `POST /api/auth/dev-login` | dev-only | 直接签发 access/refresh token 和 cookie |
| `GET /api/auth/whoami` | 可用 | 读取当前 access token 用户 |
| `POST /api/auth/refresh` | 可用 | 使用 refresh cookie 轮换 token |
| `GET /api/auth/device` | placeholder | CLI device auth 占位响应，不是完整授权流程 |
| `POST /api/auth/logout` | 可用 | 清理鉴权 cookie |
| `GET /api/posts` | scaffold | 返回内存中的所有文章，包含草稿和发布文章 |
| `POST /api/posts` | scaffold | 创建内存文章；当前未鉴权 |
| `PATCH /api/posts/:id` | scaffold | 更新内存文章；当前未鉴权 |
| `DELETE /api/posts/:id` | scaffold | 删除内存文章；当前未鉴权 |
| `POST /api/upload` | scaffold | 需要登录；上传到本地目录或 MinIO |

### Web

| 页面 | 状态 | 说明 |
| --- | --- | --- |
| `/` | scaffold | 展示 `GET /api/posts` 返回的文章列表；当前不会过滤草稿 |
| `/admin` | scaffold | 可创建草稿；当前没有路由级鉴权保护 |
| `/login` | placeholder | 登录表单 UI 占位，尚未接入真实邮箱密码登录 |

### CLI

| 命令 | 状态 | 说明 |
| --- | --- | --- |
| `blogus-cli login` | placeholder | 打开 `/api/auth/device`，等待回调写入 token；服务端授权未完成 |
| `blogus-cli logout` | 可用 | 清理本地 token |
| `blogus-cli whoami` | 可用 | 调用 `/api/auth/whoami` |
| `blogus-cli post list` | scaffold | 列出 API 返回的内存文章 |
| `blogus-cli post create` | scaffold | 创建草稿，可从 Markdown 文件读取正文 |
| `blogus-cli post edit` | scaffold | 用 Markdown 文件替换文章正文 |
| `blogus-cli post publish` | scaffold | 将文章状态改为 `published` |
| `blogus-cli upload` | scaffold | 上传文件并打印 URL，需要有效 token |

## 质量门禁

每个阶段完成前必须至少通过：

```bash
pnpm typecheck
```

阶段 5 起发布准备还要求：

```bash
pnpm build
```

当前没有自动测试脚本；后续阶段会随核心路由和前端流程补测试。

## 非生产能力

以下能力只适合开发或脚手架阶段，不能直接用于生产：

- `POST /api/auth/dev-login` 允许任意邮箱生成 token。
- `GET /api/auth/device` 和 `blogus-cli login` 只是 device auth 占位流程。
- `JWT_SECRET=dev-secret`、MinIO 默认账号密码等 `.env.example` 默认值必须替换。
- 文章 CRUD 当前使用进程内存 `Map`，服务重启会丢失数据。
- 文章写操作当前未统一鉴权，首页也未过滤草稿。
- 上传接口已有鉴权，但文件类型、大小策略和路径安全仍需在后续阶段继续加固。
- Docker Compose 配置 `pull_policy: never`，依赖本机已有镜像；镜像拉取和构建需人工确认。

## 开发规划

开发阶段和验收检查点记录在 [docs/development-checkpoints.md](docs/development-checkpoints.md)。
