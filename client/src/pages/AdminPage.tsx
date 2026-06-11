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
        <section className="page-heading">
          <h1>文章管理</h1>
          <p>需要登录后才能访问管理操作。</p>
        </section>
        <div className="form-panel">
          {message ? <p>{message}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          <Link className="primary-link" to="/login">
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
      <section className="page-heading">
        <h1>文章管理</h1>
        <p>{user ? `${user.email} 已登录，可以创建草稿并通过 API 或 CLI 继续编辑发布。` : "正在检查登录状态..."}</p>
      </section>

      <form className="form-panel" onSubmit={handleSubmit}>
        <div className="form-actions">
          <button onClick={handleLogout} type="button">
            退出登录
          </button>
        </div>
        <label>
          标题
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          正文
          <textarea value={content} onChange={(event) => setContent(event.target.value)} />
        </label>
        <button className="primary-button" type="submit">
          创建草稿
        </button>
        {message ? <p>{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </form>

      <section className="admin-list">
        <h2>全部文章</h2>
        <div className="post-list">
          {posts.map((post) => (
            <article className="post-card admin-post-card" key={post.id}>
              <div>
                <h3>{post.title}</h3>
                <p>{post.excerpt ?? (post.content.slice(0, 120) || "暂无正文")}</p>
                <div className="post-meta">
                  {post.status} · {post.slug}
                </div>
              </div>
              <div className="post-actions">
                <button disabled={post.status === "published"} onClick={() => publish(post.id)} type="button">
                  发布
                </button>
                <button onClick={() => remove(post.id)} type="button">
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
