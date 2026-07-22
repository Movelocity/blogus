import { useEffect, useRef, useState } from "react";
import { getHeadings, type HeadingItem } from "../lib/markdown";

interface TableOfContentsProps {
  content?: string;
  headings?: HeadingItem[];
  onNavigate?: () => void;
}

export function TableOfContents({ content, headings: headingsProp, onNavigate }: TableOfContentsProps) {
  const headings = headingsProp ?? getHeadings(content ?? "");
  const [activeSlug, setActiveSlug] = useState<string>("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;

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

  return (
    <nav className="max-w-64" aria-label="目录">
      <p className="mb-3 font-mono text-xs font-medium tracking-wider text-muted-foreground uppercase">
        目录
      </p>
      <ul className="grid gap-0.5 border-l border-foreground/10">
        {headings.map((h) => {
          const isActive = h.slug === activeSlug;
          const indent = h.level === 1 ? 0 : h.level === 2 ? 0 : 1;
          return (
            <li key={h.slug}>
              <a
                className={`block truncate py-1 text-sm leading-snug transition-colors ${
                  isActive
                    ? "border-l-2 border-foreground font-medium text-foreground -ml-px"
                    : "text-muted-foreground hover:text-foreground"
                } ${indent === 1 ? "pl-5" : "pl-3"}`}
                href={`#${h.slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById(h.slug);
                  if (!el) return;
                  const y = el.getBoundingClientRect().top + window.scrollY - 96;
                  window.scrollTo({ top: y, behavior: "smooth" });
                  history.replaceState(null, "", `#${h.slug}`);
                  onNavigate?.();
                }}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
