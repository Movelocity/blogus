import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router";
import { ListBulletsIcon, XIcon } from "@phosphor-icons/react";
import { Navigation } from "../Navigation";
import { Footer } from "../Footer";
import { V2TableOfContents } from "../V2TableOfContents";
import { PostTocContext } from "../../contexts/post-toc";
import type { HeadingItem } from "../../lib/markdown";
import "../../features/layout-test/v2-doc/v2-doc.css";

export function WikiDocLayout() {
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
  const drawerToc = hasToc ? (
    <V2TableOfContents embedded headings={headings} onNavigate={() => setDrawerOpen(false)} />
  ) : null;
  const desktopToc = hasToc ? <V2TableOfContents headings={headings} /> : null;

  return (
    <PostTocContext.Provider value={{ setHeadings }}>
      <div className="v2-doc flex min-h-dvh flex-col">
        <Navigation />

        {hasToc && !drawerOpen && (
          <button
            aria-label="打开目录"
            className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] right-[max(1rem,env(safe-area-inset-right,0px))] z-30 flex items-center gap-2 rounded-full bg-[#4e6ef2] p-3 text-sm font-medium text-white shadow-lg transition hover:bg-[#3d5bd9] active:translate-y-px xl:hidden"
            onClick={() => setDrawerOpen(true)}
          >
            <ListBulletsIcon className="h-4 w-4" weight="bold" />
          </button>
        )}

        {drawerOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] xl:hidden"
            onClick={() => setDrawerOpen(false)}
          >
            <aside
              className="absolute left-0 top-0 h-full w-72 max-w-[85vw] overflow-y-auto overflow-x-hidden rounded-r-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e8e8e8] bg-white px-5 py-4">
                <p className="text-sm font-semibold text-[#272729]">目录</p>
                <button
                  aria-label="关闭目录"
                  className="rounded-full p-1.5 text-[#666] transition-colors hover:bg-[#f5f5f5]"
                  onClick={() => setDrawerOpen(false)}
                >
                  <XIcon className="h-4 w-4" weight="bold" />
                </button>
              </div>
              <div className="min-w-0 px-3 py-4">{drawerToc}</div>
            </aside>
          </div>
        )}

        <div className="v2-index-content min-w-0 flex-1 pb-24 pt-14 max-xl:pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
          {hasToc ? (
            <div className="v2-index-left max-xl:hidden">
              <div className="v2-sider-wrapper">{desktopToc}</div>
            </div>
          ) : null}

          <div className={`v2-index-right min-w-0 ${hasToc ? "" : "v2-index-right--solo"}`}>
            <div className="v2-index-main min-w-0">
              <Outlet />
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </PostTocContext.Provider>
  );
}
