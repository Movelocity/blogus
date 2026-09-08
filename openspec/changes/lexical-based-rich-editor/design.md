## Context

Blogus 已有工具页范式：`ImageEditorPage`（本地处理、页脚入口、lazy）、`TextCardsPage`（全屏、服务端持久化）。AdminPage 使用自研编辑栈与 `SlashMenu` 交互。本 change 在**独立路由**上试验 Lexical，避免与现有写作流耦合；POC 边界内接受 `localStorage` 单设备草稿与服务器 orphan 上传文件。

**边界克制**：本 change 允许以「调研结论不达标」为正常结局。实施过程中不得为通过验收而悄悄扩大 scope；若 Spike 闸门不通过，按 `proposal.md`「POC 护栏」放弃并收口，后续产品化另开 proposal。

## Goals / Non-Goals

**Goals（本 change）：**

- `/tools/rich-editor` 全屏 Lexical WYSIWYG，第一期块类型与内联样式全部可用。
- 富文本 HTML 粘贴 → Lexical 节点（不经 Markdown 字符串）。
- 图片 / Link card / 附件三个自定义块；登录后本地上传走既有 `uploadFile()`。
- `localStorage` debounce 自动保存；JSON 导出/导入；设置弹窗管理本地 asset registry。
- `/` Slash 菜单与划词浮动菜单。
- 暗色模式跟随站点 `html.dark`。

**Non-Goals（本 change）：**

- 服务端文档存储、协作、多设备同步。
- OG 抓取、远程图片 re-upload/proxy。
- 与 Notes / AdminPage / 博客发布流集成。
- 服务器侧 asset 删除与 orphan 清理。
- 自动化 E2E（以手测与 typecheck/build 为主）。

## Decisions

### 1. Lexical 依赖与内置节点

`client/package.json` 新增：

- `lexical`, `@lexical/react`, `@lexical/rich-text`, `@lexical/list`, `@lexical/link`, `@lexical/code`, `@lexical/selection`, `@lexical/utils`, `@lexical/html`, `@lexical/mark`, `@lexical/history`（均 ^0.23+）。

内置节点覆盖：段落/标题、有序/无序/嵌套列表、check list（`ListItemNode.checked`）、`LinkNode`/`AutoLinkNode`、`CodeNode`/`CodeHighlightNode`、`QuoteNode`、`HorizontalRuleNode`、内联 format、`HistoryPlugin`。

### 2. 三个自定义 DecoratorNode

| 节点 | 序列化要点 | 行为 |
|------|-----------|------|
| `ImageNode` | `src`, `alt?`, `width?` | 远程 URL 原样；本地文件登录后 upload → `src` + `assets` 登记 |
| `LinkCardNode` | `url`, `title`, `description` | 块级卡片，`contenteditable=false`；仅用户主动插入 |
| `AttachmentNode` | `assetId`, `fileName`, `mime`, `url`, `size` | 文件图标 + 下载链接；上传流程同图片 |

### 3. 持久化：`RichEditorSnapshotV1`

```ts
export type RichEditorSnapshotV1 = {
  format: "blogus-rich-editor";
  version: 1;
  title: string;
  updatedAt: string; // ISO
  editorState: SerializedEditorState;
  assets: AssetRef[];
};

export type AssetRef = {
  id: string;
  url: string;
  key?: string;
  bucket?: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
};
```

- **localStorage** key：`blogus:rich-editor:draft`；`AutoSavePlugin` debounce 500ms。
- **导出**：下载 `rich-editor-{timestamp}.json`。
- **导入**：校验 `format`/`version`；失败 toast，不静默覆盖。
- **清理资源**：仅从本地 `assets` 移除记录，不调 delete API。

### 4. 粘贴与拖放（PastePlugin / FileDropPlugin）

优先级：

1. 剪贴板图片文件 → 上传分支（登录检查）。
2. 非图片文件 → 附件上传分支。
3. `text/html` → `$generateNodesFromDOM` + 自定义 `importDOM`（图片、嵌套列表、checklist `input[type=checkbox]`、`<pre><code class="language-xxx">`）。
4. 仅 `text/plain` → 按行拆段落。

空文档占位：「粘贴富文本开始，或按 / 插入块」。

### 5. 划词浮动菜单

`SELECTION_CHANGE_COMMAND` 驱动；选区非 collapsed 且在 editor root 内显示 `B | I | U | S | Code | 清除格式`；`contenteditable=false` 的自定义块内不显示。定位：`Range.getBoundingClientRect()`，优先上方。

### 6. Slash 菜单

顶栏或编辑区内 `/` 触发，交互类似 AdminPage `SlashMenu`，插入 Lexical 块节点（标题、列表、引用、分隔线、图片、附件、link card 等）。

### 7. 样式隔离

`features/rich-editor/rich-editor.css` + `theme.ts` 映射 Lexical class（如 `re-h1`、`re-blockquote`）；不污染全局 `tailwind.css`。

### 8. 与现有基础设施

| 能力 | 用法 |
|------|------|
| `uploadFile()` | 图片/附件；401 由 API 处理，前端 toast |
| `/api/upload` | 不改后端 |
| `AGENTS.md` | lazy、无 BlogLayout、页脚入口、localStorage、上传可选 |

## Frontend Structure

```
client/src/pages/RichEditorPage.tsx
client/src/components/rich-editor/
  RichEditor.tsx, EditorContent.tsx, Toolbar.tsx,
  FloatingTextMenu.tsx, SlashMenu.tsx,
  LinkCardDialog.tsx, SettingsDialog.tsx,
  nodes/{ImageNode,LinkCardNode,AttachmentNode}.tsx
client/src/features/rich-editor/
  rich-editor.css, schema.ts, theme.ts, storage.ts, assets.ts, transformers.ts,
  plugins/{Paste,FileDrop,FloatingMenu,AutoSave,AssetRegistry}.tsx
```

路由：`main.tsx` lazy `/tools/rich-editor`，与 `ImageEditorPage` 同级。

## Lexical 组装（概念）

```tsx
<LexicalComposer initialConfig={{
  namespace: "BlogusRichEditor",
  theme: richEditorTheme,
  nodes: [
    HeadingNode, ParagraphNode, QuoteNode, HorizontalRuleNode,
    ListNode, ListItemNode, LinkNode, AutoLinkNode,
    CodeNode, CodeHighlightNode,
    ImageNode, LinkCardNode, AttachmentNode,
  ],
  editorState: initialStateJson,
}}>
  <RichEditorToolbar />
  <RichTextPlugin ... />
  <HistoryPlugin />
  <ListPlugin /> <CheckListPlugin /> <LinkPlugin /> <AutoLinkPlugin />
  <CodeHighlightPlugin /> <TabIndentationPlugin />
  <PastePlugin /> <FileDropPlugin />
  <FloatingTextMenuPlugin /> <AssetRegistryPlugin /> <AutoSavePlugin />
</LexicalComposer>
```

## UI 布局

```
┌─────────────────────────────────────────────────────────┐
│ ← 首页    富文本编辑器 POC          [设置] [导出 JSON]   │
├─────────────────────────────────────────────────────────┤
│              ContentEditable（居中 max-w-3xl）           │
│         ┌──────────────────────────┐                    │
│         │ B I U S </>  ✕          │  ← 划词浮动菜单    │
│         └──────────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

顶栏：简易格式按钮 + 保存状态「已自动保存 · {时间}」；全屏 `h-[100dvh]`。

## SettingsDialog

**资源 Tab**：类型、名称、大小、是否仍被 `editorState` 引用、从列表移除（仅 registry）。

引用扫描：遍历 serialized nodes，匹配 `image.src` 与 `attachment.assetId`。

**文档 Tab**：导出 JSON、导入 JSON（confirm 覆盖）、清空草稿。

## Spike 闸门（P1 后、P2 前）

在投入完整编辑器实现前，用最小 Lexical 集成验证下列**最低可用标准**。须全部满足才进入 P2；**任一不满足则放弃本 change**（见 `tasks.md` §0）。

| # | 标准 | 不通过即放弃的典型信号 |
|---|------|------------------------|
| S1 | **Bundle 隔离**：生产构建产出独立 `RichEditorPage-*.js`，且不合并进博客首屏入口；gzip 后该 chunk 体量可接受（团队主观判断：明显大于 `ImageEditorPage` 数倍且无优化路径） | 无法 lazy 隔离，或 Lexical 依赖显著拖累主站加载 |
| S2 | **基础编辑可用**：空文档可稳定输入、标题/列表/引用等内置块可插入，Undo/Redo 无明显不可修复缺陷 | 核心编辑链路依赖 hack 或频繁 crash |
| S3 | **粘贴主场景**：空文档粘贴（a）普通网页段落+内联样式、（b）嵌套列表、（c）远程 `<img src>` 三类 fixture，结构可辨认、无大面积塌缩为纯文本 | 需重度 DOM 清洗仍无法覆盖三类主场景，或必须引入 Out of Scope 能力 |
| S4 | **自定义节点可行**：`ImageNode` / `LinkCardNode` / `AttachmentNode` 各完成最小序列化→渲染→反序列化闭环，无需 fork Lexical | DecoratorNode 与当前 Lexical 版本/API 根本冲突，或工作量超出 POC 合理范围 |

**明确不做的事（即使为通过闸门）：**

- 为粘贴达标而新增服务端 HTML 清洗、OG 抓取、图片 proxy。
- 为达标而修改 AdminPage / Notes 编辑栈或共享进博客正文布局。
- 将未通过闸门的半成品路由或页脚入口留给用户。

**放弃收口：**

1. 撰写 `ABANDONED.md`：失败闸门、调研现象、尝试过方案、建议后续是否换技术栈。
2. Revert 路由、页脚、依赖与相关文档改动。
3. 关闭 change；不保留「仅壳层」或「仅内置块」的对外工具页。

## Phased Delivery（本 change）

| Phase | 范围 | 可验收 |
|-------|------|--------|
| P0 | Spike 闸门评估（§0） | 通过 S1–S4 或记录放弃 |
| P1 | 依赖 + 页壳 + 路由/页脚 | 可打开空页 |
| P2 | Lexical 内置块 + 内联 + 划词菜单 + Slash | 可编辑常见块 |
| P3 | 三自定义节点 + Paste/FileDrop | 粘贴与上传路径通 |
| P4 | storage + AutoSave + Settings + 导出导入 | 刷新恢复、JSON 往返 |
| P5 | 样式打磨 + 文档 | build chunk 独立、手测通过 |

## Deferred（后续 change）

| 项 | 说明 |
|----|------|
| 服务端持久化 | PostgreSQL 文档表 + API |
| Asset delete API | 清理 orphan 上传 |
| OG 自动填充 Link card | 抓取 title/description |
| 与 Notes/Admin 打通 | 统一内容模型 |
| 协作 / 多 tab 冲突 | 乐观锁或 OT |
| 粘贴 sanitizer 深化 | Word/飞书边缘 case 持续迭代 |

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| Word/飞书 HTML 冗余 wrapper | `transformers.ts` sanitizer；未知结构降级 `ParagraphNode` |
| 未登录上传失败体验 | 明确 toast，不插入块 |
| 服务器 orphan 文件 | POC 接受；产品化再加 delete API |
| Lexical chunk 体积 | 独立 lazy route；构建验证 `RichEditorPage-*.js` |
| Link card vs inline link 混淆 | 交互分离：粘贴 `<a>` → LinkNode；卡片仅主动插入 |
| Spike 不达标仍强行推进 | P1 后强制 §0 评估；不通过即放弃，见 Spike 闸门 |
| scope creep 以「调研」名义扩边界 | 对照 Out of Scope；需后端/打通 Admin 时停止而非破界 |
