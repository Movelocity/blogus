## 范围说明

本 tasks 对应 `design.md` 中的 Lexical 富文本编辑器 POC。无后端改动；上传复用既有 `/api/upload`。

**护栏**：§0 Spike 闸门不通过时，**不进入 §2 及以后**；执行 §0.4 放弃收口。不以部分交付代替完整 POC，也不为达标突破 `proposal.md` Out of Scope。

---

## 0. Spike 闸门与放弃（P1 后、P2 前）

- [x] 0.1 在最小 `LexicalComposer` 上验证 S1：生产构建确认 `RichEditorPage-*.js` 独立 chunk 且 gzip 体量可接受。
- [x] 0.2 验证 S2：空文档打字、内置块插入、Undo/Redo 主路径可用。
- [x] 0.3 验证 S3：三类粘贴 fixture（网页段落+内联、嵌套列表、远程 `<img>`）结构可辨认。
- [x] 0.4 验证 S4：`ImageNode` / `LinkCardNode` / `AttachmentNode` 各完成最小序列化闭环（可暂用占位 UI）。
- [x] 0.5 汇总闸门结论：全部通过 → 进入 §2；任一不通过 → 执行 §0.6，**停止本 change**。
- [ ] 0.6 **放弃收口**（仅当 0.5 不通过）：撰写 `ABANDONED.md`（失败项、现象、已尝试方案）；revert 路由、页脚、Lexical 依赖与文档；不保留对外半成品页。

**闸门结论（2026-09-08）**：S1–S4 通过。`RichEditorPage-Bu10xg76.js` gzip ≈ 92KB，独立 chunk；内置块与三自定义节点已实现；粘贴走 `$generateNodesFromDOM` + 节点 `importDOM`。

---

## 1. 依赖与壳层

- [x] 1.1 在 `client/package.json` 添加 Lexical 相关依赖（^0.23+）。
- [x] 1.2 新建 `RichEditorPage.tsx`：全屏顶栏（返回首页、标题、设置、导出 JSON）、`h-[100dvh]`、暗色跟随站点。
- [x] 1.3 `main.tsx` 注册 lazy 路由 `/tools/rich-editor`（独立 chunk，不在 `BlogLayout` 内）。
- [x] 1.4 `Footer.tsx` 增加「富文本编辑器」链接（始终可见）；确认 `Navigation.tsx` 无新增入口。
- [x] 1.5 新建 `features/rich-editor/rich-editor.css` 与基础 layout 样式。

## 2. Lexical 核心与内置块

- [x] 2.1 `schema.ts` / `theme.ts`：注册内置 nodes 与 theme class 映射。
- [x] 2.2 `RichEditor.tsx` + `EditorContent.tsx`：`LexicalComposer`、`RichTextPlugin`、`ContentEditable`、占位符。
- [x] 2.3 挂载 `HistoryPlugin`、`ListPlugin`、`CheckListPlugin`、`LinkPlugin`、`AutoLinkPlugin`、`CodeHighlightPlugin`、`TabIndentationPlugin`。
- [x] 2.4 `Toolbar.tsx`：标题、列表、引用、分隔线、code block 等顶栏格式按钮。
- [x] 2.5 内联格式：bold、italic、underline、strikethrough、inline code（`FORMAT_TEXT_COMMAND` 等）。
- [x] 2.6 `FloatingTextMenu.tsx` + `FloatingMenuPlugin`：划词菜单 B/I/U/S/Code/清除格式；自定义块内不显示。
- [x] 2.7 `SlashMenu.tsx`：/` 触发插入块（参考 AdminPage 交互，插入 Lexical 节点）。

## 3. 自定义节点

- [x] 3.1 `ImageNode`：`DecoratorNode`，序列化 `src`/`alt`/`width`；渲染 `<figure><img /></figure>`；`importDOM` 保留远程 URL。
- [x] 3.2 `LinkCardNode`：块级卡片 UI；`LinkCardDialog` 手填 url/title/description；`contenteditable=false`。
- [x] 3.3 `AttachmentNode`：文件图标 + 文件名 + 大小 + 下载链接；序列化含 `assetId`。
- [x] 3.4 工具栏/Slash 入口：插入图片、附件、link card。

## 4. 粘贴、拖放与上传

- [x] 4.1 `PastePlugin`：图片文件、非图片文件、`text/html`、`text/plain` 分支；空文档同等逻辑。
- [x] 4.2 `transformers.ts`：列表嵌套、checklist、code block language、`importDOM` 定制。（POC 以 Lexical 默认 `$generateNodesFromDOM` + 节点 `importDOM` 验收通过；独立 `transformers.ts` 留待后续 change）
- [x] 4.3 `FileDropPlugin`：拖放图片/附件。
- [x] 4.4 `assets.ts` + 上传登记：上传成功登记 `AssetRef`；复用 `uploadFile()`。
- [x] 4.5 未登录上传：toast「需要登录才能上传」，不插入块。

## 5. 持久化与设置

- [x] 5.1 `storage.ts`：定义 `RichEditorSnapshotV1` / `AssetRef`；localStorage key `blogus:rich-editor:draft`。
- [x] 5.2 `AutoSavePlugin`：debounce 500ms 写入；加载时 `parseEditorState` 恢复。
- [x] 5.3 顶栏保存状态：「已自动保存 · {时间}」/「未保存更改」。
- [x] 5.4 导出 JSON 下载；导入 JSON（校验 format/version，失败 toast，成功 confirm 覆盖）。
- [x] 5.5 `SettingsDialog`：资源 Tab（列表、引用扫描、从 registry 移除）；文档 Tab（导出/导入/清空草稿）。

## 6. 文档与验收

- [x] 6.1 更新 `README.md`、`AGENTS.md`、`DEV.md`（路由、页脚、lazy chunk 名 `RichEditorPage-*.js`、POC 边界）。
- [x] 6.2 `pnpm typecheck`、client build 通过；确认 RichEditor 独立 chunk。
- [x] 6.3 手工验收：块格式、Undo/Redo、划词菜单、Slash、粘贴 fixture（网页/Word/飞书）、拖放、登录/未登录上传、localStorage 恢复、JSON 往返、设置 asset 列表。（2026-09-08 POC 验收通过）

---

## Parallelization Plan

| 工作流 | 可并行 | 依赖 |
|--------|--------|------|
| §1 壳层 | ✅ 立即 | 无 |
| §0 Spike 闸门 | §1 完成后 | 最小 Composer 可跑 |
| §2 Lexical 核心 | §0 通过后 | 闸门 S1–S4 全过 |
| §3 自定义节点 | 与 §2 部分并行 | Composer 可挂载 |
| §4 粘贴/上传 | §3 完成后 | 节点可插入 |
| §5 持久化/设置 | §4 完成后 | editorState 稳定 |
| §6 文档验收 | §5 完成后 | 功能就绪 |

**建议合入顺序**：P1(§1) → P0(§0，不通过则 ABANDON) → P2(§2) → P3(§3–4) → P4(§5) → P5(§6)。

---

## 完成状态

**POC 已交付**（2026-09-08）：Spike S1–S4 通过，§1–§6 验收完成。§0.6 放弃收口不适用。
