import { AlignLeft, ArrowsOut, Minus, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { HlMode, TextCardPane } from "@blogus/shared";
import { MIN_PANE_HEIGHT, MIN_PANE_WIDTH, TOP_BAR_HEIGHT } from "../../features/text-cards/constants";
import { highlightContent, hlModeLabel } from "../../features/text-cards/highlight";

interface PaneCardProps {
  pane: TextCardPane;
  maximized: boolean;
  shadow?: boolean;
  onBringToFront: () => void;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onLayoutChange: (patch: Partial<Pick<TextCardPane, "x" | "y" | "width" | "height" | "minimized">>) => void;
  onOpenHlMenu: (rect: DOMRect) => void;
  onWordWrapChange: (wordWrap: boolean) => void;
  onMaximize: () => void;
  onRestore: () => void;
  onMinimize: () => void;
  onDelete: () => void;
}

export function PaneCard({
  pane,
  maximized,
  shadow = false,
  onBringToFront,
  onTitleChange,
  onContentChange,
  onLayoutChange,
  onOpenHlMenu,
  onWordWrapChange,
  onMaximize,
  onRestore,
  onMinimize,
  onDelete
}: PaneCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [titleEditing, setTitleEditing] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const resizeRef = useRef<{ startY: number; originHeight: number } | null>(null);

  useEffect(() => {
    if (!titleEditing) return;
    titleRef.current?.focus();
    titleRef.current?.select();
  }, [titleEditing]);

  const startDrag = (event: React.MouseEvent) => {
    if (shadow || maximized) return;
    if ((event.target as HTMLElement).closest("button,[data-no-drag]")) return;
    event.preventDefault();
    onBringToFront();

    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: pane.x,
      originY: pane.y
    };

    const onMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current || !cardRef.current) return;
      const dx = moveEvent.clientX - dragRef.current.startX;
      const dy = moveEvent.clientY - dragRef.current.startY;
      cardRef.current.style.left = `${dragRef.current.originX + dx}px`;
      cardRef.current.style.top = `${dragRef.current.originY + dy}px`;
    };

    const onUp = (upEvent: MouseEvent) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (!dragRef.current) return;

      const dx = upEvent.clientX - dragRef.current.startX;
      const dy = upEvent.clientY - dragRef.current.startY;
      const nextX = dragRef.current.originX + dx;
      const nextY = dragRef.current.originY + dy;
      dragRef.current = null;

      if (upEvent.clientY < TOP_BAR_HEIGHT) {
        onLayoutChange({ minimized: true, x: nextX, y: nextY });
        return;
      }

      onLayoutChange({ x: nextX, y: nextY, minimized: false });
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const startResize = (event: React.MouseEvent) => {
    if (shadow || maximized) return;
    event.preventDefault();
    event.stopPropagation();
    onBringToFront();

    resizeRef.current = {
      startY: event.clientY,
      originHeight: pane.height
    };

    const onMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current || !cardRef.current) return;
      const content = cardRef.current.querySelector<HTMLElement>(".tc-content");
      if (!content) return;
      const nextHeight = Math.max(
        MIN_PANE_HEIGHT,
        resizeRef.current.originHeight + (moveEvent.clientY - resizeRef.current.startY)
      );
      content.style.height = `${nextHeight}px`;
      cardRef.current.style.height = `${nextHeight + 40}px`;
    };

    const onUp = (upEvent: MouseEvent) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (!resizeRef.current) return;
      const nextHeight = Math.max(
        MIN_PANE_HEIGHT,
        resizeRef.current.originHeight + (upEvent.clientY - resizeRef.current.startY)
      );
      resizeRef.current = null;
      onLayoutChange({ height: nextHeight });
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const previewMode = Boolean(pane.hlMode);
  const cardStyle = shadow
    ? {
        left: pane.x,
        top: pane.y,
        width: Math.max(MIN_PANE_WIDTH, pane.width),
        height: Math.max(MIN_PANE_HEIGHT, pane.height),
        zIndex: Math.max(0, pane.zIndex - 1)
      }
    : maximized
      ? undefined
      : {
          left: pane.x,
          top: pane.y,
          width: Math.max(MIN_PANE_WIDTH, pane.width),
          height: Math.max(MIN_PANE_HEIGHT, pane.height) + 40,
          zIndex: pane.zIndex
        };

  return (
    <div
      ref={cardRef}
      className={`tc-pane ${shadow ? "tc-max-shadow" : ""} ${maximized ? "tc-maximized" : ""}`}
      style={cardStyle}
      onMouseDown={() => {
        if (!shadow) onBringToFront();
      }}
    >
      <div className="tc-titlebar" onMouseDown={startDrag}>
        <input
          ref={titleRef}
          readOnly={!titleEditing}
          className="tc-title-input"
          placeholder="标题…"
          value={pane.title}
          onBlur={() => {
            setTitleEditing(false);
          }}
          onChange={(event) => onTitleChange(event.target.value)}
          onDoubleClick={(event) => {
            if (shadow) return;
            event.stopPropagation();
            setTitleEditing(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Escape") setTitleEditing(false);
          }}
        />

        {!shadow ? (
          <div className="flex flex-none items-center gap-1" data-no-drag>
            <button
              className="tc-btn"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpenHlMenu(event.currentTarget.getBoundingClientRect());
              }}
            >
              {hlModeLabel(pane.hlMode)}
            </button>
            <button
              aria-label="切换自动换行"
              className="tc-btn"
              data-active={pane.wordWrap ? "" : undefined}
              type="button"
              onClick={() => onWordWrapChange(!pane.wordWrap)}
            >
              <AlignLeft size={14} />
            </button>
            <button
              aria-label={maximized ? "退出最大化" : "最大化"}
              className="tc-btn"
              data-active={maximized ? "" : undefined}
              type="button"
              onClick={maximized ? onRestore : onMaximize}
            >
              <ArrowsOut size={14} />
            </button>
            <button aria-label="最小化" className="tc-btn" data-minimize type="button" onClick={onMinimize}>
              <Minus size={14} />
            </button>
            <button aria-label="删除卡片" className="tc-btn tc-btn-danger" type="button" onClick={onDelete}>
              <X size={14} />
            </button>
          </div>
        ) : null}
      </div>

      <div
        className={`tc-content ${previewMode ? "tc-hl-on" : ""} ${pane.wordWrap ? "" : "tc-nowrap"}`}
        style={{ height: pane.height }}
      >
        {previewMode ? (
          <pre
            className="tc-highlight-view"
            dangerouslySetInnerHTML={{ __html: highlightContent(pane.content, pane.hlMode) }}
          />
        ) : null}
        <textarea
          className="tc-textarea"
          placeholder="在此粘贴文本 / JSON …"
          value={pane.content}
          onChange={(event) => onContentChange(event.target.value)}
        />
      </div>

      {!shadow && !maximized ? <div className="tc-resize-handle" onMouseDown={startResize} /> : null}
    </div>
  );
}
