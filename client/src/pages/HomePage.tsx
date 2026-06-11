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
      <section className="page-heading">
        <h1>Blogus</h1>
        <p>自托管、可编程、面向 Agent 的个人博客系统。</p>
      </section>

      {error ? <p>{error}</p> : null}

      <section className="post-list">
        {posts.map((post) => (
          <article className="post-card" key={post.id}>
            <h2>{post.title}</h2>
            <p>{post.excerpt ?? post.content.slice(0, 120)}</p>
            <div className="post-meta">
              {post.publishedAt ? new Date(post.publishedAt).toLocaleString() : "已发布"}
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
