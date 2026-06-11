import { useEffect, useState } from "react";
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
        {posts.map((post) => (
          <article className="rounded-lg border border-slate-200 bg-white p-5" key={post.id}>
            <h2 className="mb-2 text-xl font-semibold text-slate-900">{post.title}</h2>
            <p className="text-slate-700">{post.excerpt ?? post.content.slice(0, 120)}</p>
            <div className="text-sm text-slate-500">
              {post.publishedAt ? new Date(post.publishedAt).toLocaleString() : "已发布"}
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
