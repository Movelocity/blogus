## Context

tool-station `text-cards/index.html` 已实现完整的单工作区画布交互（拖拽、resize、高亮、JSON 备份），但数据存于浏览器。Blogus 已有成熟的 notes/posts 后端分层（Fastify + Drizzle + `app.authenticate` + repository 越权隔离）和工具页范式（`ImageEditorPage` 全屏 lazy + 页脚入口）。

本 change 采用**最小可上线**策略：先交付「登录专属 + 服务端持久化 + 多工作区 + 卡片编辑/备份」，画布拖拽等高阶交互留给后续 change。布局相关字段仍入库，以便 v1 JSON 导入与后续画布 change 无需改表。

## Goals / Non-Goals

**Goals（本 change）：**

- 登录用户可管理多工作区、多文本卡片，数据存 PostgreSQL（服务端权威）。
- API 与 UI 分层对齐 `notes` 模块习惯。
- 页脚入口；访客不可见、不可用。
- 标题/正文 debounce 自动保存；切换工作区前 flush，不丢编辑。
- v1 JSON 导入/导出（客户端组装 export），兼容 tool-station 备份格式中的核心字段。

**Non-Goals（本 change）：**

- 无限画布交互（拖拽、resize、z-order、最小化/最大化、chip 索引）→ 后续 change `enhance-text-cards-canvas`。
- 语法高亮预览（`hl_mode` 仅存储与 round-trip，UI 始终 Raw 编辑）→ 同上。
- 乐观锁 / 多标签冲突合并（last-write-wins）。
- 列表视图、协作、公开分享。
- IndexedDB / localStorage 作为正文存储。
- 浏览器旧存储自动迁移。
- 超大文本（>1MB）优化。

## Decisions

### 1. 两张表，pane 归属经 workspace JOIN 校验

`text_card_workspaces` 管工作区元数据；`text_card_panes` 存布局字段与 `content`。**不在 pane 表冗余 `user_id`**，`findOwnedPane` 通过 `workspace_id` JOIN `workspaces.user_id` 校验，与数据模型单一真相一致。

**延后**：`max_z_index` 工作区字段。MVP 新建卡片时客户端用 `max(existing z_index) + 1`；服务端 PATCH 不维护冗余列。

### 2. 全部 API 需登录

`/api/text-cards/*` 统一 `app.authenticate`。页面未登录重定向 `/login?redirect=/tools/text-cards`。

### 3. 客户端 debounce + 服务端 PATCH（last-write-wins）

标题/正文 debounce 600ms → `PATCH /panes/:id`。切换工作区前 `flush` 全部 pending 请求并 `await`。

**本 change 不做**：拖拽过程中的 DOM/ref 优化、布局类字段的即时 PATCH（布局字段仅在 import 或后续画布 change 写入）。

### 4. 乐观锁：不做

多标签覆盖接受 last-write-wins。若后续有需求，在 follow-up change 加 `expectedUpdatedAt` → 409。

### 5. 删除约束（放宽 pane，保留 workspace）

- 删除工作区：若为用户最后一个工作区 → 400。
- 删除卡片：**允许删至 0 张**；空工作区显示 empty state +「新建卡片」。
- 删除工作区：CASCADE 删除下属 panes。

**替代方案（不采用）**：每工作区至少 1 张卡。会增加占位空卡、import 边界复杂度，且对 MVP 列表式 UI 无必要。

### 6. 首次使用：显式 bootstrap，GET 无副作用

`GET /workspaces` **只读**，空列表返回 `[]`。

前端首次进入：若列表为空，调用 `POST /workspaces` 创建默认工作区（名称 `工作区 1`），**不**自动插入 pane；用户点「新建卡片」或导入 JSON 才有内容。

**替代方案（不采用）**：GET 惰性创建。读接口副作用难测试、难缓存，且多标签 race。

### 7. 导入为「覆盖当前工作区」

`POST /workspaces/:id/import` 接收 `{ panes: [...] }`：事务内删除该工作区全部 panes，批量 insert normalize 结果。允许导入后 0 张（空数组 → 空工作区）。

`normalizePane` 兼容 v1 缺省字段、`highlightOn` → `hl_mode: 'json'`；非法坐标回退默认值。**MVP UI 不渲染高亮**，但字段写入 DB 以备后续 change。

v2 全量多工作区导入留给后续 change。

### 8. 入口仅页脚 + 登录可见

`Footer.tsx` 在 `refreshSession()` 成功后渲染「卡片笔记」。`Navigation.tsx` 不添加链接。

### 9. 本地偏好非权威

`localStorage` key `blogus:text-cards:active-workspace` 仅存上次选中工作区 ID。无效时回退列表第一项。

### 10. MVP UI：列表式编辑，非无限画布

卡片以**垂直列表**（或简单网格）展示：标题 input + 正文 textarea。`x/y/width/height/z_index/minimized/word_wrap/hl_mode` 从 API 加载并随 PATCH/import 持久化，但本 change **不提供**拖拽、resize、最小化等控件。

常量（默认宽高、debounce 间隔）集中 `client/src/features/text-cards/constants.ts`，避免魔法数散落。

### 11. 与 `notes` 模块的关系

intentionally 分叉：text-cards 是自由形态卡片 + 工作区，notes 是日期日记。本 change 不统一内容模型；后续是否互通另开 proposal。

## Data Model

### `text_card_workspaces`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid FK → users CASCADE | |
| name | text NOT NULL | 默认 `工作区 {n}` |
| created_at / updated_at | timestamptz | |

索引：`text_card_workspaces_user_id_idx`

### `text_card_panes`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| workspace_id | uuid FK → workspaces CASCADE | |
| title | text | |
| content | text DEFAULT '' | |
| x, y | integer | 默认 0 / 0；import 或后续画布使用 |
| width, height | integer | 默认 560 / 280 |
| z_index | integer DEFAULT 1 | |
| hl_mode | text DEFAULT '' | 存储兼容；MVP UI 不切换 |
| minimized | boolean DEFAULT false | 存储兼容；MVP UI 忽略 |
| word_wrap | boolean DEFAULT true | 存储兼容；MVP UI 忽略 |
| created_at / updated_at | timestamptz | |

索引：`text_card_panes_workspace_id_idx`

## API Summary

前缀 `/api/text-cards`，均需登录。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/workspaces` | 列表含 `paneCount`；只读，空则 `[]` |
| POST | `/workspaces` | 新建空工作区（0 pane） |
| PATCH | `/workspaces/:id` | `{ name }` |
| DELETE | `/workspaces/:id` | 至少保留 1 个工作区 |
| GET | `/workspaces/:id/panes` | 全量含 content |
| POST | `/workspaces/:id/panes` | 新建（默认布局常量） |
| PATCH | `/panes/:id` | partial update |
| DELETE | `/panes/:id` | 允许删至 0 |
| POST | `/workspaces/:id/import` | `{ panes }` 覆盖 |

导出 v1 JSON 由客户端从已加载数据组装，无 export API。

## Frontend Structure（MVP）

```
client/src/pages/TextCardsPage.tsx
client/src/features/text-cards/{backup,constants,hooks}
client/src/components/text-cards/{WorkspaceSwitcher,PaneList,PaneCard,ImportExportMenu}
client/src/lib/text-cards.ts
```

路由：`main.tsx` lazy `/tools/text-cards`，与 `ImageEditorPage` 同级，不在 `BlogLayout` 内。

## Phased Delivery（本 change）

| Phase | 范围 | 可验收 |
|-------|------|--------|
| P1 | 表 + 精简 API + 单测 | curl/单测 CRUD、import、bootstrap |
| P2 | 页壳 + 鉴权 + 列表式单工作区编辑保存 | 登录后能打字并刷新保留 |
| P3 | 多工作区 + flush + v1 导入导出 + 页脚入口 | 切换不丢、JSON 往返、访客无入口 |

## Deferred（后续 change）

以下从原 proposal 移出，建议单独立项 `enhance-text-cards-canvas`：

| 项 | 说明 |
|----|------|
| 无限画布 | 拖拽、resize、z-order、`max_z_index`、TopBar 最小化、最大化 shadow |
| PaneIndex chips | 聚焦、滚动居中 |
| 语法高亮 | `highlight.ts` 移植 + `HlModeDropdown` 只读预览 |
| 乐观锁 | `expectedUpdatedAt` → 409 |
| `panes.user_id` 冗余 | 若 JOIN 成为热点再评估 |
| 分页 / 懒加载 content | pane 数量或正文变大时 |
| v2 全量多工作区导入 | |

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| debounce 与工作区切换竞态 | `usePaneSave` flush；切换时 await pending PATCH |
| MVP 无画布，与 tool-station 体验差距 | 明确产品预期；布局字段已入库，follow-up 可渐进启用 |
| 大正文 PATCH 频繁 | debounce 600ms |
| 多标签页编辑同一 pane | last-write-wins；文档说明限制 |
| pane 数量多时首屏慢 | MVP 全量 GET；后续分页 |
| import 含 hl_mode 但 UI 不展示 | 字段保留，避免丢数据；follow-up 启用预览 |

## Migration Plan

1. `ensureDatabaseSchema` 追加建表（幂等）。
2. 部署 API + 前端路由。
3. 用户从 tool-station 导出 JSON → Blogus 载入（v1）。

无浏览器存储自动迁移。回滚：下线路由与 API；表保留以免丢数据。

## Resolved（原 Open Questions）

| 问题 | 本 change 裁决 |
|------|----------------|
| 首次空工作区谁创建 | 前端见空列表 → `POST /workspaces` |
| 409 冲突 UI | 不做乐观锁 |
| v2 全量导出 | 不做 |
| 至少 1 张卡 | 不做；允许空工作区 |
