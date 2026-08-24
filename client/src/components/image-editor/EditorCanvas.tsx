import { Check, Copy, Crop, Trash, X } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { clamp } from "../../features/image-editor/geometry";
import type { EditorAction } from "../../features/image-editor/reducer";
import type { CropSelection, EditorDocument, ImageLayer, Rect } from "../../features/image-editor/types";

interface Props {
  document: EditorDocument;
  zoom: number;
  aspectLocked: boolean;
  dispatch: (action: EditorAction, historical?: boolean) => void;
  onCrop: (layer: ImageLayer, crop: CropSelection) => Promise<void>;
}
type Corner = "nw" | "ne" | "sw" | "se";
const corners: Corner[] = ["nw", "ne", "sw", "se"];
const cornerClass: Record<Corner, string> = {
  nw: "-left-2.5 -top-2.5 cursor-nwse-resize", ne: "-right-2.5 -top-2.5 cursor-nesw-resize",
  sw: "-bottom-2.5 -left-2.5 cursor-nesw-resize", se: "-bottom-2.5 -right-2.5 cursor-nwse-resize",
};

export function EditorCanvas({ document, zoom, aspectLocked, dispatch, onCrop }: Props) {
  const frame = useRef<number | null>(null);
  const [crop, setCrop] = useState<{ layerId: string; rect: CropSelection } | null>(null);
  const schedule = (work: () => void) => { if (frame.current) cancelAnimationFrame(frame.current); frame.current = requestAnimationFrame(work); };

  const moveLayer = (event: React.PointerEvent, layer: ImageLayer) => {
    if (crop) return;
    event.preventDefault(); event.stopPropagation(); dispatch({ type: "select", id: layer.id }, false);
    const target = event.currentTarget.closest<HTMLElement>("[data-layer]")!;
    const startX = event.clientX, startY = event.clientY; let next: Rect = layer;
    const move = (pointer: PointerEvent) => {
      next = { x: Math.max(0, layer.x + (pointer.clientX - startX) / zoom), y: Math.max(0, layer.y + (pointer.clientY - startY) / zoom), width: layer.width, height: layer.height };
      schedule(() => { target.style.transform = `translate(${next.x * zoom}px, ${next.y * zoom}px)`; });
    };
    const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); dispatch({ type: "geometry", id: layer.id, rect: next }); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end, { once: true });
  };

  const resizeLayer = (event: React.PointerEvent, layer: ImageLayer, corner: Corner) => {
    event.preventDefault(); event.stopPropagation();
    const target = event.currentTarget.closest<HTMLElement>("[data-layer]")!;
    const startX = event.clientX, startY = event.clientY;
    const before: Rect = { x: layer.x, y: layer.y, width: layer.width, height: layer.height }; let next = before;
    const move = (pointer: PointerEvent) => {
      const dx = (pointer.clientX - startX) / zoom, dy = (pointer.clientY - startY) / zoom;
      const east = corner.includes("e"), south = corner.includes("s");
      let width = Math.max(40, before.width + (east ? dx : -dx)); let height = Math.max(40, before.height + (south ? dy : -dy));
      if (aspectLocked) { const aspect = before.width / before.height; if (Math.abs(dx) >= Math.abs(dy)) height = width / aspect; else width = height * aspect; }
      next = { x: Math.max(0, east ? before.x : before.x + before.width - width), y: Math.max(0, south ? before.y : before.y + before.height - height), width, height };
      schedule(() => { target.style.transform = `translate(${next.x * zoom}px, ${next.y * zoom}px)`; target.style.width = `${next.width * zoom}px`; target.style.height = `${next.height * zoom}px`; });
    };
    const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); dispatch({ type: "geometry", id: layer.id, rect: next }); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end, { once: true });
  };

  const cropGesture = (event: React.PointerEvent, layer: ImageLayer, kind: "move" | Corner) => {
    if (!crop || crop.layerId !== layer.id) return;
    event.preventDefault(); event.stopPropagation();
    const before = crop.rect, startX = event.clientX, startY = event.clientY;
    const move = (pointer: PointerEvent) => {
      const dx = (pointer.clientX - startX) / zoom, dy = (pointer.clientY - startY) / zoom; let rect = before;
      if (kind === "move") rect = { ...before, x: clamp(before.x + dx, 0, layer.width - before.width), y: clamp(before.y + dy, 0, layer.height - before.height) };
      else {
        const east = kind.includes("e"), south = kind.includes("s");
        const x = east ? before.x : clamp(before.x + dx, 0, before.x + before.width - 24);
        const y = south ? before.y : clamp(before.y + dy, 0, before.y + before.height - 24);
        const right = east ? clamp(before.x + before.width + dx, before.x + 24, layer.width) : before.x + before.width;
        const bottom = south ? clamp(before.y + before.height + dy, before.y + 24, layer.height) : before.y + before.height;
        rect = { x, y, width: right - x, height: bottom - y };
      }
      setCrop({ layerId: layer.id, rect });
    };
    const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end, { once: true });
  };

  return <div className="relative min-h-full min-w-full" style={{ width: 1800 * zoom, height: 1200 * zoom }} onPointerDown={(e) => { if (e.target === e.currentTarget && !crop) dispatch({ type: "select", id: null }, false); }}>
    {document.layers.map((layer) => {
      const selected = layer.id === document.selectedId, cropping = crop?.layerId === layer.id;
      return <div key={layer.id} data-layer className={`absolute touch-none select-none ${selected ? "ring-2 ring-accent" : "hover:ring-1 hover:ring-foreground/30"}`} style={{ transform: `translate(${layer.x * zoom}px, ${layer.y * zoom}px)`, width: layer.width * zoom, height: layer.height * zoom, zIndex: layer.z }} onPointerDown={(event) => moveLayer(event, layer)}>
        <img src={layer.src} alt={layer.name} draggable={false} className="pointer-events-none h-full w-full object-fill" />
        {selected && !cropping && <>
          <div className="absolute -top-11 left-0 flex gap-1 rounded-lg border bg-background/95 p-1 shadow-lg backdrop-blur">
            <button aria-label="裁剪" className="rounded p-1.5 hover:bg-muted" onPointerDown={(e) => e.stopPropagation()} onClick={() => setCrop({ layerId: layer.id, rect: { x: layer.width * .1, y: layer.height * .1, width: layer.width * .8, height: layer.height * .8 } })}><Crop size={17} /></button>
            <button aria-label="复制" className="rounded p-1.5 hover:bg-muted" onPointerDown={(e) => e.stopPropagation()} onClick={() => dispatch({ type: "duplicate", id: layer.id })}><Copy size={17} /></button>
            <button aria-label="删除" className="rounded p-1.5 text-destructive hover:bg-destructive/10" onPointerDown={(e) => e.stopPropagation()} onClick={() => dispatch({ type: "remove", id: layer.id })}><Trash size={17} /></button>
          </div>
          {corners.map((corner) => <button key={corner} aria-label={`从 ${corner} 缩放图片`} className={`absolute h-5 w-5 rounded-sm border-2 border-background bg-accent ${cornerClass[corner]}`} onPointerDown={(event) => resizeLayer(event, layer, corner)} />)}
        </>}
        {cropping && <div className="absolute inset-0 bg-black/55" onPointerDown={(e) => e.stopPropagation()}>
          <div className="absolute cursor-move border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.55)]" style={{ left: crop.rect.x * zoom, top: crop.rect.y * zoom, width: crop.rect.width * zoom, height: crop.rect.height * zoom, backgroundImage: `url(${layer.src})`, backgroundSize: `${layer.width * zoom}px ${layer.height * zoom}px`, backgroundPosition: `${-crop.rect.x * zoom}px ${-crop.rect.y * zoom}px` }} onPointerDown={(event) => cropGesture(event, layer, "move")}>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_33%,rgba(255,255,255,.6)_33%,rgba(255,255,255,.6)_33.5%,transparent_33.5%,transparent_66%,rgba(255,255,255,.6)_66%,rgba(255,255,255,.6)_66.5%,transparent_66.5%),linear-gradient(to_bottom,transparent_33%,rgba(255,255,255,.6)_33%,rgba(255,255,255,.6)_33.5%,transparent_33.5%,transparent_66%,rgba(255,255,255,.6)_66%,rgba(255,255,255,.6)_66.5%,transparent_66.5%)]" />
            {corners.map((corner) => <button key={corner} aria-label={`调整裁剪区域 ${corner}`} className={`absolute h-5 w-5 rounded-sm border-2 border-black bg-white ${cornerClass[corner]}`} onPointerDown={(event) => cropGesture(event, layer, corner)} />)}
          </div>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border bg-background/95 p-1.5 text-foreground shadow-lg">
            <span className="px-2 text-xs tabular-nums">{Math.round(crop.rect.width)} × {Math.round(crop.rect.height)}</span>
            <button aria-label="取消裁剪" className="rounded p-2 hover:bg-muted" onPointerDown={(e) => e.stopPropagation()} onClick={() => setCrop(null)}><X /></button>
            <button aria-label="确认裁剪" className="rounded bg-accent p-2 text-accent-foreground" onPointerDown={(e) => e.stopPropagation()} onClick={async () => { await onCrop(layer, crop.rect); setCrop(null); }}><Check /></button>
          </div>
        </div>}
      </div>;
    })}
  </div>;
}
