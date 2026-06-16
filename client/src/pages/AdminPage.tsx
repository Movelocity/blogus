import { Link } from "react-router";
import { type SubmitEvent, useEffect, useMemo, useRef, useState } from "react";
import type { BlogPost, CurrentUser, PostStatus, PostVisibility } from "@blogus/shared";
import { createPost, deletePost, listPosts, logout, updatePost, uploadFile, whoami } from "../lib/api";
import { MarkdownView } from "../lib/markdown";
import {
  PlusIcon,
  SignOutIcon,
  UploadIcon,
  ImageIcon,
  EyeIcon,
  PencilSimpleIcon,
  // TrashIcon,
  // ArchiveIcon,
  // ArrowSquareOutIcon,
  // FloppyDiskIcon,
} from "@phosphor-icons/react";

type EditorMode = "edit" | "preview";

function postExcerpt(post: BlogPost) {
  return post.excerpt ?? (post.content.slice(0, 60) || "");
}

function splitTags(input: string) {
  return input.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12);
}

function statusLabel(s: PostStatus) {
  return s === "published" ? "已发布" : s === "archived" ? "已归档" : "草稿";
}

export function AdminPage() {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("edit");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<PostVisibility>("all");
  const selectedPost = useMemo(() => posts.find((p) => p.id === selectedId) ?? null, [posts, selectedId]);
  const tags = splitTags(tagsText);

  function loadPost(post: BlogPost) {
    setSelectedId(post.id);
    setTitle(post.title);
    setContent(post.content);
    setExcerpt(post.excerpt ?? "");
    setCoverImageUrl(post.coverImageUrl ?? "");
    setTagsText(post.tags.join(", "));
    setEditorMode("edit");
    setMessage(null);
    setError(null);
  }

  function startNewPost() {
    setSelectedId(null);
    setTitle("");
    setContent("");
    setExcerpt("");
    setCoverImageUrl("");
    setTagsText("");
    setEditorMode("edit");
    setMessage(null);
    setError(null);
  }

  async function refreshPosts(nextSelectedId = selectedId) {
    const result = await listPosts({ visibility: filter });
    setPosts(result.posts);
    if (nextSelectedId) {
      const next = result.posts.find((p) => p.id === nextSelectedId);
      if (next) loadPost(next);
    }
  }

  useEffect(() => {
    Promise.all([whoami(), listPosts({ visibility: "all" })])
      .then(([cu, result]) => {
        setUser(cu.user);
        setPosts(result.posts);
        if (result.posts[0]) loadPost(result.posts[0]);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (authChecked && user) {
      listPosts({ visibility: filter })
        .then((r) => {
          setPosts(r.posts);
          if (r.posts[0]) loadPost(r.posts[0]);
          else startNewPost();
        })
        .catch(() => {});
    }
  }, [filter, authChecked, user]);

  async function handleLogout() {
    setError(null);
    try {
      await logout();
      setUser(null);
      setPosts([]);
      startNewPost();
      setMessage("已退出登录");
    } catch (e) {
      setError(e instanceof Error ? e.message : "退出失败");
    }
  }

  if (authChecked && !user) {
    return (
      <div className="mx-auto grid max-w-sm gap-6 pt-8">
        <header className="grid gap-2 text-center">
          <h1 className="m-0 font-display text-3xl tracking-tight text-foreground">文章管理</h1>
          <p className="m-0 text-sm text-muted-foreground">需要登录后才能访问。</p>
        </header>
        <div className="grid gap-4 rounded-lg border border-border bg-card p-6">
          {message ? <p className="m-0 text-sm text-muted-foreground">{message}</p> : null}
          {error ? <p className="m-0 font-mono text-sm text-destructive">{error}</p> : null}
          <Link
            className="inline-flex items-center justify-center rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-foreground/90"
            to="/login"
          >
            去登录
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (selectedPost) {
        const r = await updatePost(selectedPost.id, { title, content, excerpt, coverImageUrl, tags });
        setMessage(`已保存：${r.post.title}`);
        await refreshPosts(r.post.id);
      } else {
        const r = await createPost({ title, content, excerpt, coverImageUrl, tags, status: "draft" });
        setMessage(`草稿已创建：${r.post.title}`);
        await refreshPosts(r.post.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id: string, status: PostStatus) {
    const post = posts.find((p) => p.id === id);
    if (!post) return;
    const cm: Partial<Record<PostStatus, string>> = {
      archived: `确认将「${post.title}」归档？`,
      draft: post.status === "archived" ? `确认取消归档「${post.title}」？` : "",
    };
    if (cm[status] && !window.confirm(cm[status])) return;
    setError(null);
    try {
      const r = await updatePost(id, { status });
      const lm: Record<string, string> = {
        published: `已发布：${r.post.title}`,
        draft: post.status === "archived" ? `已取消归档：${r.post.title}` : `已撤回：${r.post.title}`,
        archived: `已归档：${r.post.title}`,
      };
      setMessage(lm[status] ?? `状态已更新：${r.post.title}`);
      await refreshPosts(r.post.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "状态更新失败");
    }
  }

  async function remove(id: string) {
    const post = posts.find((p) => p.id === id);
    setError(null);
    if (!window.confirm(`确认删除「${post?.title ?? "这篇文章"}」？`)) return;
    try {
      await deletePost(id);
      setMessage("文章已删除");
      startNewPost();
      await refreshPosts(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  }

  async function handleInlineUpload(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const r = await uploadFile(file);
      const md = `![${file.name}](${r.file.url})`;
      const ta = textareaRef.current;
      if (ta) {
        const s = ta.selectionStart;
        const e = ta.selectionEnd;
        setContent(`${content.slice(0, s)}\n${md}\n${content.slice(e)}`);
        requestAnimationFrame(() => ta.focus());
      } else {
        setContent(`${content}\n${md}\n`);
      }
      setMessage("图片已上传并插入正文");
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    }
  }

  async function handleCoverUpload(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const r = await uploadFile(file);
      setCoverImageUrl(r.file.url);
      setMessage("封面图已上传");
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    }
  }

  const filterTabs: [PostVisibility, string][] = [
    ["all", "全部"],
    ["published", "已发布"],
    ["draft", "草稿"],
    ["archived", "已归档"],
  ];

  return (
    <div className="grid grid-cols-[280px_minmax(0,1fr)] max-lg:grid-cols-1">
      {/* ── Sidebar ── */}
      <aside className="sticky top-24 flex max-h-[calc(100dvh-7rem)] flex-col self-start max-lg:static max-lg:max-h-none max-lg:border-b max-lg:pb-4">
        {/* Header row */}
        <div className="flex items-center justify-between px-1 pb-4">
          <h1 className="font-display text-base font-semibold tracking-tight text-foreground">文章</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={startNewPost}
              type="button"
              className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <PlusIcon size={15} />
              新建
            </button>
            <span className="text-border">|</span>
            <button
              onClick={handleLogout}
              type="button"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <SignOutIcon size={15} />
            </button>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex gap-3 border-b border-border pb-3 mb-3">
          {filterTabs.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              type="button"
              className={`text-sm transition-colors ${
                filter === value ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Post list */}
        <div className="flex-1 overflow-y-auto">
          {posts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无文章</p>
          ) : (
            <div className="flex flex-col">
              {posts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => loadPost(post)}
                  type="button"
                  className={`flex flex-col gap-0.5 border-l-2 py-2.5 pl-3 text-left transition-colors ${
                    post.id === selectedId
                      ? "border-foreground"
                      : "border-transparent hover:border-border"
                  }`}
                >
                  <span className="line-clamp-1 text-[15px] text-foreground">{post.title || "未命名文章"}</span>
                  <span className="font-mono text-xs text-muted-foreground/60 line-clamp-1">
                    {statusLabel(post.status)}
                    {postExcerpt(post) ? ` · ${postExcerpt(post)}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User */}
        {user ? (
          <p className="mt-3 truncate border-t border-border pt-3 text-xs text-muted-foreground/50">{user.email}</p>
        ) : null}
      </aside>

      {/* ── Editor ── */}
      <div className="flex flex-col lg:pl-8">
        {/* Messages */}
        {message ? (
          <div className="mb-4 rounded bg-emerald-50/60 px-3 py-2 font-mono text-sm text-emerald-700">{message}</div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded bg-destructive/5 px-3 py-2 font-mono text-sm text-destructive">{error}</div>
        ) : null}

        <form className="flex flex-col" onSubmit={handleSubmit}>
          {/* Top bar: mode toggle + slug - sticks to top of viewport (just below fixed nav) */}
          <div className="sticky top-0 z-20 flex items-center justify-between bg-background py-4">
            <div className="flex items-center gap-3">
              <span className="font-display text-base font-medium text-foreground">
                {selectedPost ? "编辑" : "新建"}
              </span>
              {selectedPost ? (
                <span className="font-mono text-xs text-muted-foreground/50">
                  {selectedPost.slug}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-1 text-sm">
              <button
                type="button"
                onClick={() => setEditorMode("edit")}
                className={`px-2 py-1 transition-colors ${editorMode === "edit" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <PencilSimpleIcon size={14} className="inline mr-1" />
                编辑
              </button>
              <button
                type="button"
                onClick={() => setEditorMode("preview")}
                className={`px-2 py-1 transition-colors ${editorMode === "preview" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <EyeIcon size={14} className="inline mr-1" />
                预览
              </button>
            </div>
          </div>

          {/* Editor content - flows naturally with the page scroll */}
          <div>
            {editorMode === "edit" ? (
              <div className="flex flex-col gap-5">
                {/* Title - bottom border only */}
                <input
                  className="w-full border-b border-border bg-transparent pb-3 font-display text-2xl font-semibold tracking-tight text-foreground outline-none transition-colors focus:border-foreground/40 placeholder:text-muted-foreground/30"
                  maxLength={240}
                  placeholder="标题"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />

                {/* Excerpt + Tags side by side */}
                <div className="grid grid-cols-[1fr_200px] gap-5 max-md:grid-cols-1">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground/50">摘要</span>
                    <textarea
                      className="min-h-[56px] resize-y border-b border-border bg-transparent pb-2 text-base text-foreground outline-none transition-colors focus:border-foreground/40"
                      maxLength={1000}
                      value={excerpt}
                      onChange={(e) => setExcerpt(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground/50">标签</span>
                    <input
                      className="border-b border-border bg-transparent pb-2 text-base text-foreground outline-none transition-colors focus:border-foreground/40"
                      placeholder="逗号分隔"
                      value={tagsText}
                      onChange={(e) => setTagsText(e.target.value)}
                    />
                    {tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {tags.map((t) => (
                          <span key={t} className="text-xs text-muted-foreground/50">#{t}</span>
                        ))}
                      </div>
                    ) : null}
                  </label>
                </div>

                {/* Cover + inline upload - minimal row */}
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <label className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
                    <UploadIcon size={14} />
                    封面
                    <input accept="image/*" className="hidden" type="file" onChange={(e) => void handleCoverUpload(e.target.files?.[0])} />
                  </label>
                  <label className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
                    <ImageIcon size={14} />
                    插图
                    <input accept="image/*" className="hidden" type="file" onChange={(e) => void handleInlineUpload(e.target.files?.[0])} />
                  </label>
                  <input
                    className="ml-auto min-w-0 flex-1 border-b border-transparent bg-transparent text-right text-xs text-muted-foreground/40 outline-none transition-colors focus:border-border focus:text-muted-foreground"
                    placeholder="封面 URL"
                    value={coverImageUrl}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                  />
                </div>

                {/* Markdown body */}
                <textarea
                  className="min-h-[70vh] resize-y border-b border-border bg-transparent pb-2 font-mono text-base leading-relaxed text-foreground outline-none transition-colors focus:border-foreground/40"
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="正文 (Markdown)"
                />
              </div>
            ) : (
              <article className="mx-auto max-w-3xl">
                {coverImageUrl ? (
                  <img alt="" className="mb-6 max-h-72 w-full rounded-md object-cover" src={coverImageUrl} />
                ) : null}
                <h1 className="mb-3 break-words font-display text-4xl font-semibold leading-tight tracking-tight text-foreground">
                  {title || "未命名文章"}
                </h1>
                {tags.length > 0 ? (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {tags.map((t) => (
                      <span key={t} className="text-sm text-muted-foreground/50">#{t}</span>
                    ))}
                  </div>
                ) : null}
                {excerpt ? <p className="mb-6 text-base leading-relaxed text-muted-foreground">{excerpt}</p> : null}
                <MarkdownView content={content} />
              </article>
            )}
          </div>

          {/* Action row - fixed to viewport bottom, full width within layout */}
          <div className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 border-t border-border bg-background/95 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/75 lg:px-12">
            <button
              className="rounded-md bg-foreground px-5 py-2 text-base font-medium text-primary-foreground transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              disabled={saving}
              type="submit"
            >
              {saving ? "保存中..." : selectedPost ? "保存" : "创建草稿"}
            </button>
            {selectedPost ? (
              <>
                <button
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                  disabled={selectedPost.status === "published"}
                  onClick={() => void changeStatus(selectedPost.id, "published")}
                  type="button"
                >
                  发布
                </button>
                <button
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                  disabled={selectedPost.status !== "published"}
                  onClick={() => void changeStatus(selectedPost.id, "draft")}
                  type="button"
                >
                  撤回
                </button>
                <button
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                  disabled={selectedPost.status !== "published"}
                  onClick={() => void changeStatus(selectedPost.id, "archived")}
                  type="button"
                >
                  归档
                </button>
                <button
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                  disabled={selectedPost.status !== "archived"}
                  onClick={() => void changeStatus(selectedPost.id, "draft")}
                  type="button"
                >
                  取消归档
                </button>
                <span className="text-border">|</span>
                <button
                  className="text-sm text-destructive/70 transition-colors hover:text-destructive"
                  onClick={() => void remove(selectedPost.id)}
                  type="button"
                >
                  删除
                </button>
                {selectedPost.status === "published" ? (
                  <Link
                    className="ml-auto text-sm text-muted-foreground transition-colors hover:text-foreground"
                    to={`/posts/${selectedPost.slug}`}
                  >
                    查看前台
                  </Link>
                ) : null}
              </>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
