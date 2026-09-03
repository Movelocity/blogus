## 范围说明

本 tasks 对应 **最小可上线** 裁剪版 `design.md`。§7–§8（画布交互、语法高亮）移至后续 change `enhance-text-cards-canvas`，不在本 change 实施。

---

## 1. 共享类型与数据库

- [x] 1.1 在 `shared/src/types.ts` 增加 `TextCardWorkspace`、`TextCardPane`、`HlMode`、create/update/import 输入类型。
- [x] 1.2 在 `server/src/db/schema.ts` 定义 `text_card_workspaces`、`text_card_panes` 及索引（**无** `max_z_index`、**无** `panes.user_id`）。
- [x] 1.3 在 `server/src/plugins/db.ts` 的 `ensureDatabaseSchema` 中幂等建表。
- [x] 1.4 在 `server/src/schema/text-cards.ts` 编写 zod 校验（名称长度、坐标/尺寸范围、`hl_mode` 字符串、import panes 数组）。

## 2. Repository 与业务规则

- [x] 2.1 实现 `DrizzleTextCardRepository`：`findOwnedWorkspace`；`findOwnedPane` 经 `workspace_id` JOIN `user_id`。
- [x] 2.2 `listWorkspaces`：附带 `paneCount`；**只读**，不惰性创建。
- [x] 2.3 `createWorkspace`：生成递增默认名；**默认 0 pane**。
- [x] 2.4 `deleteWorkspace`：拒绝删除用户最后一个工作区；CASCADE 删除 panes。
- [x] 2.5 `deletePane`：**允许**删至工作区 0 张卡。
- [x] 2.6 `updatePane`：支持 partial patch（`title`、`content` 及布局字段；MVP 前端主要 PATCH 文本字段）。
- [x] 2.7 `importPanes`：事务内清空工作区 panes → 批量 insert normalize 结果；**允许**空数组。
- [x] 2.8 `normalizePane`：兼容 `highlightOn`、缺省字段、非法坐标回退默认值。

## 3. API 路由

- [x] 3.1 实现 `createTextCardRoutes` 并挂载 `/api/text-cards`。
- [x] 3.2 所有路由 `app.authenticate`；越权返回 404（不泄露存在性）。
- [x] 3.3 编写 `server/src/routes/text-cards.test.ts`：鉴权、CRUD、越权、至少 1 工作区约束、import 覆盖（含空数组）、**GET 无副作用**。

## 4. 前端接入壳层

- [x] 4.1 `client/src/lib/text-cards.ts`：对齐 `request<T>` 封装全部 API。
- [x] 4.2 `TextCardsPage.tsx`：mount 时 `refreshSession()`，失败 redirect `/login?redirect=/tools/text-cards`。
- [x] 4.3 `main.tsx` 注册 lazy 路由 `/tools/text-cards`（独立 chunk，不在 `BlogLayout` 内）。
- [x] 4.4 `Footer.tsx`：登录后显示「卡片笔记」；compact 与 full 两种 footer 均覆盖。
- [x] 4.5 确认 `Navigation.tsx` 无新增入口。

## 5. 列表式编辑 MVP

- [x] 5.1 `client/src/features/text-cards/constants.ts`：默认宽高、debounce 间隔等布局常量。
- [x] 5.2 `useWorkspaces` + `usePanes`：加载列表与当前工作区 panes；空工作区列表 → `POST /workspaces` bootstrap。
- [x] 5.3 `PaneList` + `PaneCard`：垂直列表，标题 input + 正文 textarea（暗色主题）；空工作区 empty state。
- [x] 5.4 `usePaneSave`：debounce 600ms PATCH `title`/`content`；保存状态指示器。
- [x] 5.5 新建/删除卡片（删除非空 confirm；**允许**删至 0 张）。
- [x] 5.6 刷新页面后数据与服务端一致。

## 6. 多工作区与备份

- [x] 6.1 `WorkspaceSwitcher`：列表、切换、新建、重命名、删除（confirm；至少保留 1 个工作区）。
- [x] 6.2 切换前 `flush` 全部 pending saves。
- [x] 6.3 `localStorage` 记住 `blogus:text-cards:active-workspace`。
- [x] 6.4 `backup.ts`：v1 解析/导出/下载；`highlightOn` 兼容（字段 round-trip，UI 不切换高亮）。
- [x] 6.5 `ImportExportMenu`：导出 JSON、载入 JSON（confirm → import API）。

## 7. 文档与验收

- [x] 7.1 更新 `README.md`、`AGENTS.md`、`DEV.md`（路由、页脚入口、开发 URL；注明 MVP 为列表式，画布交互后续补齐）。
- [x] 7.2 `pnpm typecheck`、server 单测、client build 通过。
- [ ] 7.3 手工验收：登录门禁、页脚入口、bootstrap 空工作区、多工作区 flush、新建/编辑/删除、v1 JSON 往返、刷新不丢、访客无入口。

---

## 后续 change（不在本 tasks 实施）

`enhance-text-cards-canvas` 建议包含：

- 无限画布：`usePaneDrag`、`usePaneResize`、`useZOrder`、`geometry.ts`
- TopBar 最小化、最大化 shadow、PaneIndex chips
- `highlight.ts` + `HlModeDropdown` 只读预览
- workspace `max_z_index` 冗余（若需要）
- `expectedUpdatedAt` 乐观锁
- tool-station 导出文件双向兼容的完整交互验收

---

## Parallelization Plan

| 工作流 | 可并行 | 依赖 |
|--------|--------|------|
| §1–§3 后端 | ✅ 立即 | 无 |
| §4 前端壳层 | 与 §3 并行 | API 契约冻结 |
| §5 列表 MVP | §4 完成后 | API 可用 |
| §6 多工作区/备份 | §5 完成后 | flush 语义 |
| §7 文档验收 | §6 完成后 | 功能就绪 |

**建议合入顺序**：P1(§1–3) → P2(§4–5) → P3(§6–7)。
