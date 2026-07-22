import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Outlet } from "react-router";
import { ListBullets, X } from "@phosphor-icons/react";
import { Navigation } from "../Navigation";
import { Footer } from "../Footer";
import { TableOfContents } from "../TableOfContents";
import type { HeadingItem } from "../../lib/markdown";

interface TocContextValue {
  setHeadings: (headings: HeadingItem[]) => void;
}

const TocContext = createContext<TocContextValue>({ setHeadings: () => {} });

export function useToc() {
  return useContext(TocContext);
}

export function PostLayout() {
  const [headings, setHeadingsState] = useState<HeadingItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const setHeadings = useCallback((h: HeadingItem[]) => {
    setHeadingsState(h);
  }, []);

  useEffect(() => {
    if (headings.length === 0) {
      setDrawerOpen(false);
    }
  }, [headings]);

  const hasToc = headings.length > 0;
  const tocContent = hasToc ? (
    <TableOfContents headings={headings} onNavigate={() => setDrawerOpen(false)} />
  ) : null;

  return (
    <TocContext.Provider value={{ setHeadings }}>
      <div className="flex min-h-dvh flex-col bg-background text-foreground">
        <Navigation />

        {hasToc && !drawerOpen && (
          <button
            aria-label="打开目录"
            className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-foreground px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition hover:bg-foreground/90 active:translate-y-px xl:hidden"
            onClick={() => setDrawerOpen(true)}
          >
            <ListBullets className="h-4 w-4" weight="bold" />
            目录
          </button>
        )}

        {drawerOpen && (
          <div className="fixed inset-0 z-40 xl:hidden" onClick={() => setDrawerOpen(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <aside
              className="absolute left-0 top-0 h-full w-72 max-w-[85vw] overflow-y-auto bg-background shadow-2xl"
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
                  <X className="h-4 w-4" weight="bold" />
                </button>
              </div>
              <div className="px-3 py-4">{tocContent}</div>
            </aside>
          </div>
        )}

        <div className="mx-auto w-full max-w-[1400px] flex-1 px-6 pb-20 pt-28 lg:px-12">
          <div className="relative flex gap-8 xl:gap-10">
            {hasToc && (
              <aside className="max-xl:hidden w-44 2xl:w-56 shrink-0">
                <div className="sticky top-28 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-2">
                  {tocContent}
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
    </TocContext.Provider>
  );
}
