# Blogus 开发待办清单

> 最后更新：2026-06-17
>
> 基于 `development-checkpoints.md`、`archive-proposal.md`、`session-expiry-ux.md` 及源码审计整理。

## 当前阶段概览

| 阶段 | 状态 |
|------|------|
| 阶段 0~3 | ✅ 全部完成 |
| 阶段 4：前台博客体验 | ✅ 核心完成（RSS / 站点配置 / 作者信息可选未做） |
| 文章归档功能方案 | ✅ 后端 + Admin UI 已实施 |
| Session expiry UX | ✅ 全部完成（含浏览器 E2E T6-T9） |
| **阶段 5：测试、运维与发布准备** | ❌ 未开始 |
| **阶段 6：生产安全加固** | ❌ 未开始 |

---

## P0 — 发布前必做

| # | 事项 | 来源 | 预估工作量 |
|---|------|------|-----------|
| ~~1~~ | ~~**Session expiry UX 浏览器 E2E**~~ | `docs/specs/2026-06-16-session-expiry-ux.md` T6-T9 | ✅ |
| | 2026-06-17 已验收：T6 静默 refresh 不闪登录页 ✅、T7 refresh 失败显示登录卡片 ✅、T8 错误密码不跳页 ✅、T9 后端重启不丢登录态 ✅。 | | |
| ~~2~~ | ~~**健康检查扩展**~~ | 阶段 5 | ✅ |
| | 2026-06-17 已完成：`GET /api/health` 报告 DB 连接状态和存储后端（local / minio）。 | | |
| 3 | **数据库迁移流程固定** | 阶段 5 | 2h |
| | 目前靠启动时 `ensureTableExists` 保证表存在，无版本化迁移。生产部署需要可重复、不破坏数据的迁移方案（如 drizzle-kit migrate）。 | | |
| 4 | **备份与恢复文档 / 脚本** | 阶段 5 | 1h |
| | PostgreSQL 数据 + 本地上传目录 + 可选 MinIO 数据的备份恢复流程，目前无任何说明。 | | |
| ~~5~~ | ~~**`pnpm build` 产物可运行验证**~~ | 阶段 5 | ✅ |
| | 2026-06-17 已完成：`SERVE_CLIENT=true` 时后端直接托管 `client/dist/`，含 SPA fallback。部署只需 `pnpm build && pnpm start`。 | | |
| ~~6~~ | ~~**部署文档**~~ | 阶段 5 | ✅ |
| | 2026-06-17 已完成：`docs/deployment.md` 覆盖快速部署、PM2、systemd、nginx 反代、环境变量参考。 | | |

---

## P1 — 安全加固，长期使用前必做

| # | 事项 | 来源 | 预估工作量 |
|---|------|------|-----------|
| 7 | **Cookie 安全属性** | 阶段 6 + session spec 范围外 | 1h |
| | 生产环境 `SameSite=Lax`、`Secure`、`Domain` 配置。当前仅 `httpOnly`。 | | |
| 8 | **上传文件类型 / 路径加固** | 阶段 6 + DEV.md 已标注 | 2h |
| | 当前仅有大小限制，缺少 MIME 白名单、扩展名校验、路径遍历防护。DEV.md 原文："文件类型策略仍需在后续阶段继续加固"。 | | |
| 9 | **API Rate Limit** | 阶段 6 | 1.5h |
| | 无速率限制。登录接口尤其需要防暴力破解。Redis 已配置但未使用，可用于分布式限流。 | | |
| 10 | **错误信息脱敏** | 阶段 6 | 1h |
| | 确认生产环境不泄露栈信息、数据库细节等敏感内容。 | | |
| 11 | **安全默认值审计** | 阶段 6 | 0.5h |
| | `JWT_SECRET=dev-secret` 启动失败已有，还需审计 MinIO 默认密码、`BLOGUS_ENABLE_DEV_LOGIN` 等。 | | |

---

## P2 — 体验完善，非阻塞

| # | 事项 | 来源 | 预估工作量 |
|---|------|------|-----------|
| 12 | **前端测试** | 阶段 5 | 3h+ |
| | 当前零前端测试。关键路径：登录流程、文章 CRUD、Markdown 渲染、session 过期跳转。 | | |
| 13 | **更多 API 集成测试** | 阶段 5 | 2h |
| | 已有 `posts.test.ts` 和 `auth.test.ts`（基于 InMemory repository）。需补充：上传、归档状态流转、`publishedAt` 保留逻辑、边界条件。 | | |
| 14 | **RSS Feed** | 阶段 4 可选 | 1.5h |
| | `GET /api/feed.xml` 或 `GET /rss`，标准 RSS 2.0 / Atom。 | | |
| 15 | **站点标题 / 描述配置** | 阶段 4 可选 | 1h |
| | 当前硬编码 "Blogus"；需支持环境变量或数据库配置站点名称、描述、favicon。 | | |
| 16 | **作者信息展示** | 阶段 4 可选 | 1h |
| | 文章列表 / 详情页显示作者名称。`users` 表已有 `name` 字段但未在前端使用。 | | |
| 17 | **Redis 实际接入** | DEV.md | 2h+ |
| | 当前仅记录配置（`REDIS_URL`），未存储任何数据。可用于：session 缓存、rate limit、任务队列。 | | |

---

## P3 — 技术债务

| # | 事项 | 来源 | 预估工作量 |
|---|------|------|-----------|
| 18 | **Admin UI 图标清理** | `AdminPage.tsx` 注释导入 | 0.5h |
| | `TrashIcon`、`ArchiveIcon`、`ArrowSquareOutIcon`、`FloppyDiskIcon` 被注释导入但未使用。 | | |
| 19 | **Upload route 无测试** | `server/src/routes/upload.ts` | 1h |
| | 唯一没有测试覆盖的路由。 | | |
| 20 | **CLI 命令补全** | DEV.md CLI 列表 | 1h |
| | README 列出 `post edit` 和 `post publish`，需确认 `post delete`、`post unpublish` 等管理命令是否齐全。 | | |

---

## 建议执行顺序

```text
✅ Session E2E (T6-T9) — 已完成
✅ 健康检查 — 已完成
✅ build 验证 — 已完成（SERVE_CLIENT 托管前端）
✅ 部署文档 — 已完成
  → DB 迁移 + 备份文档
    → Cookie 安全 + 上传加固 + Rate Limit
      → 测试补充 + RSS + 站点配置
```

核心逻辑：**先保证能发布上线（P0），再加固安全（P1），然后打磨体验（P2），最后清理债务（P3）**。
