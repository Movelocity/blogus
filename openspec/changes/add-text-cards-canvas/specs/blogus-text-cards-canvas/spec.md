## ADDED Requirements

### Requirement: Login-gated tool route
系统 SHALL 提供全屏工具页路由 `/tools/text-cards`，使用 React lazy 独立 chunk 加载，且 MUST NOT 包裹在 `BlogLayout` 内。

#### Scenario: Unauthenticated direct access
- **WHEN** 访客访问 `/tools/text-cards`
- **THEN** 浏览器导航至 `/login?redirect=/tools/text-cards`

#### Scenario: Authenticated access
- **WHEN** 登录用户访问 `/tools/text-cards`
- **THEN** 渲染全屏工具页并加载该用户工作区数据

### Requirement: Footer-only entry visible when logged in
「卡片笔记」入口 SHALL 仅出现在站点页脚（`Footer` 组件），且仅在确认有效登录会话后渲染。顶部导航（`Navigation.tsx`）MUST NOT 包含该入口。

#### Scenario: Anonymous site footer
- **WHEN** 访客浏览含页脚的博客页面
- **THEN** 页脚不显示「卡片笔记」链接

#### Scenario: Logged-in site footer
- **WHEN** 登录用户浏览含页脚的博客页面
- **THEN** 页脚「工具与管理」区显示指向 `/tools/text-cards` 的「卡片笔记」链接

### Requirement: Multi-workspace UI
工具页 SHALL 支持多工作区：列出工作区名称与卡片数量，支持新建、重命名、删除（至少保留 1 个工作区）及切换。

#### Scenario: Switch workspace
- **WHEN** 用户从工作区 A 切换到工作区 B
- **THEN** 系统在切换前 flush 未保存编辑，加载 B 的卡片，且 A/B 数据互不影响

#### Scenario: Bootstrap first workspace
- **WHEN** 登录用户进入工具页且 `GET /workspaces` 返回空数组
- **THEN** 前端调用 `POST /workspaces` 创建默认工作区并选中

### Requirement: List-style pane editing
工具页 SHALL 以列表形式展示当前工作区的卡片：每张卡片含可编辑标题与正文 textarea。本 change 不要求无限画布、拖拽、resize、最小化/最大化或 chip 索引交互。

#### Scenario: Edit pane content
- **WHEN** 用户在卡片正文 textarea 中输入文字
- **THEN** debounce 后 PATCH 至服务端且刷新后内容保留

#### Scenario: Empty workspace state
- **WHEN** 当前工作区无任何卡片
- **THEN** 显示 empty state 并提供「新建卡片」操作

#### Scenario: Create and delete pane
- **WHEN** 用户新建或删除卡片
- **THEN** 调用对应 API 且列表即时反映变更；删除最后一张卡后工作区可为空

### Requirement: Debounced autosave to server
标题与正文输入 SHALL debounce（600ms）后 PATCH 至服务端。切换工作区前 MUST flush 全部 pending 保存。

#### Scenario: Switch workspace without data loss
- **WHEN** 用户编辑正文后立即切换工作区
- **THEN** 切换完成后再回到原工作区，编辑内容仍在服务端

### Requirement: JSON backup export and import
工具页 SHALL 支持将当前工作区导出为 v1 JSON 文件（`app: text-cards`, `version: 1`），核心字段与 tool-station 备份兼容。载入 v1 文件 SHALL 经 confirm 后调用 import API 覆盖当前工作区。

#### Scenario: Export and re-import round trip
- **WHEN** 用户导出当前工作区 JSON 并在同站载入
- **THEN** 卡片数量、标题、正文与布局字段与导出前一致（id 可能重新生成）

#### Scenario: Import preserves hl_mode without preview UI
- **WHEN** 用户载入含 `hlMode: 'json'` 的 v1 文件
- **THEN** 数据写入服务端且 UI 仍以 Raw textarea 展示正文（本 change 不提供高亮预览）

### Requirement: Non-authoritative client preferences only
客户端 MAY 使用 `localStorage` 保存上次活跃工作区 ID（key `blogus:text-cards:active-workspace`）。客户端 MUST NOT 使用 IndexedDB 或 localStorage 作为卡片正文或索引的权威存储。

#### Scenario: Clear localStorage
- **WHEN** 用户清除 `blogus:text-cards:active-workspace` 后刷新
- **THEN** 仍能从 API 加载全部工作区与卡片；仅活跃工作区选中回退默认

### Requirement: Save status feedback
工具页 SHALL 向用户展示保存状态（保存中 / 已保存 / 失败），PATCH 失败时 MUST 可重试或提示。

#### Scenario: Network error on save
- **WHEN** PATCH 因网络错误失败
- **THEN** UI 显示错误状态且不静默丢弃用户输入
