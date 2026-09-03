## Why

tool-station 的 `text-cards` 画布工具仅在浏览器本地（`localStorage` + IndexedDB）持久化，无法跨设备同步，也无法与 Blogus 登录体系集成。作者需要在 Blogus 内拥有一套**登录专属**的多工作区文本卡片工具，以 **PostgreSQL 为权威数据源**，并支持 v1 JSON 备份互通。

本 change 采用**最小可上线**策略：先交付持久化、多工作区与列表式编辑；无限画布、语法高亮等 tool-station 高阶交互留给后续 change `enhance-text-cards-canvas`。对齐既有工具页惯例（页脚入口、lazy 路由、不进入顶部导航）。

## What Changes

- 新增 PostgreSQL 表 `text_card_workspaces`、`text_card_panes`（pane 经 `workspace_id` JOIN 校验归属，无 `panes.user_id` 冗余）。
- 新增 `/api/text-cards/*` REST API（全部需登录），覆盖工作区 CRUD、卡片 CRUD、JSON 导入覆盖。
- 新增前端路由 `/tools/text-cards`（React lazy 独立 chunk，全屏工具页，不套 `BlogLayout`）。
- 页脚「工具与管理」区增加「卡片笔记」链接，**仅登录后显示**；`Navigation.tsx` 不添加入口。
- 访客直链 `/tools/text-cards` 重定向 `/login?redirect=/tools/text-cards`。
- **列表式 UI**：垂直列表展示卡片，标题 + 正文 textarea，debounce 自动保存（布局字段入库但不提供拖拽等控件）。
- 支持 v1 JSON 导出/导入，与 tool-station 备份格式核心字段兼容（`hl_mode` 等 round-trip，MVP UI 不切换高亮）；**不**读取浏览器 `jsonv_index` / `JsonViewerDB`。
- 浏览器 `localStorage` 仅保存上次活跃工作区 ID（非权威）；**不使用 IndexedDB**。

## Product Decisions（已裁决）

| # | 决策 |
|---|------|
| 1 | **后端权威**：所有卡片与工作区以 PostgreSQL 为准；刷新/换设备不丢数据。 |
| 2 | **登录门禁**：无匿名读；API 与页面均要求有效会话。 |
| 3 | **页脚入口**：工具链接放 `Footer.tsx`；顶部导航不出现。 |
| 4 | **全屏工具页**：与 `ImageEditorPage` 一致，独立于博客正文布局。 |
| 5 | **MVP UI**：列表式编辑，非无限画布；画布交互后续 change 补齐。 |
| 6 | **MVP 导入**：JSON v1 覆盖当前工作区；允许导入后 0 张卡；v2 全量导入后续。 |
| 7 | **hl_mode 存储**：import/export round-trip，MVP UI 始终 Raw 编辑。 |
| 8 | **删除约束**：每用户至少 1 个工作区；工作区允许 0 张卡片。 |
| 9 | **首次 bootstrap**：`GET /workspaces` 只读；空列表由前端 `POST /workspaces` 创建。 |
| 10 | **冲突策略**：last-write-wins；不做乐观锁 409。 |
| 11 | **旧版迁移**：用户手动「旧站导出 JSON → 新站载入」，不做浏览器存储自动迁移。 |

## Capabilities

### New Capabilities

- `blogus-text-cards-api`：工作区/卡片数据模型、鉴权 API、越权隔离、导入覆盖、删除约束。
- `blogus-text-cards-canvas`：全屏工具页、多工作区 UI、列表式卡片编辑、debounce 保存、JSON 备份、页脚入口与登录重定向。

### Modified Capabilities

无（新模块）。

## Architecture Impact

```text
Footer（登录可见）→ /tools/text-cards（lazy）
        ↓
TextCardsPage（全屏，列表式）
        ↓ PATCH debounce / flush
/api/text-cards/*（authenticate）
        ↓
DrizzleTextCardRepository（workspace JOIN 越权）
        ↓
PostgreSQL text_card_workspaces / text_card_panes
```

## Impact

| 范围 | 内容 |
|------|------|
| `server/src/db/schema.ts` | 新增两张表（无 `max_z_index`、无 `panes.user_id`） |
| `server/src/plugins/db.ts` | 幂等建表 |
| `server/src/repositories/text-cards.ts` | 新建 |
| `server/src/routes/text-cards.ts` | 新建 |
| `server/src/app.ts` | 挂载 `/api/text-cards` |
| `shared/src/types.ts` | `TextCardWorkspace` / `TextCardPane` 等 |
| `client/src/pages/TextCardsPage.tsx` | 新建全屏页 |
| `client/src/features/text-cards/**` | 列表编辑、备份、hooks |
| `client/src/components/text-cards/**` | UI 组件 |
| `client/src/lib/text-cards.ts` | API 封装 |
| `client/src/main.tsx` | lazy 路由 |
| `client/src/components/Footer.tsx` | 登录后显示入口 |
| `README.md` / `AGENTS.md` / `DEV.md` | 路由与开发说明（实施时同步） |

## Out of Scope（本 change）

- 无限画布交互（拖拽、resize、z-order、最小化/最大化、chip 索引）→ `enhance-text-cards-canvas`。
- 语法高亮预览 UI → 同上。
- 乐观锁 `expectedUpdatedAt` → 409。
- 列表视图（`tool-station/text-cards/notes.html`）。
- 多用户协作 / 共享工作区。
- 离线优先或 IndexedDB 正文缓存。
- v2 全量多工作区导入 UI。
- CLI 命令。
- 公开只读画布。

## 验证方向

- 服务端单测：鉴权、越权、至少 1 工作区约束、import 覆盖（含空数组）、GET 无副作用、CRUD。
- `pnpm typecheck` + client/server build。
- 手工：登录 → 页脚入口 → bootstrap 空工作区 → CRUD → 切换工作区 flush → 导出 v1 → 载入覆盖 → 刷新不丢数据。
- 访客：页脚无入口、直链跳登录。

## 后续工件

- `design.md`：表结构、API 契约、MVP 范围与 Deferred 清单。
- `tasks.md`：P1 后端 → P2 列表 MVP → P3 多工作区/备份/验收。
- `specs/**`：2 个 capability delta（本 change 范围）。

## 设计参考

tool-station `text-cards/DESIGN.md` 描述完整画布愿景（非 OpenSpec 权威源）。**冲突以本 change 的 specs 为准**；画布/高亮项见 `design.md` Deferred，由 `enhance-text-cards-canvas` 交付。
