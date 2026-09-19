import { useEffect, useRef, useState } from "react";
import { getHeadings, type HeadingItem } from "../lib/markdown";

interface V2TableOfContentsProps {
  content?: string;
  headings?: HeadingItem[];
  onNavigate?: () => void;
  /** 移动端抽屉内使用，不套用 sideCatalog 固定高度 */
  embedded?: boolean;
}

/** v2 侧栏目录：catalogItem / level-2 / active */
export function V2TableOfContents({
  content,
  headings: headingsProp,
  onNavigate,
  embedded = false,
}: V2TableOfContentsProps) {
  const headings = headingsProp ?? getHeadings(content ?? "");
  const [activeSlug, setActiveSlug] = useState<string>("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;

    setActiveSlug((prev) => prev || headings[0]?.slug || "");

    const visibleSlugs = new Set<string>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const slug = entry.target.id;
          if (!slug) continue;
          if (entry.isIntersecting) {
            visibleSlugs.add(slug);
          } else {
            visibleSlugs.delete(slug);
          }
        }

        if (visibleSlugs.size > 0) {
          const firstVisible = headings.find((h) => visibleSlugs.has(h.slug));
          if (firstVisible) setActiveSlug(firstVisible.slug);
        } else {
          setActiveSlug((prev) => {
            const idx = headings.findIndex((h) => h.slug === prev);
            if (idx === -1) return headings[0]?.slug ?? "";
            return prev;
          });
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );

    for (const h of headings) {
      const el = document.getElementById(h.slug);
      if (el) observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [headings]);

  if (headings.length === 0) return null;

  const scrollTo = (slug: string) => {
    const el = document.getElementById(slug);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top: y, behavior: "smooth" });
    history.replaceState(null, "", `#${slug}`);
    onNavigate?.();
  };

  const list = (
    <ul className="v2-side-catalog__list">
      {headings.map((h) => {
        const isChild = h.level >= 3;
        const isActive = h.slug === activeSlug;
        return (
          <li key={h.slug}>
            <a
              className={`v2-catalog-item${isChild ? " v2-catalog-item--level-2" : ""}${
                isActive ? " v2-catalog-item--active" : ""
              }`}
              href={`#${h.slug}`}
              title={h.text}
              onClick={(e) => {
                e.preventDefault();
                scrollTo(h.slug);
              }}
            >
              {isChild ? <em aria-hidden="true" /> : null}
              {h.text}
            </a>
          </li>
        );
      })}
    </ul>
  );

  if (embedded) {
    return (
      <nav aria-label="目录" className="min-w-0">
        {list}
      </nav>
    );
  }

  return (
    <nav aria-label="目录" className="v2-side-catalog">
      <div className="v2-side-catalog__list-wrapper">{list}</div>
    </nav>
  );
}
