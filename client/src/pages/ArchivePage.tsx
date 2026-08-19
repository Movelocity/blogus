import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import type { BlogPost } from "@blogus/shared";
import { listPosts } from "../lib/api";
import {
  estimateReadingMinutes,
  formatPostDate,
  formatPostMonth,
  getPostDate,
  sortPostsByPublishedDate,
} from "../lib/posts";
import { SectionHeader } from "../components/shared/SectionHeader";

export function ArchivePage() {
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
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => groupPostsByMonth(posts), [posts]);

  return (
    <div className="grid gap-16">

      {loading ? <ArchiveSkeleton /> : null}

      {!loading && error ? (
        <section className="border border-destructive/30 bg-destructive/5 p-8 text-destructive">
          <h2 className="m-0 font-display text-xl">时间线加载失败</h2>
          <p className="mb-0 mt-2 leading-relaxed">{error}</p>
        </section>
      ) : null}

      {!loading && !error && posts.length === 0 ? (
        <section className="border border-dashed border-foreground/20 bg-card p-8 text-foreground">
          <h2 className="m-0 font-display text-xl">暂无文章</h2>
          <p className="mb-0 mt-2 leading-relaxed text-muted-foreground">发布文章后，时间线会自动按月份生成。</p>
        </section>
      ) : null}

      {!loading && !error && groups.length > 0 ? (
        <section className="grid gap-16">
          {groups.map((group) => (
              <div key={group.month} className="grid gap-8 md:grid-cols-[12rem_1fr]">
                <div className="relative">
                  <h2 className="m-0 font-display text-3xl tracking-tight text-foreground">{group.month}</h2>
                  <div className="absolute -left-4 bottom-0 top-0 w-px bg-foreground/10" />
                </div>
                <div className="grid gap-4">
                  {group.posts.map((post) => (
                      <article key={post.id} className="hover-lift grid gap-3 border border-foreground/5 bg-card p-6 transition-all duration-300 rounded-lg">
                        <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
                          <time dateTime={getPostDate(post)}>{formatPostDate(getPostDate(post))}</time>
                          <span className="h-px w-4 bg-foreground/20" />
                          <span>{estimateReadingMinutes(post.content)} 分钟阅读</span>
                        </div>
                        <h3 className="m-0 break-words font-display text-2xl leading-snug tracking-tight text-foreground">
                          <Link
                            className="transition-colors duration-300 hover:text-muted-foreground"
                            to={`/posts/${post.slug}`}
                          >
                            {post.title}
                          </Link>
                        </h3>
                        {post.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {post.tags.map((tag) => (
                              <span
                                className="border border-foreground/10 bg-secondary px-2.5 py-1 font-mono text-xs text-muted-foreground"
                                key={tag}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </article>
                  ))}
                </div>
              </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function groupPostsByMonth(posts: BlogPost[]) {
  const groups = new Map<string, BlogPost[]>();

  for (const post of posts) {
    const month = formatPostMonth(getPostDate(post));
    groups.set(month, [...(groups.get(month) ?? []), post]);
  }

  return Array.from(groups, ([month, groupedPosts]) => ({ month, posts: groupedPosts }));
}

function ArchiveSkeleton() {
  return (
    <section className="grid gap-8" aria-label="时间线正在加载">
      {[0, 1, 2].map((group) => (
        <div className="grid gap-6 md:grid-cols-[11rem_1fr]" key={group}>
          <div className="h-8 w-32 animate-pulse rounded bg-muted/50" />
          <div className="grid gap-4">
            {[0, 1].map((item) => (
              <div className="border border-foreground/10 bg-card p-6" key={item}>
                <div className="mb-3 h-4 w-36 animate-pulse rounded bg-muted/50" />
                <div className="h-8 w-2/3 animate-pulse rounded bg-muted/50" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
