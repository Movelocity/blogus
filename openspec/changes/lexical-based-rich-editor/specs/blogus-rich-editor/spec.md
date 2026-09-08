## ADDED Requirements

> **POC 前置条件**：下列 Requirements 仅在 `design.md` Spike 闸门（S1–S4）全部通过后适用。闸门评估不通过时，本 capability 不予实施，系统不得对外暴露残缺工具页；收口流程见 `proposal.md`「POC 护栏」与 `tasks.md` §0.6。

### Requirement: Public fullscreen tool route
系统 SHALL 提供全屏工具页路由 `/tools/rich-editor`，使用 React lazy 独立 chunk 加载，且 MUST NOT 包裹在 `BlogLayout` 内。本 change 不要求登录即可访问与编辑。

#### Scenario: Direct access without login
- **WHEN** 访客访问 `/tools/rich-editor`
- **THEN** 渲染全屏富文本编辑器页面，不重定向至登录页

#### Scenario: Lazy isolated chunk
- **WHEN** 执行 client 生产构建
- **THEN** 产出独立的 `RichEditorPage-*.js` chunk，不合并进博客首屏入口包

### Requirement: Footer-only entry always visible
「富文本编辑器」入口 SHALL 仅出现在站点页脚（`Footer` 组件），且 MUST 对访客与登录用户均可见。顶部导航（`Navigation.tsx`）MUST NOT 包含该入口。

#### Scenario: Anonymous site footer
- **WHEN** 访客浏览含页脚的博客页面
- **THEN** 页脚显示指向 `/tools/rich-editor` 的「富文本编辑器」链接

#### Scenario: Logged-in site footer
- **WHEN** 登录用户浏览含页脚的博客页面
- **THEN** 页脚同样显示「富文本编辑器」链接

### Requirement: Lexical block and inline editing
编辑器 SHALL 基于 Lexical 支持以下块类型：H1–H6、嵌套有序/无序列表、check list、段落、引用、水平分隔线、code block、inline link。内联样式 SHALL 包含 bold、italic、underline、strikethrough、inline code。Undo/Redo MUST 使用 Lexical `HistoryPlugin`。

#### Scenario: Create heading and list
- **WHEN** 用户通过工具栏或 Slash 菜单插入标题与嵌套列表
- **THEN** 文档中出现对应 Lexical 节点且可继续编辑

#### Scenario: Toggle check list item
- **WHEN** 用户创建 check list 并切换某项勾选状态
- **THEN** 对应 `ListItemNode` 的 checked 状态更新且可 Undo

#### Scenario: Undo after format change
- **WHEN** 用户对选区应用 bold 后触发 Undo
- **THEN** 文本恢复为加粗前状态

### Requirement: Custom decorator blocks
编辑器 SHALL 提供三个自定义块级 `DecoratorNode`：`ImageNode`、`LinkCardNode`、`AttachmentNode`，序列化字段与 `design.md` 一致。

#### Scenario: Insert link card manually
- **WHEN** 用户通过 Slash 或工具栏选择插入 link card 并填写 url、title、description
- **THEN** 渲染块级卡片，块内不可直接编辑正文，选中整块后可 Delete 删除

#### Scenario: Paste remote image URL
- **WHEN** 用户粘贴含 `<img src="https://example.com/a.png">` 的 HTML
- **THEN** 插入 `ImageNode` 且 `src` 保持原始远程 URL，不触发 re-upload

#### Scenario: Insert attachment after upload
- **WHEN** 登录用户插入或粘贴非图片文件且上传成功
- **THEN** 插入 `AttachmentNode` 并显示文件名、大小与下载链接，且在本地 asset registry 登记

### Requirement: Slash menu block insertion
编辑器 SHALL 提供 `/` Slash 菜单，交互类似 AdminPage `SlashMenu`，用于插入各块类型（含自定义节点入口）。

#### Scenario: Slash insert block
- **WHEN** 用户在编辑区输入 `/` 并选择某块类型（如引用或分隔线）
- **THEN** 在光标处插入对应 Lexical 块节点

### Requirement: Floating selection format menu
当用户在可编辑文本内选中非 collapsed 选区时，系统 SHALL 显示单行浮动菜单，提供 bold、italic、underline、strikethrough、inline code 与清除格式。在 `contenteditable=false` 的 Image、LinkCard、Attachment 块内 MUST NOT 显示该菜单。

#### Scenario: Show menu on text selection
- **WHEN** 用户在段落内划选多个字符
- **THEN** 选区附近显示浮动格式菜单且可应用 bold

#### Scenario: Hide menu inside image block
- **WHEN** 用户仅选中图片装饰块
- **THEN** 不显示划词浮动菜单

### Requirement: Rich paste and file drop
系统 SHALL 通过 `PastePlugin` 与 `FileDropPlugin` 处理粘贴与拖放：剪贴板图片/附件文件走上传分支；`text/html` 经 `$generateNodesFromDOM` 与自定义规则转为 Lexical 节点；仅 `text/plain` 时按行拆段落。空文档粘贴 MUST 使用相同逻辑。普通 `<a>` 粘贴 MUST 映射为 inline `LinkNode`，而非 Link card。

#### Scenario: Paste HTML with checklist
- **WHEN** 用户粘贴含 `li` 内 `input[type=checkbox][checked]` 的 HTML
- **THEN** 生成 check list 且对应项为 checked

#### Scenario: Paste plain text lines
- **WHEN** 用户粘贴仅含 `text/plain` 的多行文本
- **THEN** 按行插入多个段落节点

#### Scenario: Drop image file while logged in
- **WHEN** 登录用户将图片文件拖入编辑区且上传成功
- **THEN** 插入 `ImageNode`，`src` 为上传返回的 URL，并登记 asset

### Requirement: Optional upload with login gate
本地上传图片与附件 SHALL 复用既有 `uploadFile()` 与 `/api/upload`。未登录时上传失败 MUST 向用户显示明确提示，且 MUST NOT 插入对应块。

#### Scenario: Upload without session
- **WHEN** 未登录用户粘贴本地图片文件
- **THEN** 显示需要登录的提示且不插入图片块

### Requirement: Local autosave draft
编辑内容 SHALL debounce（500ms）后写入 `localStorage` key `blogus:rich-editor:draft`，格式为 `RichEditorSnapshotV1`（含 `editorState` 与 `assets`）。页面加载时 MUST 从该 key 恢复草稿（若存在且可解析）。

#### Scenario: Reload preserves draft
- **WHEN** 用户编辑后刷新页面
- **THEN** 编辑器恢复刷新前的文档内容与本地 asset 列表

#### Scenario: Autosave status in header
- **WHEN** 自动保存成功
- **THEN** 顶栏显示带时间的已保存状态

### Requirement: JSON export and import
工具页 SHALL 支持将当前文档导出为 JSON 文件（`format: blogus-rich-editor`, `version: 1`），并支持从文件导入。导入前 MUST 校验 `format` 与 `version`；校验失败 MUST toast 报错且不静默覆盖；成功导入前 SHOULD 经用户确认覆盖当前草稿。

#### Scenario: Export download
- **WHEN** 用户点击导出 JSON
- **THEN** 浏览器下载包含当前 `editorState` 与 `assets` 的 JSON 文件

#### Scenario: Import invalid file
- **WHEN** 用户选择格式或 version 不匹配的 JSON
- **THEN** 显示错误提示且保留当前编辑内容

#### Scenario: Import valid snapshot
- **WHEN** 用户确认导入合法 `RichEditorSnapshotV1`
- **THEN** 编辑器与 asset registry 替换为文件内容

### Requirement: Settings dialog for assets and document
系统 SHALL 提供设置弹窗，含「资源」与「文档」两个 Tab。资源 Tab MUST 列出本地 `AssetRef`（区分图片与附件）、显示大小、扫描当前 `editorState` 是否仍引用，并支持仅从本地 registry 移除（不调用服务器删除 API）。文档 Tab MUST 提供导出、导入与清空草稿。

#### Scenario: Remove unused asset from registry
- **WHEN** 用户在资源 Tab 将某 asset 从列表移除
- **THEN** 该 asset 从本地 registry 删除且服务器文件不受影响

#### Scenario: Show reference status
- **WHEN** 某 `assetId` 仍被 `AttachmentNode` 引用
- **THEN** 资源列表中该条目标记为仍被引用

### Requirement: Isolated editor styles
富文本编辑器样式 SHALL 集中在 `features/rich-editor/rich-editor.css` 与 Lexical theme 映射中，MUST NOT 污染全局 `tailwind.css`。

#### Scenario: Theme classes scoped
- **WHEN** 渲染编辑区内标题与引用块
- **THEN** 使用 `re-*` 等编辑器专用 class，而非修改站点全局排版规则
