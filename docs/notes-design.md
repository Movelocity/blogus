# 笔记功能设计

> 状态：后端已完成并通过真实库冒烟；前端已交付（公开页 + 管理一体，轻量日历整合进笔记页）；CLI 待开发（可选）。
> 关联交接：见团队交接文档「Blogus 笔记功能·后端交接文档」。

## 1. 背景与目标

为 Blogus 原生新增一套轻量笔记体系，参考 `~/projects/nextblog` 的笔记设计，但按 Blogus 现有技术栈原生实现，不搬代码。

- 技术栈：Node + Fastify + PostgreSQL + Drizzle + React/Vite（与文章模块一致）。
- 定位：日记式、按日锚定的轻量笔记；有公开页；轻量日历整合进笔记页。
- 独立性：笔记与文章（`posts`）互相独立，不共用表、不共用接口，仅复用既有基础设施（鉴权、错误处理、repository 分层、幂等建表）。

## 2. 数据模型

### `notes` 表

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid PK | 沿用 Blogus 习惯，`defaultRandom()` |
| user_id | uuid → users ON DELETE CASCADE | 归属用户 |
| date | date (YYYY-MM-DD)，索引 | 按日锚定的日记式笔记 |
| content | text | Markdown 内容 |
| is_public | boolean 默认 false | 公开 / 私有 |
| is_archived | boolean 默认 false | 归档（软隐藏，不清除） |
| tags | text[] | 标签 |
| created_at / updated_at | timestamptz | 自动维护 |

索引：`notes_user_id_idx`、`notes_date_idx`（对应 `notes` 表的 `user_id`、`date` 字段）。

与文章模块的差异：笔记是轻量的，无标题/摘要/封面/slug 等字段；归档为软隐藏而非下架状态机。

## 3. 可见性语义

对齐 Blogus `posts` 的可见性分层，但笔记增加「归档」维度：

- `published`：公开且未归档；所有视角一致。
- `all` / `archived`：本人视角，需登录；`isPublic` 过滤仅在此视图对本人生效。
- 日历 / 搜索为可选鉴权：登录返回更完整结果（含本人私有），匿名仍可用（仅公开），通过 `resolveOptionalUser` 复用 auth 会话校验，不阻塞匿名。

归档即软隐藏，不物理删除；删除为物理删除（本人）。

## 4. API 设计

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/notes | 列表；默认公开未归档；`visibility=all\|archived` 需登录（本人视角），支持 `date`/`tag`/`isPublic`/`page`/`pageSize` |
| GET | /api/notes/:id | 详情（公开或本人） |
| POST | /api/notes | 创建（登录）；`date` 缺省用当天 |
| PATCH | /api/notes/:id | 更新（本人） |
| PUT | /api/notes/:id/archive | 归档/取消归档（本人），body `{isArchived}` |
| DELETE | /api/notes/:id | 删除（本人） |
| GET | /api/notes/calendar?year=&month= | 每天笔记密度；匿名仅公开，登录含本人私有；均排除归档 |
| GET | /api/notes/search?keyword= | 内容/标签搜索；登录含本人私有/归档，匿名仅公开未归档 |

可见性/越权约束集中在 repository 层实现（`visibilityConditions`、`findOwned`），路由层只做参数校验与鉴权门禁。

## 5. 实现要点

### 鉴权
- 写操作与管理视图用 `app.authenticate`（与 posts 一致）。
- 详情 / 日历 / 搜索用 `resolveOptionalUser`：登录了返回本人视角，匿名可用，不抛错。

### 分层
- `shared/src/types.ts`：`BlogNote` / `CreateNoteInput` / `UpdateNoteInput` / `NoteVisibility` / `NoteListResult` / `NoteCalendarIndex`。
- `server/src/db/schema.ts`：`notes` 表 drizzle 定义。
- `server/src/plugins/db.ts`：`ensureDatabaseSchema` 追加幂等建表 + 索引（首次启动自动建表）。
- `server/src/schema/notes.ts`：zod 校验。
- `server/src/repositories/notes.ts`：`DrizzleNoteRepository`（可见性、越权、归档、日历、搜索都在这里）。
- `server/src/routes/notes.ts`：`createNoteRoutes` + `resolveOptionalUser`。
- `server/src/app.ts`：挂载 `/api/notes`。

## 6. 数据校验（zod）

- 日期必须匹配 `YYYY-MM-DD`。
- `content` trim 后至少 1 字符；创建必填，更新可选。
- `tags`：单个标签 trim 后 1..60 字符，最多 12 个。
- `page` 最小 1；`pageSize` 1..100 默认 20。
- `visibility` 枚举 `published | archived | all`，默认 `published`。
- 日历 `year` 1970..2100、`month` 1..12；搜索 `keyword` 至少 1 字符。

## 7. 前端实现（已交付）

笔记页 `client/src/pages/NotesPage.tsx`（路由 `/notes`，`BlogLayout` 内）公开 + 管理一体：登录显示编辑器与完整过滤，匿名只读公开笔记。配套组件在 `client/src/components/notes/`：

- `NoteEditor.tsx`：内容 + 标签 + 公开/私密开关，草稿自动缓存到 `localStorage`，Ctrl/Cmd+S 保存；结构对齐 nextblog，颜色收敛为三色层级（网站背景 / 卡片背景 / 卡片按钮），不引入 accent/绿色。
- `NoteCard.tsx`：查看（复用 `MarkdownView`，过长折叠/展开）/ 内联编辑 / 公开切换 / 归档 / 删除 / 复制。
- `NoteSidebar.tsx`：轻量日历（按 `GET /api/notes/calendar` 密度着色，点日期 `?date=` 筛当日）+ 过滤（仅公开/查看归档）+ 搜索 + 标签统计。

API 封装在 `client/src/lib/notes.ts`（对齐 `api.ts` 的 `request<T>` 风格）；轻量 toast 自实现于 `client/src/lib/toast.tsx`（Blogus 原本无 toast 组件）。

登录态判定：先用 `refreshSession()` 探明是否已有有效会话，再 `whoami()` 取用户信息——避免匿名时直接调 `whoami()` 返回 401 触发 session-expired 跳转。

过滤语义：匿名走 `published`；登录默认 `all`（本人全部，含归档），"仅显示公开"叠加 `isPublic=true`，"查看已归档"切 `archived`；搜索与日期筛选沿用后端对应参数。

## 8. CLI 规划（可选）

- `blogus-cli note` 命令：创建/列出/编辑/归档/删除笔记，沿用 CLI 现有 `post` 命令交互范式。

## 9. 验证

- `pnpm typecheck` 通过。
- `pnpm --filter @blogus/server build` 通过。
- `pnpm --filter @blogus/client build` 通过（笔记页按需拆为独立 chunk）。
- 服务端单测 21/21 全绿（含 8 个笔记用例：鉴权、公开/私有、日期/标签过滤、越权隔离、归档、日历、搜索、错误码）。
- 真实库冒烟通过：`notes` 表经 `ensureDatabaseSchema` 在真实 Postgres 正确建出（含索引与级联外键），CRUD/越权/归档/日历/搜索/删除均验证符合预期。
- 前端冒烟：匿名公开页渲染正常（日历/空态/导航）；登录后 CRUD/归档/日历密度/搜索/标签过滤/可见性经真实库逐项验证通过。

## 10. 待办

- [x] 前端：笔记公开页 + 管理页 + 轻量日历整合
- [ ] `blogus-cli note` 命令（可选）
