import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import type { BlogPost } from "@blogus/shared";
import { listPosts } from "../lib/api";
import {
  estimateReadingMinutes,
  formatPostDate,
  formatPostMonth,
  getPostDate,
  sortPostsByPublishedDate
} from "../lib/posts";

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
    <div className="grid gap-10">
      <header className="grid gap-3 border-b border-slate-200 pb-8">
        <p className="m-0 text-sm font-semibold text-teal-700">Archive</p>
        <h1 className="m-0 text-4xl font-bold leading-tight text-slate-950 md:text-5xl">文章归档</h1>
        <p className="m-0 max-w-2xl text-base leading-7 text-slate-600">
          按发布时间整理所有公开文章，适合从时间线回看已经发布的内容。
        </p>
      </header>

      {loading ? <ArchiveSkeleton /> : null}

      {!loading && error ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-8 text-red-900">
          <h2 className="m-0 text-xl font-semibold">归档加载失败</h2>
          <p className="mb-0 mt-2 leading-7">{error}</p>
        </section>
      ) : null}

      {!loading && !error && posts.length === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-slate-700">
          <h2 className="m-0 text-xl font-semibold">暂无归档</h2>
          <p className="mb-0 mt-2 leading-7">发布文章后，归档会自动按月份生成。</p>
        </section>
      ) : null}

      {!loading && !error && groups.length > 0 ? (
        <section className="grid gap-8">
          {groups.map((group) => (
            <div className="grid gap-4 md:grid-cols-[11rem_1fr]" key={group.month}>
              <h2 className="m-0 text-xl font-semibold text-slate-950">{group.month}</h2>
              <div className="grid gap-3">
                {group.posts.map((post) => (
                  <article
                    className="grid gap-2 rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200"
                    key={post.id}
                  >
                    <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                      <time dateTime={getPostDate(post)}>{formatPostDate(getPostDate(post))}</time>
                      <span>{estimateReadingMinutes(post.content)} 分钟阅读</span>
                    </div>
                    <h3 className="m-0 break-words text-xl font-semibold leading-snug text-slate-950">
                      <Link className="transition hover:text-teal-700" to={`/posts/${post.slug}`}>
                        {post.title}
                      </Link>
                    </h3>
                    {post.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {post.tags.map((tag) => (
                          <span
                            className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
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
    <section className="grid gap-6" aria-label="归档正在加载">
      {[0, 1, 2].map((group) => (
        <div className="grid gap-4 md:grid-cols-[11rem_1fr]" key={group}>
          <div className="h-7 w-32 animate-pulse rounded bg-slate-200" />
          <div className="grid gap-3">
            {[0, 1].map((item) => (
              <div className="rounded-lg border border-slate-200 bg-white p-5" key={item}>
                <div className="mb-3 h-4 w-36 animate-pulse rounded bg-slate-200" />
                <div className="h-7 w-2/3 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
