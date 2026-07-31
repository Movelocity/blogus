import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { BlogPost } from "@blogus/shared";
import { listPosts } from "../lib/api";
import { estimateReadingMinutes, formatPostDate, getPostSummary, sortPostsByPublishedDate } from "../lib/posts";

// const listMarqueeItems = ["最新文章", "开发记录", "读书笔记", "工具实践", "复盘", "归档"];

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
    <div className="grid gap-14">

      <section className="grid gap-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-4xl">
            <span className="mb-4 inline-flex items-center gap-3 text-sm font-bold text-accent">
              <span className="h-px w-10 bg-accent" />
              Blog
            </span>
          </div>
        </div>
      </section>

      {loading ? <HomeSkeleton /> : null}

      {!loading && error ? <StatePanel title="文章加载失败" description={error} tone="error" /> : null}

      {!loading && !error && posts.length === 0 ? (
        <StatePanel title="还没有公开文章" description="发布第一篇文章后，它会出现在这里和归档页。" />
      ) : null}

      {!loading && !error && featuredPost ? (
        <section className="grid gap-12">
          <FeaturedPost post={featuredPost} />
          {recentPosts.length > 0 ? (
            <div className="grid gap-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <span className="mb-2 inline-flex items-center gap-3 text-sm font-bold text-accent">
                    <span className="h-px w-8 bg-accent" />
                    最近发布
                  </span>
                  <h2 className="m-0 font-display text-4xl font-bold text-foreground">全部文章</h2>
                </div>
                <Link className="text-sm font-bold text-accent transition-opacity hover:opacity-75" to="/archive">
                  查看时间线 →
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
    <article className="group grid overflow-hidden rounded-[8px] bg-[#264653] text-white transition-transform duration-300 hover:-translate-y-1 md:grid-cols-[0.95fr_1.05fr]">
      {post.coverImageUrl ? (
        <img alt="" className="h-72 w-full object-cover md:h-[320px]" src={post.coverImageUrl} />
      ) : (
        <div className="grid min-h-64 place-items-center bg-accent px-8">
          <span className="font-display text-6xl font-bold text-accent-foreground">New</span>
        </div>
      )}
      <div className="grid gap-6 p-8 lg:p-12">
        <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-white/75">
          <span>精选</span>
          <span className="h-px w-4 bg-white/30" />
          <span>{formatPostDate(post.publishedAt)}</span>
          <span className="h-px w-4 bg-white/30" />
          <span>{estimateReadingMinutes(post.content)} 分钟阅读</span>
        </div>
        <div className="grid gap-4">
          <h2 className="m-0 break-words font-display text-4xl font-bold leading-[1.05] text-white md:text-5xl">
            <Link
              className="transition-opacity duration-300 hover:opacity-80"
              to={`/posts/${post.slug}`}
            >
              {post.title}
            </Link>
          </h2>
          <p className="m-0 max-w-2xl leading-7 text-white/85">{getPostSummary(post, 150)}</p>
        </div>
        {post.tags.length > 0 ? <TagList tags={post.tags} tone="inverted" /> : null}
        <Link
          className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#264653] transition-transform duration-300 hover:-translate-y-1 active:scale-[0.98]"
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
    <article className="grid gap-4 rounded-[8px] bg-card p-6 transition-transform duration-300 hover:-translate-y-1 md:grid-cols-[1fr_auto] md:items-start lg:p-8">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-muted-foreground">
          <span>{formatPostDate(post.publishedAt)}</span>
          <span className="h-px w-4 bg-foreground/20" />
          <span>{estimateReadingMinutes(post.content)} 分钟阅读</span>
        </div>
        <h3 className="m-0 break-words font-display text-2xl font-bold leading-snug text-foreground lg:text-3xl">
          <Link className="transition-colors duration-300 hover:text-accent" to={`/posts/${post.slug}`}>
            {post.title}
          </Link>
        </h3>
        <p className="m-0 max-w-3xl text-sm leading-7 text-muted-foreground">{getPostSummary(post)}</p>
        {post.tags.length > 0 ? <TagList tags={post.tags} /> : null}
      </div>
      {post.coverImageUrl ? (
        <img alt="" className="h-32 w-full rounded-[8px] object-cover md:w-44" src={post.coverImageUrl} />
      ) : null}
    </article>
  );
}

function TagList({ tags, tone = "default" }: { tags: string[]; tone?: "default" | "inverted" }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            tone === "inverted" ? "bg-white/12 text-white/80" : "bg-secondary text-muted-foreground"
          }`}
          key={tag}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function StatePanel({
  title,
  description,
  tone = "empty",
}: {
  title: string;
  description: string;
  tone?: "empty" | "error";
}) {
  return (
    <section
      className={`border border-dashed p-8 ${
        tone === "error"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-foreground/20 bg-card text-foreground"
      }`}
    >
      <h2 className="m-0 font-display text-xl">{title}</h2>
      <p className="mb-0 mt-2 leading-relaxed text-muted-foreground">{description}</p>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <section className="grid gap-4" aria-label="文章正在加载">
      <div className="grid overflow-hidden border border-foreground/10 bg-card md:grid-cols-[0.95fr_1.05fr]">
        <div className="h-64 animate-pulse bg-muted" />
        <div className="grid gap-4 p-8 lg:p-12">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-10 w-4/5 animate-pulse rounded bg-muted" />
          <div className="h-20 w-full animate-pulse rounded bg-secondary" />
          <div className="h-10 w-28 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
      <div className="grid gap-3">
        {[0, 1].map((item) => (
          <div className="border border-foreground/10 bg-card p-6" key={item}>
            <div className="mb-3 h-4 w-36 animate-pulse rounded bg-muted" />
            <div className="mb-3 h-7 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-14 w-full animate-pulse rounded bg-secondary" />
          </div>
        ))}
      </div>
    </section>
  );
}
