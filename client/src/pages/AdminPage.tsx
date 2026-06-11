import { Link } from "react-router";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { BlogPost, CurrentUser, PostStatus } from "@blogus/shared";
import { createPost, deletePost, listPosts, logout, updatePost, uploadFile, whoami } from "../lib/api";
import { MarkdownView } from "../lib/markdown";

type EditorMode = "edit" | "preview";

function postExcerpt(post: BlogPost) {
  return post.excerpt ?? (post.content.slice(0, 120) || "暂无正文");
}

function splitTags(input: string) {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
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
  const selectedPost = useMemo(() => posts.find((post) => post.id === selectedId) ?? null, [posts, selectedId]);
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
    const result = await listPosts({ visibility: "all" });
    setPosts(result.posts);
    if (nextSelectedId) {
      const nextPost = result.posts.find((post) => post.id === nextSelectedId);
      if (nextPost) {
        loadPost(nextPost);
      }
    }
  }

  useEffect(() => {
    Promise.all([whoami(), listPosts({ visibility: "all" })])
      .then(([currentUser, result]) => {
        setUser(currentUser.user);
        setPosts(result.posts);
        if (result.posts[0]) {
          loadPost(result.posts[0]);
        }
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "加载失败");
      })
      .finally(() => setAuthChecked(true));
  }, []);

  async function handleLogout() {
    setError(null);
    try {
      await logout();
      setUser(null);
      setPosts([]);
      startNewPost();
      setMessage("已退出登录");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "退出失败");
    }
  }

  if (authChecked && !user) {
    return (
      <>
        <section className="mb-6">
          <h1 className="mb-2 text-4xl font-bold leading-tight text-slate-900">文章管理</h1>
          <p className="m-0 text-slate-600">需要登录后才能访问管理操作。</p>
        </section>
        <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6">
          {message ? <p>{message}</p> : null}
          {error ? <p className="text-red-700">{error}</p> : null}
          <Link className="justify-self-start rounded-md bg-teal-700 px-4 py-2 font-bold text-white transition hover:bg-teal-800" to="/login">
            去登录
          </Link>
        </div>
      </>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (selectedPost) {
        const result = await updatePost(selectedPost.id, {
          title,
          content,
          excerpt,
          coverImageUrl,
          tags
        });
        setMessage(`已保存：${result.post.title}`);
        await refreshPosts(result.post.id);
      } else {
        const result = await createPost({
          title,
          content,
          excerpt,
          coverImageUrl,
          tags,
          status: "draft"
        });
        setMessage(`草稿已创建：${result.post.title}`);
        await refreshPosts(result.post.id);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id: string, status: PostStatus) {
    setError(null);
    try {
      const result = await updatePost(id, { status });
      setMessage(status === "published" ? `已发布：${result.post.title}` : `已撤回：${result.post.title}`);
      await refreshPosts(result.post.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "状态更新失败");
    }
  }

  async function remove(id: string) {
    setError(null);
    if (!window.confirm("确认删除这篇文章？")) {
      return;
    }

    try {
      await deletePost(id);
      setMessage("文章已删除");
      startNewPost();
      await refreshPosts(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除失败");
    }
  }

  async function handleInlineUpload(file: File | undefined) {
    if (!file) {
      return;
    }

    setError(null);
    try {
      const result = await uploadFile(file);
      const markdown = `![${file.name}](${result.file.url})`;
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        setContent(`${content.slice(0, start)}\n${markdown}\n${content.slice(end)}`);
        requestAnimationFrame(() => textarea.focus());
      } else {
        setContent(`${content}\n${markdown}\n`);
      }
      setMessage("图片已上传并插入正文");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "上传失败");
    }
  }

  async function handleCoverUpload(file: File | undefined) {
    if (!file) {
      return;
    }

    setError(null);
    try {
      const result = await uploadFile(file);
      setCoverImageUrl(result.file.url);
      setMessage("封面图已上传");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "上传失败");
    }
  }

  return (
    <>
      <section className="mb-6 flex items-start justify-between gap-4 max-sm:grid">
        <div>
          <h1 className="mb-2 text-4xl font-bold leading-tight text-slate-900">文章管理</h1>
          <p className="m-0 text-slate-600">
            {user ? `${user.email} 已登录，可以完成写作、插图、预览和发布。` : "正在检查登录状态..."}
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 bg-white px-3 py-2 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
          onClick={handleLogout}
          type="button"
        >
          退出登录
        </button>
      </section>

      {message ? <p className="rounded-md border border-teal-100 bg-teal-50 px-4 py-3 text-teal-900">{message}</p> : null}
      {error ? <p className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-red-700">{error}</p> : null}

      <div className="mt-5 grid grid-cols-[280px_minmax(0,1fr)] gap-5 max-lg:grid-cols-1">
        <aside className="grid content-start gap-3">
          <button
            className="rounded-md bg-teal-700 px-4 py-2 font-bold text-white transition hover:bg-teal-800"
            onClick={startNewPost}
            type="button"
          >
            新建草稿
          </button>
          <div className="grid gap-3">
            {posts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-slate-600">暂无文章。</p>
            ) : null}
            {posts.map((post) => (
              <button
                className={`grid gap-1 rounded-lg border bg-white p-4 text-left transition hover:border-teal-300 ${
                  post.id === selectedId ? "border-teal-500 ring-2 ring-teal-100" : "border-slate-200"
                }`}
                key={post.id}
                onClick={() => loadPost(post)}
                type="button"
              >
                <span className="break-words font-semibold text-slate-900">{post.title}</span>
                <span className="line-clamp-2 text-sm text-slate-600">{postExcerpt(post)}</span>
                <span className="text-xs text-slate-500">
                  {post.status} · {post.slug}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <form className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between gap-3 max-sm:grid">
            <div>
              <h2 className="m-0 text-xl font-semibold text-slate-900">{selectedPost ? "编辑文章" : "新建文章"}</h2>
              {selectedPost ? (
                <p className="m-0 break-all text-sm text-slate-500">
                  {selectedPost.status} · {selectedPost.slug}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className={`rounded-md px-3 py-2 transition ${
                  editorMode === "edit" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"
                }`}
                onClick={() => setEditorMode("edit")}
                type="button"
              >
                编辑
              </button>
              <button
                className={`rounded-md px-3 py-2 transition ${
                  editorMode === "preview" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"
                }`}
                onClick={() => setEditorMode("preview")}
                type="button"
              >
                预览
              </button>
            </div>
          </div>

          <label className="grid gap-2 font-semibold">
            标题
            <input
              className="rounded-md border border-slate-300 px-3 py-2 font-normal outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
              maxLength={240}
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            <label className="grid gap-2 font-semibold">
              摘要
              <textarea
                className="min-h-24 resize-y rounded-md border border-slate-300 px-3 py-2 font-normal outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                maxLength={1000}
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
              />
            </label>
            <label className="grid gap-2 font-semibold">
              标签
              <input
                className="rounded-md border border-slate-300 px-3 py-2 font-normal outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                placeholder="逗号分隔，最多 12 个"
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
            <label className="grid gap-2 font-semibold">
              封面图 URL
              <input
                className="rounded-md border border-slate-300 px-3 py-2 font-normal outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                value={coverImageUrl}
                onChange={(event) => setCoverImageUrl(event.target.value)}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 transition hover:border-slate-400">
                上传封面
                <input
                  accept="image/*"
                  className="hidden"
                  type="file"
                  onChange={(event) => void handleCoverUpload(event.target.files?.[0])}
                />
              </label>
              <label className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 transition hover:border-slate-400">
                上传并插入正文
                <input
                  accept="image/*"
                  className="hidden"
                  type="file"
                  onChange={(event) => void handleInlineUpload(event.target.files?.[0])}
                />
              </label>
              {coverImageUrl ? <span className="break-all text-sm text-slate-500">{coverImageUrl}</span> : null}
            </div>
          </div>

          {editorMode === "edit" ? (
            <label className="grid gap-2 font-semibold">
              Markdown 正文
              <textarea
                className="min-h-[420px] resize-y rounded-md border border-slate-300 px-3 py-2 font-mono text-sm font-normal outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                ref={textareaRef}
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
            </label>
          ) : (
            <section className="min-h-[420px] rounded-md border border-slate-200 bg-white p-5">
              {coverImageUrl ? (
                <img alt="" className="mb-5 max-h-80 w-full rounded-md object-cover" src={coverImageUrl} />
              ) : null}
              <h1 className="mb-3 break-words text-3xl font-bold leading-tight text-slate-950">{title || "未命名文章"}</h1>
              {tags.length > 0 ? (
                <div className="mb-4 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-sm text-slate-700" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              {excerpt ? <p className="mb-5 text-lg leading-8 text-slate-600">{excerpt}</p> : null}
              <MarkdownView content={content} />
            </section>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-md bg-teal-700 px-4 py-2 font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={saving}
              type="submit"
            >
              {saving ? "保存中..." : selectedPost ? "保存文章" : "创建草稿"}
            </button>
            {selectedPost ? (
              <>
                <button
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
                  disabled={selectedPost.status === "published"}
                  onClick={() => void changeStatus(selectedPost.id, "published")}
                  type="button"
                >
                  发布
                </button>
                <button
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
                  disabled={selectedPost.status !== "published"}
                  onClick={() => void changeStatus(selectedPost.id, "draft")}
                  type="button"
                >
                  撤回
                </button>
                <button
                  className="rounded-md border border-red-200 bg-white px-3 py-2 text-red-700 transition hover:border-red-300 disabled:cursor-not-allowed disabled:text-slate-400"
                  onClick={() => void remove(selectedPost.id)}
                  type="button"
                >
                  删除
                </button>
                {selectedPost.status === "published" ? (
                  <Link
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 transition hover:border-slate-400"
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
    </>
  );
}
