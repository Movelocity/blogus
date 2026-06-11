# Blogus

Blogus 是一个自托管 Node.js 博客系统，基于 React、Vite、Fastify、PostgreSQL、Drizzle ORM，并提供面向 Agent/开发者的命令行接口。

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
docker-compose up -d
pnpm dev
```

`pnpm dev` 会同时启动 Vite 前端和 Fastify 后端。

注意：执行构建镜像、启动容器等非纯代码任务前，需要先由用户显式确认。

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

## 开发规划

开发阶段和验收检查点记录在 [docs/development-checkpoints.md](docs/development-checkpoints.md)。
