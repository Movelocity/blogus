# 文章归档功能方案 v2

## 一、现状

`PostStatus` 包含 `"draft" | "published" | "archived"` 三个值，但 `archived` 在业务层完全不可用：

| 层 | 现状 |
|----|------|
| 类型 / Zod 校验 | 支持 `archived` |
| Repository `listPosts` | `visibility` 仅接受 `"published"` / `"all"`，无 `archived` 分支 |
| Repository `updatePost` | 离开 `published` 状态时无条件清空 `publishedAt`（L128-133） |
| Repository `PostVisibility` | 定义在 `server/src/repositories/posts.ts` 内，未共享 |
| Admin UI | 只有"发布"/"撤回"按钮，无归档操作，无状态筛选 |
| 公开页面 | `archived` 文章被 `published` 过滤，访客不可见 |

### 需要修复的已有问题

**`publishedAt` 丢失 bug** — 当前 `updatePost` 逻辑：

```typescript
// server/src/repositories/posts.ts L128-133
const publishedAt =
  nextStatus === "published"
    ? existing.publishedAt ? new Date(existing.publishedAt) : now
    : null;  // ← draft 或 archived 时直接清空
```

执行 `published → archived → draft → published` 后，`publishedAt` 被重置为当前时间，原始发布时间永久丢失。

---

## 二、归档语义

**归档 = 从公开视野移除，仅作者在 Admin 可见，不删除**

- 对访客完全不可见（直链 404）
- 不参与任何公开统计
- Admin 中可通过状态筛选查看和管理

### 状态流转

```
draft ──发布──→ published ──撤回──→ draft
  │                 │
  │                 └──归档──→ archived
  │                               │
  └───────────────────────────────┘  取消归档（→ draft）

  任意状态 ──删除──→ 硬删除
```

关键规则：
- **归档只能从 `published` 进入**，不允许草稿直接归档（语义无意义）
- **取消归档回到 `draft`**，不直接回到 `published`（需要作者主动重新发布，避免误发布）
- `publishedAt` 在归档/取消归档过程中**保留不清空**，仅在首次发布时写入

---

## 三、改动清单

### 3.1 共享类型 — `shared/src/types.ts`

| 改动 | 说明 |
|------|------|
| 新增 `PostVisibility` | `"published" \| "archived" \| "draft" \| "all"` |

```typescript
export type PostVisibility = "published" | "archived" | "draft" | "all";
```

> `PostStatus` 不变。`PostVisibility` 是查询维度，比 `PostStatus` 多一个 `"all"`。

---

### 3.2 后端 Schema — `server/src/schema/posts.ts`

| 改动 | 说明 |
|------|------|
| `listPostsQuerySchema.visibility` 枚举扩展 | `"published"` → `"published" \| "archived" \| "draft" \| "all"` |

```typescript
// 当前
visibility: z.enum(["published", "all"]).optional().default("published")

// 改为
visibility: z.enum(["published", "archived", "draft", "all"]).optional().default("published")
```

各值含义：

| 值 | SQL | 用途 |
|----|-----|------|
| `"published"` | `status = 'published'` | 公开页面（默认） |
| `"draft"` | `status = 'draft'` | Admin 草稿筛选 |
| `"archived"` | `status = 'archived'` | Admin 归档筛选 |
| `"all"` | 无过滤 | Admin 全量列表 |

> `"all"` 保持语义不变：真正返回所有状态的文章。不做 `"status != archived"` 的隐式过滤。

---

### 3.3 后端 Repository — `server/src/repositories/posts.ts`

#### 删除本地 `PostVisibility` 定义

```typescript
// 删除此行
export type PostVisibility = "published" | "all";
```

改为从 shared 导入：

```typescript
import type { BlogPost, CreatePostInput, PostStatus, PostVisibility, UpdatePostInput } from "@blogus/shared";
```

#### `listPosts()` — 增加 `draft` / `archived` 分支

```typescript
async listPosts(options: { visibility?: PostVisibility } = {}) {
  const visibility = options.visibility ?? "published";
  const query = this.db.select().from(posts);

  const rows = (() => {
    switch (visibility) {
      case "published":
        return query.where(eq(posts.status, "published")).orderBy(desc(posts.createdAt));
      case "draft":
        return query.where(eq(posts.status, "draft")).orderBy(desc(posts.createdAt));
      case "archived":
        return query.where(eq(posts.status, "archived")).orderBy(desc(posts.createdAt));
      case "all":
      default:
        return query.orderBy(desc(posts.createdAt));
    }
  })();

  return rows.map(toBlogPost);
}
```

#### `getPostBySlug()` — 不变

公开访问只返回 `published`，Admin 通过 `visibility: "all"` 获取全量。无需改动。

#### `updatePost()` — 修复 `publishedAt` 逻辑

```typescript
// 当前逻辑（有 bug）：
const publishedAt =
  nextStatus === "published"
    ? existing.publishedAt ? new Date(existing.publishedAt) : now
    : null;

// 修改为：
const publishedAt =
  nextStatus === "published"
    ? existing.publishedAt
      ? new Date(existing.publishedAt) // 已有则保留
      : now                             // 首次发布写入
    : existing.publishedAt
      ? new Date(existing.publishedAt) // 非 published 状态保留原值
      : null;
```

行为对照：

| 状态变更 | publishedAt 变化 |
|----------|-----------------|
| `draft → published` | 写入 `now` |
| `published → draft`（撤回） | 保留原值 |
| `published → archived`（归档） | 保留原值 |
| `archived → draft`（取消归档） | 保留原值 |
| `draft → published`（重新发布） | 保留原值（不刷新） |

> 这样 `publishedAt` 始终代表"首次发布时间"，不会因归档/撤回而丢失。

---

### 3.4 前端 API 层 — `client/src/lib/api.ts`

| 改动 | 说明 |
|------|------|
| `listPosts` 的 `visibility` 类型扩展 | `"published" \| "all"` → `PostVisibility` |
| `getPostBySlug` 的 `visibility` 类型扩展 | 同上 |

```typescript
import type { BlogPost, CreatePostInput, CurrentUser, PostVisibility, UpdatePostInput } from "@blogus/shared";

export function listPosts(options: { visibility?: PostVisibility } = {}) { ... }
export function getPostBySlug(slug: string, options: { visibility?: PostVisibility } = {}) { ... }
```

---

### 3.5 前端 AdminPage — `client/src/pages/AdminPage.tsx`

#### 3.5.1 状态筛选 Tab

在侧边栏文章列表上方增加筛选：

```
[全部] [已发布] [草稿] [已归档]
```

- 全部 → `listPosts({ visibility: "all" })`
- 已发布 → `listPosts({ visibility: "published" })`
- 草稿 → `listPosts({ visibility: "draft" })`
- 已归档 → `listPosts({ visibility: "archived" })`

**全部由后端筛选**，不做前端过滤。新增 state `filter`，切换时重新请求。

```typescript
const [filter, setFilter] = useState<PostVisibility>("all");
```

切换 filter 时调用 `listPosts({ visibility: filter })` 刷新列表。

> 当前 `refreshPosts` 固定使用 `visibility: "all"`。需改为读取 `filter` state。

#### 3.5.2 操作按钮

按当前状态显示不同操作组合：

| 当前状态 | 按钮 |
|----------|------|
| `draft` | 发布、编辑、删除 |
| `published` | 撤回（→ draft）、归档（→ archived）、编辑、查看前台、删除 |
| `archived` | 取消归档（→ draft）、编辑、删除 |

新增按钮实现：

```typescript
// 归档按钮（仅 published 状态显示）
<button
  className="border border-foreground/10 bg-card px-4 py-2.5 text-sm transition hover:border-foreground/30
             disabled:cursor-not-allowed disabled:text-muted-foreground"
  disabled={selectedPost.status !== "published"}
  onClick={() => void changeStatus(selectedPost.id, "archived")}
  type="button"
>
  归档
</button>

// 取消归档按钮（仅 archived 状态显示）
<button
  className="border border-foreground/10 bg-card px-4 py-2.5 text-sm transition hover:border-foreground/30
             disabled:cursor-not-allowed disabled:text-muted-foreground"
  disabled={selectedPost.status !== "archived"}
  onClick={() => void changeStatus(selectedPost.id, "draft")}
  type="button"
>
  取消归档
</button>
```

#### 3.5.3 危险操作确认

统一确认策略：**所有不可逆或状态变更操作均弹 `window.confirm`**。

| 操作 | 确认文案 |
|------|----------|
| 归档 | `"确认将「{title}」归档？归档后访客将无法访问。"` |
| 取消归档 | `"确认取消归档「{title}」？将移回草稿状态。"` |
| 删除 | `"确认删除「{title}」？此操作不可恢复。"`（已有，保持不变） |

> 发布和撤回不做确认——发布是正向操作，撤回可随时恢复。

修改 `changeStatus` 函数增加确认逻辑：

```typescript
async function changeStatus(id: string, status: PostStatus) {
  const post = posts.find((p) => p.id === id);
  if (!post) return;

  const confirmMap: Partial<Record<PostStatus, string>> = {
    archived: `确认将「${post.title}」归档？归档后访客将无法访问。`,
    draft: post.status === "archived"
      ? `确认取消归档「${post.title}」？将移回草稿状态。`
      : "",
  };

  const message = confirmMap[status];
  if (message && !window.confirm(message)) return;

  // ...原有逻辑
}
```

#### 3.5.4 侧边栏状态标签

当前侧边栏每篇文章底部显示 `post.status` 文本。建议增加颜色区分：

```typescript
const statusLabel: Record<PostStatus, { text: string; className: string }> = {
  draft: { text: "草稿", className: "text-muted-foreground" },
  published: { text: "已发布", className: "text-green-600" },
  archived: { text: "已归档", className: "text-orange-500" },
};
```

---

## 四、改动文件总览

| 文件 | 层 | 改动 |
|------|----|------|
| `shared/src/types.ts` | 共享 | 新增 `PostVisibility` 类型 |
| `server/src/schema/posts.ts` | 后端 | `visibility` 枚举增加 `"draft"` / `"archived"` |
| `server/src/repositories/posts.ts` | 后端 | 删除本地 `PostVisibility`；`listPosts` 增加分支；`updatePost` 修复 `publishedAt` |
| `client/src/lib/api.ts` | 前端 | `listPosts` / `getPostBySlug` 的 visibility 类型改用 `PostVisibility` |
| `client/src/pages/AdminPage.tsx` | 前端 | 状态筛选 Tab；归档/取消归档按钮；确认弹窗；状态标签样式 |

**不改动**：HomePage、ArchivePage、PostPage、LandingPage、路由结构、数据库 schema（无 migration）。

---

## 五、排除项

- 不改变任何公开页面的行为
- 归档文章对访客不可见（直链 404，非"带提示可访问"）
- 不做软删除，硬删除独立于归档
- 不新增 `archived_at` 等字段（`publishedAt` 保留 + `updatedAt` 已足够）
- 不做归档文章的公开统计展示
