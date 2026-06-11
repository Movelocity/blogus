import { Link, useParams } from "react-router";
import { useEffect, useState } from "react";
import type { BlogPost } from "@blogus/shared";
import { getPostBySlug } from "../lib/api";
import { MarkdownView } from "../lib/markdown";

export function PostPage() {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      setError("文章地址无效");
      setLoading(false);
      return;
    }

    setLoading(true);
    getPostBySlug(slug)
      .then((result) => {
        setPost(result.post);
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "加载失败");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <p className="text-slate-600">正在加载文章...</p>;
  }

  if (error || !post) {
    return (
      <section className="grid gap-4">
        <p className="text-red-700">{error ?? "文章不存在"}</p>
        <Link className="justify-self-start text-teal-700 transition hover:text-teal-900" to="/">
          返回文章列表
        </Link>
      </section>
    );
  }

  return (
    <article className="grid gap-7">
      <header className="grid gap-4">
        <Link className="text-sm font-medium text-teal-700 transition hover:text-teal-900" to="/">
          返回文章列表
        </Link>
        {post.coverImageUrl ? (
          <img
            alt=""
            className="max-h-[460px] w-full rounded-md border border-slate-200 object-cover"
            src={post.coverImageUrl}
          />
        ) : null}
        <div className="grid gap-3">
          <h1 className="m-0 max-w-4xl break-words text-4xl font-bold leading-tight text-slate-950 max-sm:text-3xl">
            {post.title}
          </h1>
          <div className="flex flex-wrap gap-2 text-sm text-slate-500">
            <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleString() : "已发布"}</span>
            {post.tags.map((tag) => (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700" key={tag}>
                {tag}
              </span>
            ))}
          </div>
          {post.excerpt ? <p className="m-0 max-w-3xl text-lg leading-8 text-slate-600">{post.excerpt}</p> : null}
        </div>
      </header>
      <MarkdownView content={post.content} />
    </article>
  );
}
