## Why

Blogus 需要一套**与博客正文、Notes 无耦合**的 Lexical WYSIWYG 试验页，用于验证块编辑、富文本粘贴、自定义节点与本地草稿体验，再决定是否产品化接入写作流。本 change 采用 **POC 策略**：独立路由、浏览器 `localStorage` 持久化、复用既有 `/api/upload`，不新增服务端文档 API。

对齐既有工具页惯例（页脚入口、lazy 路由、全屏、不进入顶部导航）；与 `ImageEditorPage` 类似**无需登录**即可使用，上传能力在登录后可用。

## POC 护栏（边界克制）

本 change 是**可撤销试验**，不以「必须交付完整工具页」为前提。实施须保持克制：

- **不扩 scope**：调研或实现中不得借故引入 Out of Scope 项（服务端文档 API、与 Notes/Admin 打通、OG 抓取、远程图片 re-upload 等）。
- **达标才继续**：P1 壳层完成后做 Spike（见 `design.md`「Spike 闸门」），对照 `specs/blogus-rich-editor/spec.md` 的最低可用标准评估；**任一闸门不通过则放弃本 change**，不强行上线残缺功能。
- **放弃优于 workaround 堆砌**：若 Lexical 在 POC 边界内无法满足粘贴、自定义节点或 bundle 隔离等核心预期，应停止而非用大量定制 sanitizer、fork 或后端补丁硬撑。
- **放弃时收口**：revert 已合入的路由/页脚/依赖与文档；在 change 目录记录 `ABANDONED.md`（原因 + 调研结论）；**不向用户暴露半成品页面**。

## What Changes

- 新增前端路由 `/tools/rich-editor`（React lazy 独立 chunk，全屏工具页，不套 `BlogLayout`）。
- 页脚「工具与管理」区增加「富文本编辑器」链接，**始终可见**（无需登录）；`Navigation.tsx` 不添加入口。
- 基于 Lexical 实现 WYSIWYG：H1–H6、嵌套列表、check list、引用、分隔线、code block、内联格式、划词浮动菜单、`/` Slash 插入块。
- 三个自定义 `DecoratorNode`：图片、Link card、附件块。
- 粘贴/拖放：富文本 HTML → Lexical 节点；远程图片 URL 原样保留；本地图片/附件在登录后走 `uploadFile()`。
- `localStorage` debounce 自动草稿 + 设置弹窗内 JSON 导出/导入 + 本地 asset registry。
- Lexical 内置 `HistoryPlugin` 提供 Undo/Redo。

## Product Decisions（已裁决）

| # | 决策 |
|---|------|
| 1 | **无服务端持久化**：权威数据在浏览器；导出 JSON 为备份手段。 |
| 2 | **无需登录**：页面与编辑可用；未登录时上传失败属预期，须轻提示。 |
| 3 | **页脚入口**：放 `Footer.tsx`，始终显示；顶部导航不出现。 |
| 4 | **全屏工具页**：与 `ImageEditorPage` / `TextCardsPage` 一致，独立于博客正文布局。 |
| 5 | **远程图片**：粘贴/插入时保留原 URL，不 re-upload、不 proxy。 |
| 6 | **Link card**：用户主动插入时手填 `url` / `title` / `description`；普通 `<a>` 粘贴仍走 inline `LinkNode`。 |
| 7 | **附件块**：第一期支持非图片文件块；上传流程与图片相同。 |
| 8 | **资源清理**：设置里仅删本地 `assets` registry，不调服务器 delete API。 |
| 9 | **Slash 菜单**：顶栏提供 `/` 插入各块类型（交互参考 AdminPage `SlashMenu`，插入 Lexical 节点）。 |
| 10 | **第一期全做（以 Spike 通过为前提）**：闸门通过后，所列块类型、内联样式、粘贴、划词菜单、三个自定义节点均在本 change 交付；未通过则整项放弃，不做部分交付。 |

## Capabilities

### New Capabilities

- `blogus-rich-editor`：全屏 Lexical 工具页、块/内联编辑、自定义节点、粘贴与拖放、Slash/划词菜单、`localStorage` 草稿、JSON 导入导出、本地 asset registry、页脚入口。

### Modified Capabilities

无（新模块；复用既有 `uploadFile` / `/api/upload`，不改后端契约）。

## Architecture Impact

```text
Footer（始终可见）→ /tools/rich-editor（lazy）
        ↓
RichEditorPage（全屏壳：顶栏、设置、保存状态）
        ↓
LexicalComposer + plugins（Paste / FileDrop / AutoSave / AssetRegistry …）
        ↓
localStorage（blogus:rich-editor:draft）
        ↓（可选，需登录）
uploadFile() → /api/upload（不改后端）
```

## Impact

| 范围 | 内容 |
|------|------|
| `client/package.json` | 新增 Lexical 相关依赖（^0.23+） |
| `client/src/pages/RichEditorPage.tsx` | 新建全屏页 |
| `client/src/components/rich-editor/**` | 编辑器壳、工具栏、对话框、自定义 nodes |
| `client/src/features/rich-editor/**` | schema、theme、plugins、storage、assets |
| `client/src/main.tsx` | lazy 路由 |
| `client/src/components/Footer.tsx` | 「富文本编辑器」入口 |
| `README.md` / `AGENTS.md` / `DEV.md` | 路由、lazy chunk、POC 边界（实施时同步） |

## Out of Scope（本 change）

- 服务端文档 API、PostgreSQL 表、assets list/delete API。
- OG 抓取、远程图片 proxy/re-upload。
- 与 AdminPage、Notes、博客正文编辑器打通。
- Markdown 字符串中转（粘贴直接 DOM → Lexical nodes）。
- 服务器 orphan 文件清理。

## 验证方向

- **Spike 闸门**（P1 后、P2 前）：见 `design.md`；不通过则停止并执行放弃收口，以下验收不适用。
- `pnpm typecheck` + client build；确认 `RichEditorPage-*.js` 独立 chunk。
- 手工：页脚入口 → 打字与块格式 → Undo/Redo → 划词菜单 → `/` Slash 插入 → 粘贴（网页/Word/飞书/HTML）→ 拖放图片/附件（登录/未登录）→ 自动保存刷新恢复 → JSON 导出导入 → 设置里 asset 列表与引用扫描。
- 粘贴 fixture 手测：空文档粘贴富文本、check list、code block、远程 `<img>`。

## 后续工件

- `design.md`：Lexical 组装、节点序列化、持久化格式、插件与 UI 结构。
- `tasks.md`：P1 壳层 → P2 编辑器核心 → P3 自定义节点与粘贴 → P4 持久化与设置 → P5 文档验收。
- `specs/blogus-rich-editor/spec.md`：capability delta（本 change 范围）。
