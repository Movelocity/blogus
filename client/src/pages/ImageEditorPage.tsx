import { ArrowClockwise, ArrowCounterClockwise, ArrowLeft, ArrowsOut, DownloadSimple, ImageSquare, LinkSimple, LinkSimpleBreak, Minus, Plus, UploadSimple } from "@phosphor-icons/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { CANVAS_GUTTER, EditorCanvas } from "../components/image-editor/EditorCanvas";
import { cropLayer, exportName, formatBytes, renderLayer } from "../features/image-editor/exportImage";
import { fitZoom } from "../features/image-editor/geometry";
import { clipboardImageFiles, filesToLayers } from "../features/image-editor/imageFiles";
import { useEditorHistory } from "../features/image-editor/hooks/useEditorHistory";
import type { CropSelection, ExportPreferences, ImageFormat, ImageLayer } from "../features/image-editor/types";

const PREF_KEY = "blogus:image-editor:prefs";
const MIN_ZOOM = .1;
const MAX_ZOOM = 4;
const WHEEL_ZOOM_SENSITIVITY = .0006;
const readPrefs = (): ExportPreferences => { try { return { format: "png", quality: .9, aspectLocked: true, ...JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}") }; } catch { return { format: "png", quality: .9, aspectLocked: true }; } };

export function ImageEditorPage() {
  const { document: editorDocument, dispatch, undo, redo, canUndo, canRedo } = useEditorHistory();
  const [zoom, setZoom] = useState(1); const [prefs, setPrefs] = useState(readPrefs);
  const [exportWidth, setExportWidth] = useState(0); const [exportHeight, setExportHeight] = useState(0);
  const [estimate, setEstimate] = useState<Blob | null>(null); const [dragging, setDragging] = useState(false); const [panelOpen, setPanelOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null); const viewport = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom); const zoomFrame = useRef<number | null>(null);
  const wheelDelta = useRef(0); const wheelPoint = useRef({ x: 0, y: 0 });
  const zoomAnchor = useRef<{ x: number; y: number; worldX: number; worldY: number } | null>(null);
  const viewportReady = useRef(false);
  const selected = editorDocument.layers.find((item) => item.id === editorDocument.selectedId) ?? null;
  useEffect(() => localStorage.setItem(PREF_KEY, JSON.stringify(prefs)), [prefs]);
  useEffect(() => { if (selected) { setExportWidth(Math.round(selected.width)); setExportHeight(Math.round(selected.height)); } }, [selected?.id]);

  const addFiles = useCallback(async (files: File[]) => { const layers = await filesToLayers(files, editorDocument.layers.length); if (layers.length) dispatch({ type: "add", layers }); }, [dispatch, editorDocument.layers.length]);
  useEffect(() => { const paste = (event: ClipboardEvent) => { const files = clipboardImageFiles(event); if (files.length) void addFiles(files); }; document.addEventListener("paste", paste); return () => document.removeEventListener("paste", paste); }, [addFiles]);
  useEffect(() => { const key = (event: KeyboardEvent) => {
    if (event.code === "Space" && !(event.target as HTMLElement).closest("input,select,textarea,button,[contenteditable='true']")) { event.preventDefault(); return; }
    if ((event.target as HTMLElement).matches("input,select,textarea")) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); return; }
    if (!selected) return;
    if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); dispatch({ type: "remove", id: selected.id }); return; }
    const amount = event.shiftKey ? 10 : 1; const moves: Record<string, [number, number]> = { ArrowLeft: [-amount, 0], ArrowRight: [amount, 0], ArrowUp: [0, -amount], ArrowDown: [0, amount] };
    if (moves[event.key]) { event.preventDefault(); const [x, y] = moves[event.key]; dispatch({ type: "geometry", id: selected.id, rect: { x: selected.x + x, y: selected.y + y, width: selected.width, height: selected.height } }); }
  }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, [dispatch, redo, selected, undo]);

  useEffect(() => { if (!selected || !exportWidth || !exportHeight) { setEstimate(null); return; } const timer = setTimeout(() => { void renderLayer(selected, exportWidth, exportHeight, prefs.format, prefs.quality).then(setEstimate); }, 300); return () => clearTimeout(timer); }, [selected, exportWidth, exportHeight, prefs]);
  const filename = selected ? exportName(selected.name, exportWidth, exportHeight, prefs.format) : "";
  const updateWidth = (value: number) => { setExportWidth(value); if (selected && prefs.aspectLocked) setExportHeight(Math.max(1, Math.round(value / (selected.width / selected.height)))); };
  const updateHeight = (value: number) => { setExportHeight(value); if (selected && prefs.aspectLocked) setExportWidth(Math.max(1, Math.round(value * (selected.width / selected.height)))); };
  const download = async () => { if (!selected) return; const blob = await renderLayer(selected, exportWidth, exportHeight, prefs.format, prefs.quality); const url = URL.createObjectURL(blob); const anchor = Object.assign(document.createElement("a"), { href: url, download: filename }); anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const crop = async (layer: ImageLayer, selection: CropSelection) => { dispatch({ type: "replace", id: layer.id, layer: await cropLayer(layer, selection) }); };
  const setZoomAt = useCallback((next: number, clientX?: number, clientY?: number) => {
    const element = viewport.current; if (!element) return;
    const value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    const previous = zoomRef.current; if (value === previous) return;
    const rect = element.getBoundingClientRect();
    const x = clientX === undefined ? element.clientWidth / 2 : clientX - rect.left;
    const y = clientY === undefined ? element.clientHeight / 2 : clientY - rect.top;
    const canvas = element.querySelector<HTMLElement>("[data-canvas]");
    const originX = canvas?.offsetLeft ?? CANVAS_GUTTER, originY = canvas?.offsetTop ?? CANVAS_GUTTER;
    zoomAnchor.current = { x, y, worldX: (element.scrollLeft + x - originX) / previous, worldY: (element.scrollTop + y - originY) / previous };
    zoomRef.current = value; setZoom(value);
  }, []);
  useLayoutEffect(() => {
    const element = viewport.current, anchor = zoomAnchor.current; if (!element || !anchor) return;
    const canvas = element.querySelector<HTMLElement>("[data-canvas]");
    const originX = canvas?.offsetLeft ?? CANVAS_GUTTER, originY = canvas?.offsetTop ?? CANVAS_GUTTER;
    element.scrollLeft = originX + anchor.worldX * zoom - anchor.x; element.scrollTop = originY + anchor.worldY * zoom - anchor.y;
    zoomAnchor.current = null;
  }, [zoom]);
  useLayoutEffect(() => {
    const element = viewport.current; if (!element || viewportReady.current) return;
    element.scrollLeft = CANVAS_GUTTER; element.scrollTop = CANVAS_GUTTER;
    viewportReady.current = true;
  }, []);
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      wheelDelta.current += event.deltaY; wheelPoint.current = { x: event.clientX, y: event.clientY };
      if (zoomFrame.current !== null) return;
      zoomFrame.current = requestAnimationFrame(() => {
        const delta = wheelDelta.current, point = wheelPoint.current;
        zoomFrame.current = null; wheelDelta.current = 0;
        setZoomAt(zoomRef.current * Math.exp(-delta * WHEEL_ZOOM_SENSITIVITY), point.x, point.y);
      });
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => { element.removeEventListener("wheel", wheel); if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current); };
  }, [setZoomAt]);
  const panCanvas = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-layer],button,input")) return;
    const element = viewport.current; if (!element) return;
    event.preventDefault();
    const startX = event.clientX, startY = event.clientY, left = element.scrollLeft, top = element.scrollTop;
    element.style.cursor = "grabbing";
    const move = (pointer: PointerEvent) => { element.scrollLeft = left - (pointer.clientX - startX); element.scrollTop = top - (pointer.clientY - startY); };
    const end = () => { element.style.cursor = "grab"; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end, { once: true });
  };
  const fit = () => { const el = viewport.current; if (el) setZoomAt(fitZoom(editorDocument.layers, { width: el.clientWidth, height: el.clientHeight })); };
  const formats: ImageFormat[] = ["png", "jpeg", "webp", "ico"];

  const panel = <aside className="flex w-full shrink-0 flex-col gap-5 border-border bg-sidebar p-4 md:w-72 md:border-l md:p-5">
    <section><h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">选中图片</h2>{selected ? <div className="text-sm"><p className="truncate font-medium">{selected.name}</p><p className="mt-1 text-xs text-muted-foreground">{selected.naturalWidth} × {selected.naturalHeight} · {formatBytes(selected.bytes)}</p></div> : <p className="text-sm text-muted-foreground">在画布中选择一张图片</p>}</section>
    <section className="space-y-3"><h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">导出尺寸</h2><div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2"><label className="text-xs text-muted-foreground">宽<input aria-label="导出宽度" type="number" min="1" value={exportWidth || ""} onChange={e => updateWidth(Number(e.target.value))} className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-foreground" /></label><button title="锁定宽高比" aria-label="锁定宽高比" onClick={() => setPrefs(p => ({ ...p, aspectLocked: !p.aspectLocked }))} className="mb-1 rounded p-2 hover:bg-muted">{prefs.aspectLocked ? <LinkSimple /> : <LinkSimpleBreak />}</button><label className="text-xs text-muted-foreground">高<input aria-label="导出高度" type="number" min="1" value={exportHeight || ""} onChange={e => updateHeight(Number(e.target.value))} className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-foreground" /></label></div></section>
    <section className="space-y-3"><h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">格式</h2><div className="grid grid-cols-4 gap-1">{formats.map(format => <button key={format} onClick={() => setPrefs(p => ({ ...p, format }))} className={`rounded-md border px-2 py-2 text-xs uppercase ${prefs.format === format ? "border-accent bg-accent text-accent-foreground" : "bg-background hover:bg-muted"}`}>{format}</button>)}</div>{(prefs.format === "jpeg" || prefs.format === "webp") && <label className="block text-xs text-muted-foreground">质量 {Math.round(prefs.quality * 100)}%<input aria-label="导出质量" className="range-muted mt-2 w-full" type="range" min=".1" max="1" step=".01" value={prefs.quality} onChange={e => setPrefs(p => ({ ...p, quality: Number(e.target.value) }))} /></label>}</section>
    <section className="min-w-0 text-xs text-muted-foreground"><p className="truncate text-foreground" title={filename}>{filename || "尚未选择图片"}</p><p className="mt-1">{estimate ? `预计 ${formatBytes(estimate.size)}` : "等待体积预估"}</p>{prefs.format === "ico" && exportWidth > 256 && <p className="mt-2 text-accent">ICO 建议不超过 256 × 256</p>}</section>
    <button disabled={!selected || !exportWidth || !exportHeight} onClick={() => void download()} className="btn-primary h-11 gap-2 disabled:opacity-40"><DownloadSimple size={19} />导出图片</button>
  </aside>;

  return <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
    <header className="flex h-14 shrink-0 items-center gap-1 border-b px-2 md:gap-2 md:px-5"><Link to="/" aria-label="返回首页" className="rounded p-2 hover:bg-muted"><ArrowLeft size={20} /></Link><h1 className="mr-auto truncate text-sm font-semibold">图片编辑器</h1><button title="撤销" disabled={!canUndo} onClick={undo} className="rounded p-2 hover:bg-muted disabled:opacity-30"><ArrowCounterClockwise /></button><button title="重做" disabled={!canRedo} onClick={redo} className="rounded p-2 hover:bg-muted disabled:opacity-30"><ArrowClockwise /></button><button onClick={() => input.current?.click()} className="btn-primary h-9 gap-2 px-2.5 md:px-3"><UploadSimple /><span className="hidden sm:inline">导入</span></button><button onClick={() => setPanelOpen(v => !v)} className="rounded border p-2 md:hidden" aria-label="导出设置"><DownloadSimple /></button><input ref={input} hidden multiple type="file" accept="image/*" onChange={e => { if (e.target.files) void addFiles(Array.from(e.target.files)); e.target.value = ""; }} /></header>
    <div className="relative flex min-h-0 flex-1 md:flex-row"><main className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-muted/35"><div className="absolute left-1/2 top-3 z-40 flex -translate-x-1/2 items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-sm backdrop-blur"><button aria-label="缩小" onClick={() => setZoomAt(zoomRef.current / 1.2)} className="rounded p-1.5 hover:bg-muted"><Minus /></button><button title="重置缩放" onClick={() => setZoomAt(1)} className="min-w-14 rounded px-2 py-1 text-xs hover:bg-muted">{Math.round(zoom * 100)}%</button><button aria-label="放大" onClick={() => setZoomAt(zoomRef.current * 1.2)} className="rounded p-1.5 hover:bg-muted"><Plus /></button><button title="适应全部" onClick={fit} className="rounded p-1.5 hover:bg-muted"><ArrowsOut /></button></div>
      <div ref={viewport} className="absolute inset-0 cursor-grab overflow-auto overscroll-contain" onPointerDown={panCanvas} onDragEnter={e => { e.preventDefault(); setDragging(true); }} onDragOver={e => e.preventDefault()} onDragLeave={e => { if (e.currentTarget === e.target) setDragging(false); }} onDrop={e => { e.preventDefault(); setDragging(false); void addFiles(Array.from(e.dataTransfer.files)); }}>
        <EditorCanvas document={editorDocument} zoom={zoom} aspectLocked={prefs.aspectLocked} dispatch={dispatch} onCrop={crop} />
      </div>
      {!editorDocument.layers.length && <button onClick={() => input.current?.click()} className="absolute inset-0 z-30 m-auto flex h-40 w-[min(86%,22rem)] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-background/85 text-muted-foreground backdrop-blur-sm hover:border-accent hover:text-foreground"><ImageSquare size={36} weight="thin" /><span className="font-medium text-foreground">拖入图片或点击导入</span></button>}
      {dragging && <div className="pointer-events-none absolute inset-3 z-40 grid place-items-center rounded-xl border-2 border-dashed border-accent bg-background/90 text-sm font-medium">松开以导入图片</div>}</main>
      <div className={`${panelOpen ? "absolute inset-x-0 bottom-0 z-50 block max-h-[62dvh]" : "hidden"} overflow-auto border-t shadow-[0_-12px_32px_rgba(0,0,0,.14)] md:static md:z-auto md:block md:max-h-none md:shadow-none`}>{panel}</div></div>
  </div>;
}
