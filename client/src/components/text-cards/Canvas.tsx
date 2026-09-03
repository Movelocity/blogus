import { Plus } from "@phosphor-icons/react";
import { forwardRef, useImperativeHandle, useRef } from "react";
import type { TextCardPane } from "@blogus/shared";
import { canvasBounds } from "../../features/text-cards/geometry";
import { PaneCard } from "./PaneCard";

export interface CanvasHandle {
  scrollToPane: (pane: TextCardPane) => void;
}

interface CanvasProps {
  panes: TextCardPane[];
  maximizedPaneId: string | null;
  onBringToFront: (id: string) => void;
  onTitleChange: (id: string, title: string) => void;
  onContentChange: (id: string, content: string) => void;
  onLayoutChange: (id: string, patch: Partial<Pick<TextCardPane, "x" | "y" | "width" | "height" | "minimized">>) => void;
  onOpenHlMenu: (id: string, rect: DOMRect) => void;
  onWordWrapChange: (id: string, wordWrap: boolean) => void;
  onMaximize: (id: string) => void;
  onRestore: () => void;
  onMinimize: (id: string) => void;
  onDelete: (id: string, hasContent: boolean) => void;
  onCreate: () => void | Promise<void>;
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas(
  {
    panes,
    maximizedPaneId,
    onBringToFront,
    onTitleChange,
    onContentChange,
    onLayoutChange,
    onOpenHlMenu,
    onWordWrapChange,
    onMaximize,
    onRestore,
    onMinimize,
    onDelete,
    onCreate
  },
  ref
) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const { width, height } = canvasBounds(panes);
  const visiblePanes = panes.filter((pane) => !pane.minimized);
  const maximizedPane = maximizedPaneId ? panes.find((pane) => pane.id === maximizedPaneId) ?? null : null;
  const shadowPane = maximizedPane && !maximizedPane.minimized ? maximizedPane : null;

  useImperativeHandle(ref, () => ({
    scrollToPane(pane: TextCardPane) {
      const viewport = viewportRef.current;
      if (!viewport) return;
      viewport.scrollTo({
        left: pane.x - (viewport.clientWidth - pane.width) / 2,
        top: pane.y - (viewport.clientHeight - pane.height) / 2,
        behavior: "smooth"
      });
    }
  }));

  return (
    <div ref={viewportRef} className="tc-canvas-viewport">
      <div className="tc-canvas" style={{ width, height }}>
        {panes.length === 0 ? (
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid place-items-center gap-4 rounded-lg border border-dashed border-[var(--tc-line)] bg-[var(--tc-panel)] px-8 py-10 text-center">
              <p className="m-0 text-sm text-[var(--tc-dim)]">这个工作区还没有卡片</p>
              <button className="tc-add-btn" type="button" onClick={() => void onCreate()}>
                <Plus size={16} weight="bold" />
                添加
              </button>
            </div>
          </div>
        ) : null}

        {visiblePanes.map((pane) => {
          if (maximizedPaneId && pane.id === maximizedPaneId) return null;
          return (
            <PaneCard
              key={pane.id}
              maximized={false}
              pane={pane}
              onBringToFront={() => onBringToFront(pane.id)}
              onContentChange={(content) => onContentChange(pane.id, content)}
              onDelete={() => void onDelete(pane.id, Boolean(pane.title.trim() || pane.content.trim()))}
              onLayoutChange={(patch) => onLayoutChange(pane.id, patch)}
              onMaximize={() => onMaximize(pane.id)}
              onMinimize={() => onMinimize(pane.id)}
              onOpenHlMenu={(rect) => onOpenHlMenu(pane.id, rect)}
              onRestore={onRestore}
              onTitleChange={(title) => onTitleChange(pane.id, title)}
              onWordWrapChange={(wordWrap) => onWordWrapChange(pane.id, wordWrap)}
            />
          );
        })}

        {shadowPane ? (
          <PaneCard
            key={`${shadowPane.id}-shadow`}
            maximized={false}
            pane={shadowPane}
            shadow
            onBringToFront={() => undefined}
            onContentChange={() => undefined}
            onDelete={() => undefined}
            onLayoutChange={() => undefined}
            onMaximize={() => undefined}
            onMinimize={() => undefined}
            onOpenHlMenu={() => undefined}
            onRestore={() => undefined}
            onTitleChange={() => undefined}
            onWordWrapChange={() => undefined}
          />
        ) : null}

        {maximizedPane ? (
          <PaneCard
            key={`${maximizedPane.id}-max`}
            maximized
            pane={maximizedPane}
            onBringToFront={() => onBringToFront(maximizedPane.id)}
            onContentChange={(content) => onContentChange(maximizedPane.id, content)}
            onDelete={() => void onDelete(maximizedPane.id, Boolean(maximizedPane.title.trim() || maximizedPane.content.trim()))}
            onLayoutChange={(patch) => onLayoutChange(maximizedPane.id, patch)}
            onMaximize={() => onMaximize(maximizedPane.id)}
            onMinimize={() => onMinimize(maximizedPane.id)}
            onOpenHlMenu={(rect) => onOpenHlMenu(maximizedPane.id, rect)}
            onRestore={onRestore}
            onTitleChange={(title) => onTitleChange(maximizedPane.id, title)}
            onWordWrapChange={(wordWrap) => onWordWrapChange(maximizedPane.id, wordWrap)}
          />
        ) : null}
      </div>
    </div>
  );
});
