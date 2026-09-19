import { Link, useParams } from "react-router";
import { useEffect, useMemo, useState } from "react";
import type { BlogPost } from "@blogus/shared";
import { getPostBySlug } from "../lib/api";
import { getHeadings, MarkdownView, preloadMathRendering } from "../lib/markdown";
import { useToc } from "../contexts/post-toc";
import { formatPostPageTitle } from "../lib/documentTitle";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { V2DocImageLightbox } from "../features/layout-test/v2-doc/V2DocImageLightbox";
import { collectGalleryImages } from "../features/layout-test/v2-doc/collectGalleryImages";

/** 布局测试页：数据与 PostPage 相同，仅壳层与排版不同 */
export function WikiDocLayoutTestPage() {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { setHeadings } = useToc();

  useDocumentTitle(!loading && post ? formatPostPageTitle(post.title) : undefined);

  useEffect(() => {
    if (!slug) {
      setError("文章地址无效");
      setLoading(false);
      return;
    }

    setLoading(true);
    getPostBySlug(slug)
      .then((result) => {
        preloadMathRendering(result.post.content);
        setPost(result.post);
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "加载失败");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!post) return;
    const headings = getHeadings(post.content);
    setHeadings(headings);
    return () => setHeadings([]);
  }, [post, setHeadings]);

  const galleryUrls = useMemo(
    () => (post ? collectGalleryImages(post.coverImageUrl, post.content) : []),
    [post],
  );
  const markdownGalleryStart = post?.coverImageUrl ? 1 : 0;

  if (loading) {
    return <WikiDocSkeleton />;
  }

  if (error || !post) {
    return (
      <section className="mx-auto grid max-w-2xl gap-6 border border-destructive/30 bg-destructive/5 p-8">
        <div className="grid gap-3">
          <h1 className="m-0 text-2xl font-semibold text-[#1a1a1a]">无法打开这篇文章</h1>
          <p className="m-0 leading-relaxed text-[#666]">{error ?? "文章不存在，或尚未发布。"}</p>
        </div>
        <Link
          className="inline-flex w-fit items-center rounded-full bg-[#136ec2] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#0f5da3]"
          to="/"
        >
          返回首页
        </Link>
      </section>
    );
  }

  return (
    <article className="w-full min-w-0">

      <header className="v2-doc-header">
        <h1 className="v2-doc-title">{post.title}</h1>
        {post.excerpt ? <p className="v2-doc-subtitle">{post.excerpt}</p> : null}
      </header>

      <div className="v2-doc-body min-h-[60vh]">
        {post.coverImageUrl ? (
          <figure className="v2-doc-figure">
            <button type="button" className="v2-gallery-trigger" onClick={() => setLightboxIndex(0)}>
              <img alt="" className="v2-gallery-img" src={post.coverImageUrl} />
            </button>
          </figure>
        ) : null}
        <MarkdownView
          article
          content={post.content}
          galleryImageStartIndex={markdownGalleryStart}
          onGalleryImageOpen={setLightboxIndex}
        />
      </div>

      <V2DocImageLightbox
        index={lightboxIndex}
        urls={galleryUrls}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />

      {post.tags.length > 0 ? (
        <footer className="mt-8 border-t border-[#e8e8e8] pt-4 text-[13px] text-[#666]">
          <div className="flex flex-wrap gap-3">
            {post.tags.map((tag) => (
              <span className="inline-flex items-center gap-1" key={tag}>
                <span aria-hidden="true">#</span>
                <span>{tag}</span>
              </span>
            ))}
          </div>
        </footer>
      ) : null}

      <p className="mt-6 text-xs text-[#999]">
        标准文章页：
        <Link className="ml-1 text-[#136ec2] hover:underline" to={`/posts/${post.slug}`}>
          /posts/{post.slug}
        </Link>
      </p>
    </article>
  );
}

function WikiDocSkeleton() {
  return (
    <article className="w-full min-w-0" aria-label="文章正在加载">
      <div className="mb-4 h-6 w-36 animate-pulse rounded bg-[#eee]" />
      <header className="border-b border-[#e8e8e8] pb-6 pt-8">
        <div className="h-9 w-4/5 animate-pulse rounded bg-[#eee]" />
        <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-[#eee]" />
      </header>
      <div className="mt-6 grid gap-4">
        {[0, 1, 2, 3].map((item) => (
          <div className="grid gap-2" key={item}>
            <div className="h-4 w-full animate-pulse rounded bg-[#eee]" />
            <div className="h-4 w-11/12 animate-pulse rounded bg-[#eee]" />
          </div>
        ))}
      </div>
    </article>
  );
}
