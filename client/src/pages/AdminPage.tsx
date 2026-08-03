import { Link } from "react-router";
import { type SubmitEvent, useEffect, useMemo, useRef, useState } from "react";
import type { BlogPost, CurrentUser, PostStatus, PostVisibility } from "@blogus/shared";
import { createPost, deletePost, listPosts, logout, refreshSession, updatePost, uploadFile, whoami } from "../lib/api";
import { MarkdownView } from "../lib/markdown";
import {
  HouseSimpleIcon,
  ListIcon,
  PlusIcon,
  SignOutIcon,
  SpinnerIcon,
  UploadIcon,
  ImageIcon,
  EyeIcon,
  PencilSimpleIcon,
  GearSixIcon,
  CaretUpIcon,
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

function statusDotClass(s: PostStatus) {
  return s === "published" ? "bg-emerald-500" : s === "archived" ? "bg-muted-foreground/30" : "bg-amber-500";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const selectedPost = useMemo(() => posts.find((p) => p.id === selectedId) ?? null, [posts, selectedId]);
  const tags = splitTags(tagsText);

  const statusCounts = useMemo(() => {
    const c: Record<PostVisibility, number> = { all: posts.length, published: 0, draft: 0, archived: 0 };
    for (const p of posts) c[p.status] += 1;
    return c;
  }, [posts]);

  const filteredPosts = useMemo(
    () => (filter === "all" ? posts : posts.filter((p) => p.status === filter)),
    [posts, filter],
  );

  // 用户菜单打开时，点击菜单外部关闭。
  // 注意：真实鼠标事件在监听器之间会跑微任务，React 可能在同一次点击的
  // 冒泡途中就挂上了 document 监听，所以必须判断点击目标是否在菜单内部，
  // 不能用“任意点击都关闭”的写法（否则打开菜单的那次点击会立即把它关掉）。
  useEffect(() => {
    if (!userMenuOpen) return;
    const onDocumentClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [userMenuOpen]);

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
    const result = await listPosts({ visibility: "all" });
    setPosts(result.posts);
    if (nextSelectedId) {
      const next = result.posts.find((p) => p.id === nextSelectedId);
      if (next) loadPost(next);
    }
  }

  useEffect(() => {
    (async () => {
      const refreshed = await refreshSession();
      if (!refreshed) {
        setAuthChecked(true);
        return;
      }
      Promise.all([whoami(), listPosts({ visibility: "all" })])
        .then(([cu, result]) => {
          setUser(cu.user);
          setPosts(result.posts);
          if (result.posts[0]) loadPost(result.posts[0]);
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : "加载失败"))
        .finally(() => setAuthChecked(true));
    })();
  }, []);

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
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
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
    <div className="flex min-h-dvh">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(true)}
        type="button"
        className="fixed left-4 top-2 z-30 rounded-md border border-border bg-background p-2 shadow-sm lg:hidden"
        aria-label="打开文章列表"
      >
        <ListIcon size={18} />
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-30 flex h-dvh w-[280px] flex-col border-r border-border bg-background px-4 py-4 transition-transform duration-300 ease-out max-lg:-translate-x-full ${sidebarOpen ? "max-lg:translate-x-0" : ""}`}
      >
        {/* Header row */}
        <div className="flex items-center justify-between pb-3">
          <Link
            to="/"
            className="-ml-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="回到首页"
          >
            <HouseSimpleIcon size={15} />
            首页
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-base font-semibold tracking-tight text-foreground">文章</h1>
            <span className="font-mono text-xs text-muted-foreground/50">{posts.length}</span>
          </div>
        </div>

        {/* New post */}
        <button
          onClick={() => { startNewPost(); setSidebarOpen(false); }}
          type="button"
          className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <PlusIcon size={14} />
          新建文章
        </button>

        {/* Filter row */}
        <div className="flex gap-3 border-b border-border pb-2.5 mb-1">
          {filterTabs.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              type="button"
              className={`flex items-baseline gap-1 text-sm transition-colors ${
                filter === value ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              <span className="font-mono text-[10px] text-muted-foreground/50">{statusCounts[value]}</span>
            </button>
          ))}
        </div>

        {/* Post list */}
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {filteredPosts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {posts.length === 0 ? "暂无文章" : "没有匹配的文章"}
            </p>
          ) : (
            <div className="flex flex-col">
              {filteredPosts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => { loadPost(post); setSidebarOpen(false); }}
                  type="button"
                  className={`flex flex-col gap-0.5 rounded-sm border-l-2 px-2.5 py-2 text-left transition-colors ${
                    post.id === selectedId
                      ? "border-foreground bg-muted"
                      : "border-transparent hover:bg-muted/60"
                  }`}
                >
                  <span className="line-clamp-1 text-sm text-foreground">{post.title || "未命名文章"}</span>
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground/60">
                    <span className={`size-1.5 shrink-0 rounded-full ${statusDotClass(post.status)}`} />
                    <span className="shrink-0">{statusLabel(post.status)}</span>
                    <span className="shrink-0 text-muted-foreground/40">{formatDate(post.updatedAt)}</span>
                    {postExcerpt(post) ? (
                      <span className="min-w-0 flex-1 line-clamp-1 text-muted-foreground/40">{postExcerpt(post)}</span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User settings */}
        {user ? (
          <div ref={userMenuRef} className="relative mt-2 border-t border-border pt-2">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-label="用户设置"
              aria-expanded={userMenuOpen}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                userMenuOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <GearSixIcon size={15} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate text-xs">{user.email}</span>
              <CaretUpIcon
                size={12}
                className={`shrink-0 transition-transform ${userMenuOpen ? "" : "rotate-180"}`}
              />
            </button>
            {userMenuOpen ? (
              <div className="absolute bottom-full left-0 z-50 mb-1 w-full rounded-md border border-border bg-background py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => { setUserMenuOpen(false); void handleLogout(); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <SignOutIcon size={14} />
                  退出登录
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </aside>

      {/* Mobile backdrop */}
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      {/* Editor area */}
      <div className="flex flex-1 flex-col lg:ml-[280px]">
        <form className="flex flex-col" onSubmit={handleSubmit}>
          {/* Toolbar - sticks below fixed nav */}
          <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border bg-background px-6 py-2.5 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5 ml-12 lg:ml-0">
              <span className="shrink-0 font-display text-base font-medium text-foreground">
                {selectedPost ? "编辑" : "新建"}
              </span>
              {selectedPost ? (
                <>
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    <span className={`size-1.5 rounded-full ${statusDotClass(selectedPost.status)}`} />
                    {statusLabel(selectedPost.status)}
                  </span>
                  <span className="truncate font-mono text-xs text-muted-foreground/50">
                    {selectedPost.slug}
                  </span>
                </>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {message ? (
                <span className="max-w-[220px] truncate text-xs text-emerald-600" title={message}>{message}</span>
              ) : null}
              {selectedPost ? (
                <>
                  {selectedPost.status !== "published" ? (
                    <button
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => void changeStatus(selectedPost.id, "published")}
                      type="button"
                    >
                      发布
                    </button>
                  ) : null}
                  {selectedPost.status === "published" ? (
                    <>
                      <button
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => void changeStatus(selectedPost.id, "draft")}
                        type="button"
                      >
                        撤回
                      </button>
                      <button
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => void changeStatus(selectedPost.id, "archived")}
                        type="button"
                      >
                        归档
                      </button>
                    </>
                  ) : null}
                  {selectedPost.status === "archived" ? (
                    <button
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => void changeStatus(selectedPost.id, "draft")}
                      type="button"
                    >
                      取消归档
                    </button>
                  ) : null}
                  <button
                    className="text-destructive/70 transition-colors hover:text-destructive"
                    onClick={() => void remove(selectedPost.id)}
                    type="button"
                  >
                    删除
                  </button>
                  {selectedPost.status === "published" ? (
                    <Link
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      to={`/posts/${selectedPost.slug}`}
                    >
                      查看前台
                    </Link>
                  ) : null}
                </>
              ) : null}
              <button
                type="button"
                onClick={() => setEditorMode(editorMode === "edit" ? "preview" : "edit")}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {editorMode === "edit" ? (
                  <><EyeIcon size={14} className="inline mr-1" />预览</>
                ) : (
                  <><PencilSimpleIcon size={14} className="inline mr-1" />编辑</>
                )}
              </button>
              <button
                className="inline-flex h-8 min-w-[72px] items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
                type="submit"
              >
                {saving ? <SpinnerIcon size={14} className="animate-spin" /> : selectedPost ? "保存" : "创建草稿"}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="w-full px-6 pt-5 pb-12 lg:px-8">
            {error ? (
              <div className="mb-4 rounded bg-destructive/5 px-3 py-2 font-mono text-sm text-destructive">{error}</div>
            ) : null}

            {editorMode === "edit" ? (
              <div className="flex flex-col gap-4">
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
                  className="w-full resize-none overflow-hidden border-b border-border bg-transparent pb-2 font-mono text-base leading-relaxed text-foreground outline-none transition-colors focus:border-foreground/40"
                  ref={textareaRef}
                  rows={1}
                  style={{ fieldSizing: "content" } as React.CSSProperties}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="正文 (Markdown)"
                />
              </div>
            ) : (
              <article className="pb-12">
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
        </form>
      </div>
    </div>
  );
}
