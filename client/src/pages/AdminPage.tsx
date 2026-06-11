import { Link } from "react-router";
import { FormEvent, useEffect, useState } from "react";
import type { BlogPost, CurrentUser } from "@blogus/shared";
import { createPost, deletePost, listPosts, logout, updatePost, whoami } from "../lib/api";

export function AdminPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  async function refreshPosts() {
    const result = await listPosts({ visibility: "all" });
    setPosts(result.posts);
  }

  useEffect(() => {
    Promise.all([whoami(), refreshPosts()])
      .then(([result]) => setUser(result.user))
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

    try {
      const result = await createPost({ title, content, status: "draft" });
      setMessage(`草稿已创建：${result.post.title}`);
      setTitle("");
      setContent("");
      await refreshPosts();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建失败");
    }
  }

  async function publish(id: string) {
    setError(null);
    try {
      const result = await updatePost(id, { status: "published" });
      setMessage(`已发布：${result.post.title}`);
      await refreshPosts();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "发布失败");
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await deletePost(id);
      setMessage("文章已删除");
      await refreshPosts();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除失败");
    }
  }

  return (
    <>
      <section className="mb-6">
        <h1 className="mb-2 text-4xl font-bold leading-tight text-slate-900">文章管理</h1>
        <p className="m-0 text-slate-600">
          {user ? `${user.email} 已登录，可以创建草稿并通过 API 或 CLI 继续编辑发布。` : "正在检查登录状态..."}
        </p>
      </section>

      <form className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6" onSubmit={handleSubmit}>
        <div className="flex justify-end">
          <button
            className="rounded-md border border-slate-300 bg-white px-3 py-2 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
            onClick={handleLogout}
            type="button"
          >
            退出登录
          </button>
        </div>
        <label className="grid gap-2 font-semibold">
          标题
          <input
            className="rounded-md border border-slate-300 px-3 py-2 font-normal outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="grid gap-2 font-semibold">
          正文
          <textarea
            className="min-h-44 resize-y rounded-md border border-slate-300 px-3 py-2 font-normal outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </label>
        <button className="justify-self-start rounded-md bg-teal-700 px-4 py-2 font-bold text-white transition hover:bg-teal-800" type="submit">
          创建草稿
        </button>
        {message ? <p>{message}</p> : null}
        {error ? <p className="text-red-700">{error}</p> : null}
      </form>

      <section className="mt-8">
        <h2 className="mb-4 text-2xl font-semibold text-slate-900">全部文章</h2>
        <div className="grid gap-4">
          {posts.map((post) => (
            <article className="flex items-start justify-between gap-5 rounded-lg border border-slate-200 bg-white p-5 max-sm:grid" key={post.id}>
              <div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900">{post.title}</h3>
                <p className="mb-3 text-slate-700">{post.excerpt ?? (post.content.slice(0, 120) || "暂无正文")}</p>
                <div className="text-sm text-slate-500">
                  {post.status} · {post.slug}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
                  disabled={post.status === "published"}
                  onClick={() => publish(post.id)}
                  type="button"
                >
                  发布
                </button>
                <button
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
                  onClick={() => remove(post.id)}
                  type="button"
                >
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
