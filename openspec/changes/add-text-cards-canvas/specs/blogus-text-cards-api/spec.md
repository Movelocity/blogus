## ADDED Requirements

### Requirement: Authenticated text card API
系统 SHALL 在 `/api/text-cards` 下提供工作区与卡片 REST API，且所有端点 MUST 要求有效登录会话（`app.authenticate`）。匿名请求 MUST 返回 401。

#### Scenario: Anonymous list workspaces
- **WHEN** 未携带有效会话调用 `GET /api/text-cards/workspaces`
- **THEN** 系统返回 401 且不返回任何工作区数据

#### Scenario: Authenticated list workspaces
- **WHEN** 登录用户调用 `GET /api/text-cards/workspaces`
- **THEN** 系统仅返回该 `user_id` 下的工作区列表，每项可选附带 `paneCount`

### Requirement: Workspace and pane ownership isolation
Repository 层 SHALL 通过工作区 `user_id` 校验资源归属；pane 归属经 `workspace_id` JOIN 工作区校验。用户 MUST NOT 读取、修改或删除其他用户的工作区或卡片。

#### Scenario: Access another user's pane
- **WHEN** 用户 A 尝试 `PATCH /api/text-cards/panes/:id`，其中 pane 属于用户 B 的工作区
- **THEN** 系统返回 404（不暴露资源存在）

### Requirement: Persist workspaces and panes in PostgreSQL
系统 SHALL 将工作区元数据与卡片（含正文 `content`、布局、`hl_mode` 等）持久化在 PostgreSQL 表 `text_card_workspaces` 与 `text_card_panes`。服务端数据为权威源。

#### Scenario: Reload after edit
- **WHEN** 用户 PATCH 卡片正文后刷新浏览器
- **THEN** 页面从 API 加载到最新 `content`，与编辑一致

### Requirement: Minimum workspace constraint
系统 SHALL 保证每个用户至少保留 1 个工作区。工作区 MAY 包含 0 张卡片。

#### Scenario: Delete last workspace
- **WHEN** 用户仅有一个工作区并尝试 `DELETE /api/text-cards/workspaces/:id`
- **THEN** 系统拒绝删除并返回可识别的错误

#### Scenario: Delete last pane in workspace
- **WHEN** 工作区内仅有一张卡片并尝试 `DELETE /api/text-cards/panes/:id`
- **THEN** 系统删除该卡片且工作区 `paneCount` 为 0

### Requirement: Read-only workspace list
`GET /api/text-cards/workspaces` SHALL 为只读查询，MUST NOT 因空列表而创建默认工作区或卡片。

#### Scenario: New user empty list
- **WHEN** 新用户首次调用 `GET /api/text-cards/workspaces` 且数据库无记录
- **THEN** 系统返回空数组 `[]` 且不写入数据库

#### Scenario: Explicit workspace creation
- **WHEN** 登录用户调用 `POST /api/text-cards/workspaces`
- **THEN** 系统创建名称为递增默认名的工作区（0 张卡片）并返回该工作区

### Requirement: Import panes overwrite workspace
系统 SHALL 提供 `POST /api/text-cards/workspaces/:id/import`，接收规范化后的 `panes` 数组，在事务内覆盖该工作区全部卡片。导入后工作区 MAY 为 0 张卡片。

#### Scenario: Import v1-compatible panes
- **WHEN** 用户提交合法 import body（含 `title`、`content` 及可选布局字段）
- **THEN** 该工作区旧卡片被替换为新卡片，旧卡片从数据库删除

#### Scenario: Import empty panes array
- **WHEN** 用户提交 `{ panes: [] }`
- **THEN** 该工作区所有卡片被删除且工作区保留为空

#### Scenario: Import with legacy highlightOn
- **WHEN** import 项含 `highlightOn: true` 且无 `hlMode`
- **THEN** 存储为 `hl_mode = 'json'`

### Requirement: Partial pane update
系统 SHALL 支持 `PATCH /api/text-cards/panes/:id` 对部分字段更新，包括 `title`、`content`、位置、尺寸、`z_index`、`hl_mode`、`minimized`、`word_wrap`。并发更新采用 last-write-wins，本 change 不要求乐观锁。

#### Scenario: Debounced content save
- **WHEN** 客户端对正文 debounce 后 PATCH `content`
- **THEN** 仅更新提供的字段及 `updated_at`
