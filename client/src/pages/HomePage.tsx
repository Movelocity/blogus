import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { BlogPost } from "@blogus/shared";
import { listPosts } from "../lib/api";

export function HomePage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPosts({ visibility: "published" })
      .then((result) => setPosts(result.posts))
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "加载失败");
      });
  }, []);

  return (
    <>
      <section className="mb-6">
        <h1 className="mb-2 text-4xl font-bold leading-tight text-slate-900">Blogus</h1>
        <p className="m-0 text-slate-600">自托管、可编程、面向 Agent 的个人博客系统。</p>
      </section>

      {error ? <p className="text-red-700">{error}</p> : null}

      <section className="grid gap-4">
        {posts.length === 0 && !error ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-slate-600">
            暂无已发布文章。
          </div>
        ) : null}
        {posts.map((post) => (
          <article className="rounded-lg border border-slate-200 bg-white p-5" key={post.id}>
            {post.coverImageUrl ? (
              <img alt="" className="mb-4 max-h-64 w-full rounded-md object-cover" src={post.coverImageUrl} />
            ) : null}
            <h2 className="mb-2 break-words text-xl font-semibold text-slate-900">
              <Link className="transition hover:text-teal-700" to={`/posts/${post.slug}`}>
                {post.title}
              </Link>
            </h2>
            <p className="m-0 text-slate-700">{post.excerpt ?? (post.content.slice(0, 160) || "暂无摘要")}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-500">
              {post.publishedAt ? new Date(post.publishedAt).toLocaleString() : "已发布"}
              {post.tags.map((tag) => (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
