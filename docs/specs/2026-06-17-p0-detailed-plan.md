# P0 任务详细实施方案

> 创建：2026-06-17
>
> 状态：**草稿，待审核**
>
> 基于源码审计与 backlog.md 整理，逐项给出现状、方案、决策点。

---

## 目录

1. [P0-1 Session expiry UX 浏览器 E2E](#p0-1-session-expiry-ux-浏览器-e2e)
2. [P0-2 健康检查扩展](#p0-2-健康检查扩展)
3. [P0-3 数据库迁移流程固定](#p0-3-数据库迁移流程固定)
4. [P0-4 备份与恢复文档 / 脚本](#p0-4-备份与恢复文档--脚本)
5. [P0-5 `pnpm build` 产物可运行验证](#p0-5-pnpm-build-产物可运行验证)
6. [P0-6 部署文档](#p0-6-部署文档)

---

## P0-1 Session expiry UX 浏览器 E2E

### 现状

代码已全部合入，涉及文件：

| 文件 | 职责 |
|------|------|
| `client/src/lib/api.ts` | `refreshSession()` 单飞去重、`request()` 401 拦截、`SessionExpiredError` |
| `client/src/components/SessionWatcher.tsx` | 监听 `blogus:session-expired` 事件 → `navigate("/login")` |
| `client/src/pages/AdminPage.tsx` | mount 时先 `refreshSession()`，失败才显示登录卡 |
| `client/src/pages/LoginPage.tsx` | 错误密码 inline 显示，不跳转 |
| `server/src/routes/auth.ts` | `POST /refresh` 端点 + token 轮转 |

规范文档：`docs/specs/2026-06-16-session-expiry-ux.md` 中 T6-T9 定义了 4 个手工浏览器测试。

### 测试清单

| 编号 | 场景 | 操作 | 预期 |
|------|------|------|------|
| T6 | 静默刷新不闪登录页 | 设 `JWT_EXPIRY=20s`，登录 `/admin`，等 30s，再访问 `/admin` | 页面正常加载，Network 有 `POST /auth/refresh` → 200 |
| T7 | refresh 也过期 → 跳 /login | 在 T6 基础上，DevTools 删两个 cookie，触发操作 | 自动跳 `/login`，无红色报错条 |
| T8 | 输错密码不跳页 | `/login` 输入错误密码 | 表单内联报错，URL 不变 |
| T9 | 后端重启不丢登录态 | 登录 `/admin`，重启后端（不改 `JWT_SECRET`） | 页面不跳，操作恢复 |

### 实施步骤

1. 在本地启动完整环境：`make services-up && make dev`
2. 确认 `.env` 中 `JWT_EXPIRY` 支持短值（如 `20s`）；若不支持，在 `config.ts` 的 `parseDurationSeconds` 中确认已处理
3. 按 T6→T7→T8→T9 顺序手工执行
4. 每个测试通过后在本文档标记 ✅

### 决策点

无。纯手工验收，代码无需改动。

---

## P0-2 健康检查扩展

### 现状

**文件：** `server/src/app.ts` 第 35 行

```ts
app.get("/api/health", async () => ({
  ok: true,
  service: "blogus-api"
}));
```

- 纯存活探针，不检测任何依赖
- DB 连接：`server/src/plugins/db.ts` 使用 postgres.js 连接池（max: 10）
- 存储后端：`server/src/plugins/storage.ts` 支持 `local` / `minio` 双驱动

### 方案

将 `/api/health` 改为 **readiness 探针**，报告各子系统状态：

```ts
// 响应结构
{
  ok: true | false,          // 全部健康才 true
  service: "blogus-api",
  checks: {
    database: { ok: true, latencyMs: 3 },
    storage:  { ok: true, driver: "local" }
  }
}
```

#### 数据库检测

```ts
const start = Date.now();
await db.execute(sql`SELECT 1`);
const latencyMs = Date.now() - start;
```

- 捕获异常 → `{ ok: false, error: "connection refused" }` （生产环境不暴露完整错误）

#### 存储检测

**Local 驱动：**
```ts
import { access } from "node:fs/promises";
await access(config.storage.uploadDir);
```

**MinIO 驱动：**
```ts
await s3Client.send(new HeadBucketCommand({ Bucket: config.minio.bucket }));
```

- 驱动名直接从 `config.storage.driver` 读取

#### HTTP 状态码

- 全部 `ok: true` → `200`
- 任一 `ok: false` → `503 Service Unavailable`

### 实施步骤

1. 在 `server/src/app.ts` 中替换 `/api/health` handler
2. 注入 `db` 实例（已通过 `app.decorate("db")` 可用）和存储配置
3. 用 `try/catch` 包裹每个检测，永不抛出到外层
4. 添加单元测试：mock db 报错 → 503

### 决策点

**A. 是否需要独立 `/api/ready` 端点？**

Kubernetes 习惯将 liveness（存活）和 readiness（就绪）分开：
- `/api/health` — 进程活着就行，始终 200
- `/api/ready` — 依赖全通才算就绪

当前只有一个端点，如果未来上 K8s，建议拆分。但如果近期部署方式是 PM2 + Nginx，单端点足够。

> **建议：** 先做单端点（`/api/health` 返回详细状态），需要时再拆。原因：PM2 + Nginx 部署下无 liveness/readiness 区分需求。

**B. 响应中是否暴露版本号 / git commit？**

可选。方便运维确认部署版本，但属于信息泄露。可在 `NODE_ENV=production` 时隐藏。

> **建议：** 暂不暴露，需要时加 `info` 端点。

---

## P0-3 数据库迁移流程固定

### 现状

- **机制：** `server/src/plugins/db.ts` 中 `ensureDatabaseSchema()` 在启动时执行 raw SQL：
  - `CREATE TABLE IF NOT EXISTS` × 4 张表（users, invite_codes, auth_sessions, posts）
  - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` × 3 条（role, cover_image_url, tags）
- **问题：**
  - 无版本号、无顺序、无回滚
  - 已出现 Drizzle schema（`db/schema.ts`）与 raw DDL 的漂移
  - 新增列靠追加 `ALTER TABLE`，容易遗漏或重复
- **drizzle-kit 状态：** 未安装，无 `drizzle.config.ts`，无 `migrations/` 目录

### 方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| **A. 引入 drizzle-kit** | 与现有 drizzle-orm 生态一致；schema 文件已是 source of truth；支持 `generate` + `migrate` 命令 | 需要学习曲线；需要将 raw DDL 迁移为 Drizzle schema 驱动 |
| **B. 手写 SQL 迁移文件** | 最简单、无额外依赖；完全可控 | 需要自己管理版本号和执行记录；容易出错 |
| **C. 保持现状 + 加版本号** | 改动最小 | 不解决根本问题，仅加了遮羞布 |

### 推荐：方案 A — 引入 drizzle-kit

#### 理由

1. `drizzle-orm` 已安装（v0.39.3），schema 文件 `server/src/db/schema.ts` 已存在且定义了全部 4 张表
2. drizzle-kit 是 drizzle-orm 官方配套工具，迁移文件是纯 SQL，可审计
3. 当前 `ensureDatabaseSchema()` 里的 raw DDL 可以全部移除

#### 实施步骤

**Step 1：安装 drizzle-kit**

```bash
cd server && pnpm add -D drizzle-kit
```

**Step 2：创建 `server/drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
});
```

**Step 3：同步 Drizzle schema 与实际表结构**

审计发现 3 个 `ALTER TABLE` 漂移点，需确保 `db/schema.ts` 包含：
- `users.role`（已存在）
- `posts.coverImageUrl`（已存在）
- `posts.tags`（已存在）

确认 schema 文件与数据库一致后，执行 **baseline**：

```bash
# 将当前数据库状态标记为初始版本（不生成迁移文件）
pnpm drizzle-kit migrate
```

> ⚠️ baseline 操作需要决策：是标记当前状态为 v0000，还是从头生成完整迁移？
> 推荐 baseline，因为数据库已有数据。

**Step 4：生成初始迁移（仅首次）**

```bash
pnpm drizzle-kit generate
```

这会在 `server/drizzle/` 下生成迁移文件。

**Step 5：替换 `ensureDatabaseSchema()`**

将 `server/src/plugins/db.ts` 中的 `ensureDatabaseSchema()` 替换为：

```ts
import { migrate } from "drizzle-orm/postgres-js/migrator";

// 在 db plugin 中
await migrate(db, { migrationsFolder: "./drizzle" });
```

**Step 6：更新 Makefile / package.json**

```makefile
# 新增 targets
db-generate:
	cd server && pnpm drizzle-kit generate

db-migrate:
	cd server && pnpm drizzle-kit migrate

db-studio:
	cd server && pnpm drizzle-kit studio
```

**Step 7：移除 raw DDL**

从 `server/src/plugins/db.ts` 中删除：
- `ensureDatabaseSchema()` 函数
- 所有 `CREATE TABLE IF NOT EXISTS` 语句
- 所有 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 语句
- `pgcrypto` 扩展创建（如需保留，放入迁移文件）

### 决策点

**A. Baseline 策略：如何处理现有数据库？**

选项：
1. **Baseline（推荐）**：假设生产环境数据库结构正确，标记为初始状态，后续变更走迁移文件
2. **全量重建**：DROP 所有表，用 drizzle-kit 从头生成迁移，再导入数据

> **建议：** Baseline。生产环境不可能清空重建。

**B. 迁移在启动时自动执行 vs 手动执行？**

选项：
1. **启动时自动 migrate**（当前 `ensureDatabaseSchema` 的行为）— 简单，但生产环境风险高（错误迁移无法撤回）
2. **手动 `pnpm db:migrate`** — 安全，需要部署流程配合
3. **启动时自动 + 仅非破坏性迁移** — 中间方案

> **建议：** 开发环境自动 migrate，生产环境手动。原因：生产环境需要在部署脚本中明确执行迁移步骤，出问题可回滚。

**C. 如何处理 `pgcrypto` 扩展？**

当前 `ensureDatabaseSchema()` 中有 `CREATE EXTENSION IF NOT EXISTS pgcrypto`。迁移方案需要决定：
- 放入迁移文件 v0000（推荐，保持声明式）
- 要求 DBA 预装（更规范但增加部署复杂度）

> **建议：** 放入迁移文件。单机部署无 DBA 角色。

---

## P0-4 备份与恢复文档 / 脚本

### 现状

- **PostgreSQL：** Docker Compose 运行 postgres:16-alpine，数据目录 `${BLOGUS_DATA_DIR}/postgres`
- **本地上传：** `UPLOAD_DIR`（默认 `./uploads`）
- **MinIO：** 可选，数据目录 `${BLOGUS_DATA_DIR}/minio`，bucket `vault-files`
- **备份工具：** 无任何脚本或文档

### 方案

编写 `scripts/backup.sh` 和 `scripts/restore.sh`，以及 `docs/backup.md` 文档。

#### 备份脚本 `scripts/backup.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

# 配置
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="blogus_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

mkdir -p "${BACKUP_PATH}"

# 1. PostgreSQL
echo "→ 备份 PostgreSQL..."
docker compose exec -T postgres pg_dump \
  -U vault -d vault_page \
  --format=custom \
  --file="/tmp/blogus_dump.pg"
docker compose cp postgres:/tmp/blogus_dump.pg "${BACKUP_PATH}/database.pg"

# 2. 上传文件（local 驱动）
if [ "${STORAGE_DRIVER:-local}" = "local" ]; then
  echo "→ 备份上传文件..."
  UPLOAD_DIR="${UPLOAD_DIR:-./uploads}"
  tar czf "${BACKUP_PATH}/uploads.tar.gz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
fi

# 3. MinIO（可选）
if [ "${STORAGE_DRIVER}" = "minio" ]; then
  echo "→ 备份 MinIO 数据..."
  # 方式 A：直接备份 Docker volume
  docker compose cp minio:/data "${BACKUP_PATH}/minio-data/"
  # 方式 B：使用 mc mirror（需安装 mc）
  # mc mirror minio/vault-files "${BACKUP_PATH}/minio-files/"
fi

# 4. 打包
tar czf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" -C "${BACKUP_DIR}" "${BACKUP_NAME}"
rm -rf "${BACKUP_PATH}"

echo "✅ 备份完成: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
```

#### 恢复脚本 `scripts/restore.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="$1"
RESTORE_DIR=$(mktemp -d)

tar xzf "${BACKUP_FILE}" -C "${RESTORE_DIR}"

# 1. PostgreSQL
echo "→ 恢复 PostgreSQL..."
docker compose cp "${RESTORE_DIR}"/*/database.pg postgres:/tmp/blogus_dump.pg
docker compose exec -T postgres pg_restore \
  -U vault -d vault_page \
  --clean --if-exists \
  /tmp/blogus_dump.pg

# 2. 上传文件
if [ -f "${RESTORE_DIR}"/*/uploads.tar.gz ]; then
  echo "→ 恢复上传文件..."
  UPLOAD_DIR="${UPLOAD_DIR:-./uploads}"
  tar xzf "${RESTORE_DIR}"/*/uploads.tar.gz -C "$(dirname "$UPLOAD_DIR")"
fi

rm -rf "${RESTORE_DIR}"
echo "✅ 恢复完成"
```

#### 文档 `docs/backup.md`

内容大纲：
1. 备份内容说明（数据库、上传文件、MinIO）
2. 自动备份配置（crontab 示例）
3. 手动备份 / 恢复操作步骤
4. 备份验证流程（定期恢复测试）
5. 存储建议（异地备份、加密）

### 实施步骤

1. 创建 `scripts/` 目录
2. 编写 `backup.sh` 和 `restore.sh`
3. 编写 `docs/backup.md`
4. 在 Makefile 添加 `backup` 和 `restore` targets
5. 手动测试备份 → 清空 → 恢复 → 验证数据完整性

### 决策点

**A. MinIO 备份方式？**

选项：
1. **Docker volume 直接拷贝**（`docker compose cp`）— 简单，但需要停服务保证一致性
2. **mc mirror** — 在线备份，但需要安装 `mc` 客户端
3. **S3 API `ListObjects` + 下载** — 纯脚本，无额外依赖

> **建议：** 方式 1（Docker volume 拷贝）。原因：MinIO 是可选功能，单机部署下短暂停止可接受；mc 需额外安装增加复杂度。

**B. 备份是否加密？**

> **建议：** 暂不加密。文档中说明生产环境建议使用 GPG 加密，并给出示例命令。加密脚本作为可选增强。

**C. 是否需要自动备份？**

> **建议：** 文档提供 crontab 示例，但不内置 daemon。原因：自动备份策略因环境而异，应由运维决定。

---

## P0-5 `pnpm build` 产物可运行验证

### 现状

- **Client：** `client/package.json` build 脚本 `tsc -b && vite build`，产物默认 `client/dist/`
- **Server：** `server/package.json` build 脚本 `tsc -p tsconfig.json`，产物 `server/dist/`，入口 `node dist/index.js`
- **共享包：** `shared/` 仅生成 `.d.ts` 声明文件
- **问题：**
  - 从未验证过 production build 是否可独立运行
  - Server 没有 serve client 静态文件的逻辑
  - 无 Dockerfile / 部署配置

### 验证清单

| # | 验证项 | 操作 | 预期 |
|---|--------|------|------|
| V1 | Client 构建 | `cd client && pnpm build` | 无报错，`dist/` 生成 `index.html` + 静态资源 |
| V2 | Server 构建 | `cd server && pnpm build` | 无报错，`dist/index.js` 可执行 |
| V3 | Server 独立启动 | `DATABASE_URL=... node server/dist/index.js` | 服务启动，`GET /api/health` 返回 200 |
| V4 | Client 静态文件部署 | 用 Nginx 或 `serve` 托管 `client/dist/`，反代 `/api` 到 server | 页面可访问，API 可调用 |
| V5 | 全量 E2E | 构建后走一遍登录 → 发文 → 上传 → 访问博客 | 功能正常 |

### Server 增强：Serve Client Build（可选）

当前 server 不会 serve `client/dist/`。两种部署方式：

**方式 A：Nginx 反代（推荐）**
```nginx
server {
    listen 80;
    root /path/to/client/dist;

    location /api {
        proxy_pass http://localhost:3009;
    }
    location /uploads {
        proxy_pass http://localhost:3009;
    }
    location / {
        try_files $uri /index.html;
    }
}
```

**方式 B：Server 直接 serve 静态文件**

在 `server/src/app.ts` 中添加 `@fastify/static` 注册：
```ts
import fastifyStatic from "@fastify/static";
import path from "node:path";

app.register(fastifyStatic, {
  root: path.resolve("../../client/dist"),
  prefix: "/",
  decorateReply: false  // storage plugin 已用 @fastify/static
});
```

> ⚠️ 方式 B 有冲突风险：storage plugin 已注册 `@fastify/static` 用于上传文件。两个 `@fastify/static` 实例可能冲突（`decorateReply` 默认为 true）。

### 实施步骤

1. 执行 V1-V5 验证
2. 修复发现的构建问题
3. 确认部署方式（Nginx 反代 vs Server serve）

### 决策点

**A. 部署架构：Nginx 反代 vs Server serve 静态文件？**

> **建议：** Nginx 反代。原因：
> 1. Nginx 处理静态文件性能远优于 Node.js
> 2. 避免 `@fastify/static` 双实例冲突
> 3. 未来上 HTTPS / CDN / 缓存策略更灵活
> 4. 与 PM2/systemD + Nginx 的标准部署架构一致

**B. 是否需要 Dockerfile？**

> **建议：** 暂不需要。当前目标是 PM2/systemD + Nginx 部署。Docker 化可作为后续优化。

---

## P0-6 部署文档

### 现状

- `DEV.md` 有开发环境搭建说明，但无生产部署文档
- `.env.example` 有完整环境变量说明
- 无 PM2 / systemd 配置示例
- 无 Nginx 配置示例

### 文档大纲：`docs/deployment.md`

```text
1. 前置条件
   - Node.js 20+（推荐 22 LTS）
   - pnpm 9+
   - PostgreSQL 16+
   - Nginx（反向代理）
   - PM2 或 systemd（进程管理）

2. 环境变量配置
   - 必填项：DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
   - 可选项：STORAGE_DRIVER, UPLOAD_DIR, REDIS_URL, MINIO_*
   - 安全：JWT_SECRET 必须随机生成（openssl rand -hex 32）
   - 完整列表参考 .env.example

3. 数据库准备
   - 创建数据库和用户
   - 运行迁移（pnpm db:migrate）

4. 构建
   - pnpm install
   - pnpm build
   - 产物：client/dist/ + server/dist/

5. 部署（PM2 方式）
   - PM2 ecosystem 配置示例
   - 启动 / 停止 / 重启命令
   - 日志查看

6. 部署（systemd 方式）
   - service 文件示例
   - 启用 / 启动命令

7. Nginx 配置
   - 反向代理 /api → Node.js
   - 静态文件 serve client/dist/
   - 上传文件代理
   - HTTPS 配置（可选）

8. 验证部署
   - 健康检查
   - 访问博客前台
   - 管理后台登录

9. 更新部署流程
   - 拉取代码
   - pnpm install && pnpm build
   - 运行迁移
   - 重启服务

10. 备份
    - 参考 docs/backup.md
```

### PM2 配置示例 `ecosystem.config.cjs`

```js
module.exports = {
  apps: [{
    name: "blogus-api",
    script: "./server/dist/index.js",
    cwd: "/path/to/blogus",
    env: {
      NODE_ENV: "production",
      DATABASE_URL: "postgres://vault:vault_prod@localhost:5432/vault_page",
      JWT_SECRET: "<generated>",
      JWT_REFRESH_SECRET: "<generated>",
      STORAGE_DRIVER: "local",
      UPLOAD_DIR: "./uploads"
    },
    instances: 1,          // 单实例，无状态服务可增加
    autorestart: true,
    max_memory_restart: "512M"
  }]
};
```

### systemd 服务示例 `/etc/systemd/system/blogus.service`

```ini
[Unit]
Description=Blogus API Server
After=network.target postgresql.service

[Service]
Type=simple
User=blogus
WorkingDirectory=/opt/blogus
ExecStart=/usr/bin/node server/dist/index.js
Restart=on-failure
RestartSec=5
EnvironmentFile=/opt/blogus/.env

[Install]
WantedBy=multi-user.target
```

### 实施步骤

1. 编写 `docs/deployment.md`
2. 创建 `ecosystem.config.cjs`（PM2 配置）
3. 创建 `deploy/systemd/blogus.service`（systemd 配置）
4. 在 README.md 添加指向部署文档的链接

### 决策点

**A. PM2 vs systemd 为主要推荐？**

> **建议：** 文档同时提供两种方式，但推荐 PM2 为默认。原因：
> 1. PM2 自带日志管理、cluster mode、monitor
> 2. Node.js 生态更熟悉
> 3. systemd 配置在文档中作为"无 PM2 环境"的备选

**B. 是否需要进程管理配置文件入库？**

> **建议：** 是。创建 `deploy/` 目录存放：
> - `ecosystem.config.cjs`（PM2）
> - `blogus.service`（systemd）
> - `nginx/blogus.conf`（Nginx 站点配置）
>
> 部署文档中引用这些文件。

---

## 建议执行顺序

```text
P0-1 Session E2E（纯验收，无代码改动）
  ↓
P0-5 Build 验证（确认产物可运行，发现并修复问题）
  ↓
P0-2 健康检查扩展（小改动，为部署验证提供端点）
  ↓
P0-3 DB 迁移流程（中等改动，需要仔细 baseline）
  ↓
P0-4 备份脚本 / 文档（独立，不依赖其他项）
  ↓
P0-6 部署文档（最后写，因为前面的产出会定义最终架构）
```

理由：
- P0-1 已有代码，只需验收，零风险
- P0-5 优先于 P0-3/P0-6，因为 build 验证可能发现需要修的问题
- P0-2 改动小且独立，可在 P0-3 之前完成
- P0-4 独立性强，可与 P0-3 并行
- P0-6 最后，因为健康检查、迁移命令、备份路径都会影响部署文档内容

---

## 待审核决策汇总

| # | 决策点 | 选项 | 建议 |
|---|--------|------|------|
| D1 | 健康检查：单端点 vs liveness/readiness 分离 | A: 单端点 / B: 分离 | A（PM2 场景无区分需求） |
| D2 | DB 迁移方案 | A: drizzle-kit / B: 手写 SQL / C: 保持现状 | A（已有 drizzle-orm 生态） |
| D3 | DB 迁移：启动时自动 vs 手动 | A: 自动 / B: 手动 / C: 开发自动+生产手动 | C（安全+便利平衡） |
| D4 | pgcrypto 扩展处理 | A: 放入迁移 / B: 要求 DBA 预装 | A（单机部署无 DBA） |
| D5 | MinIO 备份方式 | A: Docker volume 拷贝 / B: mc mirror / C: S3 API | A（简单可靠） |
| D6 | 备份加密 | A: 内置 / B: 文档说明可选 / C: 不支持 | B |
| D7 | 静态文件部署 | A: Nginx 反代 / B: Server serve | A（性能+灵活性） |
| D8 | 进程管理推荐 | A: PM2 / B: systemd | A（文档两者都写） |
| D9 | 部署配置入库 | A: 入库 / B: 仅文档 | A（`deploy/` 目录） |
| D10 | 是否引入 Dockerfile | A: 是 / B: 暂不 | B（PM2+Nginx 优先） |

请审核以上方案和决策点，确认或调整后开始实施。
