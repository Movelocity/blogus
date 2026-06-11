import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { BlogPost } from "@blogus/shared";
import { listPosts } from "../lib/api";
import { estimateReadingMinutes, formatPostDate, getPostSummary, sortPostsByPublishedDate } from "../lib/posts";

export function HomePage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listPosts({ visibility: "published" })
      .then((result) => {
        setPosts(sortPostsByPublishedDate(result.posts));
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "加载失败");
      })
      .finally(() => setLoading(false));
  }, []);

  const featuredPost = posts[0];
  const recentPosts = posts.slice(1);

  return (
    <div className="grid gap-12">
      <section className="grid gap-7 border-b border-slate-200 pb-10 md:grid-cols-[1.05fr_0.95fr] md:items-end">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold text-teal-700">Blogus Journal</p>
          <h1 className="m-0 text-4xl font-bold leading-tight text-slate-950 md:text-5xl">
            自托管写作，面向长期阅读。
          </h1>
        </div>
        <p className="m-0 max-w-xl text-base leading-7 text-slate-600 md:justify-self-end">
          这里收录已经发布的内容，适合从最新一篇开始阅读。
        </p>
      </section>

      {loading ? <HomeSkeleton /> : null}

      {!loading && error ? <StatePanel title="文章加载失败" description={error} tone="error" /> : null}

      {!loading && !error && posts.length === 0 ? (
        <StatePanel title="还没有公开文章" description="发布第一篇文章后，它会出现在这里和归档页。" />
      ) : null}

      {!loading && !error && featuredPost ? (
        <section className="grid gap-8">
          <FeaturedPost post={featuredPost} />
          {recentPosts.length > 0 ? (
            <div className="grid gap-4">
              <div className="flex items-end justify-between gap-4">
                <h2 className="m-0 text-2xl font-semibold text-slate-950">最近文章</h2>
                <Link className="text-sm font-medium text-teal-700 transition hover:text-teal-900" to="/archive">
                  查看归档
                </Link>
              </div>
              <div className="grid gap-4">
                {recentPosts.map((post) => (
                  <PostListItem key={post.id} post={post} />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function FeaturedPost({ post }: { post: BlogPost }) {
  return (
    <article className="grid overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:grid-cols-[0.95fr_1.05fr]">
      {post.coverImageUrl ? (
        <img alt="" className="h-72 w-full object-cover md:h-full" src={post.coverImageUrl} />
      ) : (
        <div className="grid min-h-64 place-items-center bg-[linear-gradient(135deg,#0f766e,#111827)] px-8 text-white">
          <span className="max-w-xs text-3xl font-semibold leading-tight">Blogus</span>
        </div>
      )}
      <div className="grid gap-5 p-6 md:p-8">
        <div className="flex flex-wrap gap-3 text-sm text-slate-500">
          <span>{formatPostDate(post.publishedAt)}</span>
          <span>{estimateReadingMinutes(post.content)} 分钟阅读</span>
        </div>
        <div className="grid gap-3">
          <h2 className="m-0 break-words text-3xl font-bold leading-tight text-slate-950 md:text-4xl">
            <Link className="transition hover:text-teal-700" to={`/posts/${post.slug}`}>
              {post.title}
            </Link>
          </h2>
          <p className="m-0 max-w-2xl text-base leading-7 text-slate-600">{getPostSummary(post, 150)}</p>
        </div>
        {post.tags.length > 0 ? <TagList tags={post.tags} /> : null}
        <Link
          className="inline-flex w-fit items-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 active:translate-y-px"
          to={`/posts/${post.slug}`}
        >
          阅读文章
        </Link>
      </div>
    </article>
  );
}

function PostListItem({ post }: { post: BlogPost }) {
  return (
    <article className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200 md:grid-cols-[1fr_auto] md:items-start">
      <div className="grid gap-3">
        <div className="flex flex-wrap gap-3 text-sm text-slate-500">
          <span>{formatPostDate(post.publishedAt)}</span>
          <span>{estimateReadingMinutes(post.content)} 分钟阅读</span>
        </div>
        <h3 className="m-0 break-words text-2xl font-semibold leading-snug text-slate-950">
          <Link className="transition hover:text-teal-700" to={`/posts/${post.slug}`}>
            {post.title}
          </Link>
        </h3>
        <p className="m-0 max-w-3xl text-base leading-7 text-slate-600">{getPostSummary(post)}</p>
        {post.tags.length > 0 ? <TagList tags={post.tags} /> : null}
      </div>
      {post.coverImageUrl ? (
        <img alt="" className="h-32 w-full rounded-lg object-cover md:w-44" src={post.coverImageUrl} />
      ) : null}
    </article>
  );
}

function TagList({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700" key={tag}>
          {tag}
        </span>
      ))}
    </div>
  );
}

function StatePanel({ title, description, tone = "empty" }: { title: string; description: string; tone?: "empty" | "error" }) {
  return (
    <section
      className={`rounded-lg border border-dashed p-8 ${
        tone === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-slate-300 bg-white text-slate-700"
      }`}
    >
      <h2 className="m-0 text-xl font-semibold">{title}</h2>
      <p className="mb-0 mt-2 leading-7">{description}</p>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <section className="grid gap-4" aria-label="文章正在加载">
      <div className="grid overflow-hidden rounded-lg border border-slate-200 bg-white md:grid-cols-[0.95fr_1.05fr]">
        <div className="h-64 animate-pulse bg-slate-200" />
        <div className="grid gap-4 p-6 md:p-8">
          <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
          <div className="h-10 w-4/5 animate-pulse rounded bg-slate-200" />
          <div className="h-20 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-10 w-28 animate-pulse rounded-lg bg-slate-200" />
        </div>
      </div>
      <div className="grid gap-3">
        {[0, 1].map((item) => (
          <div className="rounded-lg border border-slate-200 bg-white p-5" key={item}>
            <div className="mb-3 h-4 w-36 animate-pulse rounded bg-slate-200" />
            <div className="mb-3 h-7 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="h-14 w-full animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </section>
  );
}
