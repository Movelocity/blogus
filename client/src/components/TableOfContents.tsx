import { useEffect, useRef, useState } from "react";
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import { getHeadings, type HeadingItem } from "../lib/markdown";

interface TableOfContentsProps {
  content?: string;
  headings?: HeadingItem[];
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function TableOfContents({
  content,
  headings: headingsProp,
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
}: TableOfContentsProps) {
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

  const collapsible = Boolean(onToggleCollapsed);

  const list = (
    <ul className="grid min-h-0 gap-0.5 overflow-y-auto overscroll-y-contain border-l border-foreground/10">
      {headings.map((h) => {
        const isActive = h.slug === activeSlug;
        const indent = h.level === 1 ? 0 : h.level === 2 ? 0 : 1;
        return (
          <li key={h.slug} className="min-w-0">
            <a
              className={`block min-w-0 line-clamp-2 py-1 text-sm leading-snug transition-colors ${
                isActive
                  ? "border-l-2 border-foreground font-medium text-foreground -ml-px"
                  : "text-muted-foreground hover:text-foreground"
              } ${indent === 1 ? "pl-5" : "pl-3"}`}
              href={`#${h.slug}`}
              title={h.text}
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
  );

  return (
    <nav className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden" aria-label="目录">
      {collapsible ? (
        <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
          <p className="font-mono text-xs font-medium tracking-wider text-muted-foreground uppercase">目录</p>
          <button
            type="button"
            aria-label={collapsed ? "展开目录" : "折叠目录"}
            aria-expanded={!collapsed}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={onToggleCollapsed}
          >
            {collapsed ? (
              <CaretDownIcon className="h-3.5 w-3.5" weight="bold" />
            ) : (
              <CaretUpIcon className="h-3.5 w-3.5" weight="bold" />
            )}
          </button>
        </div>
      ) : (
        <p className="mb-3 shrink-0 font-mono text-xs font-medium tracking-wider text-muted-foreground uppercase">
          目录
        </p>
      )}
      {collapsible ? (
        <div
          className={`grid min-h-0 flex-1 transition-[grid-template-rows] duration-300 ease-out ${
            collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
          }`}
        >
          <div className="min-h-0 overflow-hidden">{list}</div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">{list}</div>
      )}
    </nav>
  );
}
