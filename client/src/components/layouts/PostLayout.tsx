import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router";
import { ListBulletsIcon, XIcon } from "@phosphor-icons/react";
import { Navigation } from "../Navigation";
import { Footer } from "../Footer";
import { TableOfContents } from "../TableOfContents";
import { PostTocContext } from "../../contexts/post-toc";
import type { HeadingItem } from "../../lib/markdown";

const TOC_COLLAPSED_KEY = "post-toc-collapsed";

function readTocCollapsed(): boolean {
  try {
    return localStorage.getItem(TOC_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function PostLayout() {
  const [headings, setHeadingsState] = useState<HeadingItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [desktopTocCollapsed, setDesktopTocCollapsed] = useState(readTocCollapsed);

  const setHeadings = useCallback((h: HeadingItem[]) => {
    setHeadingsState(h);
  }, []);

  const toggleDesktopToc = useCallback(() => {
    setDesktopTocCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(TOC_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (headings.length === 0) {
      setDrawerOpen(false);
    }
  }, [headings]);

  const hasToc = headings.length > 0;
  const drawerToc = hasToc ? (
    <TableOfContents headings={headings} onNavigate={() => setDrawerOpen(false)} />
  ) : null;
  const desktopToc = hasToc ? (
    <TableOfContents
      headings={headings}
      collapsed={desktopTocCollapsed}
      onToggleCollapsed={toggleDesktopToc}
    />
  ) : null;

  return (
    <PostTocContext.Provider value={{ setHeadings }}>
      <div className="flex min-h-dvh flex-col bg-background text-foreground">
        <Navigation />

        {hasToc && !drawerOpen && (
          <button
            aria-label="打开目录"
            className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-primary p-3 text-sm font-medium text-primary-foreground shadow-lg transition hover:bg-primary/90 active:translate-y-px xl:hidden"
            onClick={() => setDrawerOpen(true)}
          >
            <ListBulletsIcon className="h-4 w-4" weight="bold" />
          </button>
        )}

        {drawerOpen && (
          <div className="fixed inset-0 z-40 xl:hidden" onClick={() => setDrawerOpen(false)}>
            <aside
              className="absolute left-0 top-0 h-full w-72 max-w-[85vw] overflow-y-auto overflow-x-hidden rounded-r-2xl bg-background shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-foreground/10 bg-background px-5 py-4">
                <p className="font-mono text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  目录
                </p>
                <button
                  aria-label="关闭目录"
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  onClick={() => setDrawerOpen(false)}
                >
                  <XIcon className="h-4 w-4" weight="bold" />
                </button>
              </div>
              <div className="min-w-0 px-3 py-4">{drawerToc}</div>
            </aside>
          </div>
        )}

        <div className="mx-auto w-full max-w-[1400px] flex-1 pb-20 pt-14">
          <div className="relative flex gap-8 xl:gap-10">
            {hasToc && (
              <aside className="max-xl:hidden w-[220px] shrink-0 pl-3">
                <div className="sticky top-24 flex max-h-[calc(100dvh-3.5rem-1.5rem)] min-h-0 min-w-0 flex-col overflow-hidden pr-2">
                  {desktopToc}
                </div>
              </aside>
            )}
            <div className="flex-1 min-w-0">
              <Outlet />
            </div>
            {hasToc && (
              <div className="max-xl:hidden w-44 2xl:w-56 shrink-0" aria-hidden="true" />
            )}
          </div>
        </div>

        <Footer />
      </div>
    </PostTocContext.Provider>
  );
}
