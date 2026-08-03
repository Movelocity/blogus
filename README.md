# Blogus

Blogus 是一个自托管 Node.js 博客系统，基于 React、Vite、Fastify、PostgreSQL、Drizzle ORM，并提供面向 Agent/开发者的命令行接口。

## 快速上手

前置要求：Node.js 22+、pnpm 9.15.4、Docker / Docker Compose（用于 PostgreSQL 和 Redis）。

```bash
pnpm install
cp .env.example .env
make services-up   # 启动 PostgreSQL 和 Redis
pnpm dev           # 同时启动前端和后端
```

前端运行在 `http://127.0.0.1:5177`（终端也会显示局域网 `Network` 地址），API 服务在 `http://127.0.0.1:3009`。

首次注册的用户自动成为管理员，后续注册需要邀请码。

## 生产部署

```bash
cp .env.example .env
# 编辑 .env，至少设置 NODE_ENV=production、JWT_SECRET=<随机密钥>、DATABASE_URL

make build        # 构建前端 + 后端
make start        # 启动生产服务
```

`SERVE_CLIENT=true` 时后端直接托管 `client/dist/`，无需 nginx 反代。访问 `http://<host>:3009` 即可使用完整博客。

更多部署选项（PM2、systemd、反向代理）见 [docs/deployment.md](docs/deployment.md)。

## 自动发版（CI/CD）

Push `main` 不触发部署。打 tag 后自动部署到生产：

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub webhook → 服务器验证签名 → checkout tag → build → pm2 restart。

服务器端脚本在 `scripts/`：

| 文件 | 说明 |
| --- | --- |
| `webhook-server.py` | 监听 GitHub push 事件，匹配 `v*.*.*` tag 后触发部署 |
| `deploy.sh` | 拉取指定 tag、构建、重启 pm2 |

webhook 由 pm2 管理（`blogus-webhook`），部署日志写入 `deploy.log`。

## 项目结构

```text
client/       React + Vite 单页应用
client/cli/   blogus-cli 命令行工具
server/       Fastify API 服务
shared/       前后端共享 TypeScript 类型
scripts/      部署相关脚本
```

## 功能清单

### Web

| 页面 | 说明 |
| --- | --- |
| `/` | 已发布文章列表，包含摘要、封面和标签 |
| `/archive` | 按月份归档，含发布时间和阅读时长 |
| `/posts/:slug` | 文章详情，可通过 slug 直接访问 |
| `/admin` | 登录后管理文章：创建、编辑、预览、发布、撤回、删除 |
| `/login` | 邮箱密码登录 |

### CLI

| 命令 | 说明 |
| --- | --- |
| `blogus-cli login` | 邮箱密码登录，或通过 `--token` 保存已有 token |
| `blogus-cli register` | 注册用户；首个用户成为管理员，后续需邀请码 |
| `blogus-cli logout` | 吊销会话并清理本地 token |
| `blogus-cli whoami` | 查看当前登录用户 |
| `blogus-cli invite list/create/disable` | 管理邀请码 |
| `blogus-cli post list/create/edit/publish` | 管理文章 |
| `blogus-cli upload <path>` | 上传文件并打印 URL |

### API

| 路由 | 说明 |
| --- | --- |
| `GET /api/health` | 存活检测 |
| `POST /api/auth/login` | 登录，签发 access/refresh token |
| `POST /api/auth/register` | 注册，首个用户成为管理员 |
| `GET /api/auth/whoami` | 当前用户信息 |
| `POST /api/auth/refresh` | 刷新 token |
| `POST /api/auth/logout` | 登出 |
| `GET/POST /api/auth/invites` | 邀请码管理 |
| `GET /api/posts` | 文章列表；`visibility=all` 需登录 |
| `GET /api/posts/:slug` | 文章详情 |
| `POST /api/posts` | 创建文章 |
| `PATCH /api/posts/:id` | 更新文章 |
| `DELETE /api/posts/:id` | 删除文章 |
| `POST /api/upload` | 上传文件 |

## 开发文档

本地开发、配置说明、CLI 开发工作流等详见 [DEV.md](DEV.md)。
