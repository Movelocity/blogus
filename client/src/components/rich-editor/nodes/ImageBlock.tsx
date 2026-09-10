import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey, type NodeKey } from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import { $isImageNode } from "./ImageNode";

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const HANDLES: { id: ResizeHandle; className: string }[] = [
  { id: "nw", className: "re-image-handle--nw" },
  { id: "n", className: "re-image-handle--n" },
  { id: "ne", className: "re-image-handle--ne" },
  { id: "w", className: "re-image-handle--w" },
  { id: "e", className: "re-image-handle--e" },
  { id: "sw", className: "re-image-handle--sw" },
  { id: "s", className: "re-image-handle--s" },
  { id: "se", className: "re-image-handle--se" },
];

const MIN_WIDTH = 64;

function isResizeHandle(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(".re-image-handle") !== null;
}

function clampWidth(width: number, maxWidth: number): number {
  return Math.max(MIN_WIDTH, Math.min(maxWidth, Math.round(width)));
}

function widthFromDrag(
  handle: ResizeHandle,
  startWidth: number,
  aspectRatio: number,
  dx: number,
  dy: number,
): number {
  switch (handle) {
    case "e":
      return startWidth + dx;
    case "w":
      return startWidth - dx;
    case "s":
      return startWidth + dy * aspectRatio;
    case "n":
      return startWidth - dy * aspectRatio;
    case "se":
    case "ne":
      return startWidth + dx;
    case "sw":
    case "nw":
      return startWidth - dx;
    default:
      return startWidth;
  }
}

function getMaxWidth(frame: HTMLElement | null): number {
  const editorRoot = frame?.closest(".re-editor-root");
  if (editorRoot instanceof HTMLElement) {
    return editorRoot.clientWidth;
  }
  return frame?.parentElement?.clientWidth ?? 768;
}

function imageSizeStyle(width: number | undefined) {
  if (width == null) return undefined;
  const px = `${width}px`;
  return { width: px, maxWidth: px };
}

export function ImageBlock({
  nodeKey,
  src,
  alt,
  width,
}: {
  nodeKey: NodeKey;
  src: string;
  alt?: string;
  width?: number;
}) {
  const [editor] = useLexicalComposerContext();
  const [selected, setSelected] = useState(false);
  const [savedWidth, setSavedWidth] = useState(width);
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const isResizing = liveWidth !== null;
  const displayWidth = liveWidth ?? savedWidth;

  useEffect(() => {
    if (width !== undefined) {
      setSavedWidth(width);
    }
  }, [width]);

  const commitWidth = useCallback(
    (nextWidth: number) => {
      setSavedWidth(nextWidth);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isImageNode(node)) {
          node.setWidth(nextWidth);
        }
      });
    },
    [editor, nodeKey],
  );

  const selectImage = useCallback(
    (event: React.PointerEvent) => {
      if (isResizing || isResizeHandle(event.target)) return;
      if (event.button !== 0) return;
      event.stopPropagation();
      setSelected(true);
    },
    [isResizing],
  );

  const startResize = useCallback(
    (handle: ResizeHandle) => (event: React.PointerEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const image = imageRef.current;
      const frame = frameRef.current;
      if (!image || !frame) return;

      setSelected(true);

      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = image.offsetWidth;
      const startHeight = image.offsetHeight;
      const aspectRatio = startWidth / Math.max(startHeight, 1);
      const maxWidth = getMaxWidth(frame);

      const onMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        setLiveWidth(clampWidth(widthFromDrag(handle, startWidth, aspectRatio, dx, dy), maxWidth));
      };

      const handleEl = event.currentTarget;

      const onEnd = (endEvent: PointerEvent) => {
        handleEl.releasePointerCapture(endEvent.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);
        document.body.style.removeProperty("user-select");

        const finalWidth = clampWidth(
          widthFromDrag(
            handle,
            startWidth,
            aspectRatio,
            endEvent.clientX - startX,
            endEvent.clientY - startY,
          ),
          maxWidth,
        );
        setLiveWidth(null);
        commitWidth(finalWidth);
      };

      handleEl.setPointerCapture(event.pointerId);
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onEnd);
      window.addEventListener("pointercancel", onEnd);
    },
    [commitWidth],
  );

  useEffect(() => {
    if (!selected || isResizing) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (frameRef.current?.contains(target)) return;
      setSelected(false);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [isResizing, selected]);

  return (
    <figure className="re-image-block" contentEditable={false}>
      <div
        ref={frameRef}
        className={`re-image-frame${selected ? " re-image-frame--selected" : ""}${isResizing ? " re-image-frame--resizing" : ""}`}
        onPointerDownCapture={selectImage}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt ?? ""}
          draggable={false}
          style={imageSizeStyle(displayWidth)}
        />
        {selected && (
          <div className="re-image-resizer" aria-hidden="true">
            {HANDLES.map((handle) => (
              <span
                key={handle.id}
                className={`re-image-handle ${handle.className}`}
                onPointerDown={startResize(handle.id)}
              />
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}
