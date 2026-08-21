import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { SpinnerIcon } from "@phosphor-icons/react";
import {
  canvasSupportsMime,
  coverCropRect,
  encodeImage,
  extForMime,
  formatBytes,
  loadImageFile,
  mimeForFormat,
  replaceExt,
  type ImageCrop,
  type ImageFormatId,
} from "../../lib/imageConvert";

type PreviewState = {
  image: HTMLImageElement;
  objectUrl: string;
  width: number;
  height: number;
};

const FORMAT_OPTIONS: { id: ImageFormatId; label: string }[] = [
  { id: "original", label: "原图" },
  { id: "webp", label: "WebP" },
  { id: "jpeg", label: "JPG" },
  { id: "png", label: "PNG" },
];

function CropPreview({
  src,
  naturalWidth,
  naturalHeight,
  aspect,
  zoom,
  panX,
  panY,
  onPanChange,
}: {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  aspect: number;
  zoom: number;
  panX: number;
  panY: number;
  onPanChange: (panX: number, panY: number) => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const crop = coverCropRect(naturalWidth, naturalHeight, aspect, zoom, panX, panY);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, panX, panY };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const el = viewportRef.current;
    if (!drag || !el) return;
    const rect = el.getBoundingClientRect();
    const rangeX = naturalWidth - crop.width;
    const rangeY = naturalHeight - crop.height;
    const nextPanX = rangeX <= 0 ? 0.5 : Math.min(1, Math.max(0, drag.panX - ((e.clientX - drag.x) / rect.width) * (crop.width / rangeX)));
    const nextPanY = rangeY <= 0 ? 0.5 : Math.min(1, Math.max(0, drag.panY - ((e.clientY - drag.y) / rect.height) * (crop.height / rangeY)));
    onPanChange(nextPanX, nextPanY);
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  return (
    <div
      ref={viewportRef}
        className="relative cursor-grab touch-none overflow-hidden rounded-lg border border-border bg-muted/40 active:cursor-grabbing"
      style={{ aspectRatio: String(aspect) }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        className="absolute max-w-none select-none"
        style={{
          width: `${(naturalWidth / crop.width) * 100}%`,
          height: `${(naturalHeight / crop.height) * 100}%`,
          left: `${(-crop.x / crop.width) * 100}%`,
          top: `${(-crop.y / crop.height) * 100}%`,
        }}
      />
    </div>
  );
}

export function ImagePrepareDialog({
  file,
  onClose,
  onInsert,
  cropAspect,
  confirmLabel = "插入",
  hint,
}: {
  file: File;
  onClose: () => void;
  onInsert: (output: File) => Promise<void>;
  /** 若设置，预览区按该宽高比裁剪构图 */
  cropAspect?: number;
  confirmLabel?: string;
  hint?: string;
}) {
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [format, setFormat] = useState<ImageFormatId>("webp");
  const [scale, setScale] = useState(100);
  const [quality, setQuality] = useState(82);
  const [cropZoom, setCropZoom] = useState(1);
  const [panX, setPanX] = useState(0.5);
  const [panY, setPanY] = useState(0.5);
  const [expectedBytes, setExpectedBytes] = useState<number | null>(null);
  const [encoding, setEncoding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const supportsWebp = useMemo(() => canvasSupportsMime("image/webp"), []);
  const scaleRatio = scale / 100;
  const crop = useMemo((): ImageCrop | undefined => {
    if (!preview || !cropAspect) return undefined;
    return coverCropRect(preview.width, preview.height, cropAspect, cropZoom, panX, panY);
  }, [preview, cropAspect, cropZoom, panX, panY]);
  const outWidth = preview
    ? Math.max(1, Math.round((crop?.width ?? preview.width) * scaleRatio))
    : 0;
  const outHeight = preview
    ? Math.max(1, Math.round((crop?.height ?? preview.height) * scaleRatio))
    : 0;
  const mustReencode = Boolean(crop);
  const needsQuality = format === "webp" || format === "jpeg" || (format === "original" && (file.type === "image/jpeg" || file.type === "image/webp") && (scale < 100 || mustReencode));

  useEffect(() => {
    if (!supportsWebp && format === "webp") setFormat("jpeg");
  }, [supportsWebp, format]);

  useEffect(() => {
    let revoked = false;
    const objectUrl = URL.createObjectURL(file);
    void loadImageFile(file)
      .then((image) => {
        if (revoked) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setPreview({
          image,
          objectUrl,
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      })
      .catch((e) => {
        URL.revokeObjectURL(objectUrl);
        setLoadError(e instanceof Error ? e.message : "无法读取图片");
      });
    return () => {
      revoked = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  useEffect(() => {
    if (!preview) return;
    let cancelled = false;
    if (!mustReencode && format === "original" && scale === 100) {
      setExpectedBytes(file.size);
      setEncoding(false);
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        setEncoding(true);
        try {
          const mime = mimeForFormat(format, file.type);
          if (mime === "original") {
            if (!cancelled) setExpectedBytes(file.size);
            return;
          }
          const blob = await encodeImage({
            image: preview.image,
            scale: scaleRatio,
            mime,
            quality: quality / 100,
            crop,
          });
          if (!cancelled) setExpectedBytes(blob.size);
        } catch {
          if (!cancelled) setExpectedBytes(null);
        } finally {
          if (!cancelled) setEncoding(false);
        }
      })();
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [preview, format, scale, quality, file, scaleRatio, mustReencode, crop]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !uploading) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, uploading]);

  async function buildOutput(): Promise<File> {
    if (!preview) throw new Error("图片尚未就绪");
    const mime = mimeForFormat(format, file.type);
    if (!mustReencode && (mime === "original" || (format === "original" && scale === 100))) {
      return file;
    }
    if (mime === "original") throw new Error("当前格式无法裁剪，请改选 WebP / JPG / PNG");
    const blob = await encodeImage({
      image: preview.image,
      scale: scaleRatio,
      mime,
      quality: quality / 100,
      crop,
    });
    return new File([blob], replaceExt(file.name, extForMime(blob.type || mime)), {
      type: blob.type || mime,
    });
  }

  async function handleInsert() {
    setActionError(null);
    setUploading(true);
    try {
      const output = await buildOutput();
      await onInsert(output);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  const typeLabel = file.type || "未知类型";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/10 p-3 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !uploading) onClose();
      }}
      onTouchStart={(e) => {
        if (e.target === e.currentTarget && !uploading) onClose();
      }}
      role="presentation"
    >
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-background p-4 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-label={cropAspect ? "处理封面" : "处理图片"}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : (
          <>
            {cropAspect ? (
              preview ? (
                <CropPreview
                  src={preview.objectUrl}
                  naturalWidth={preview.width}
                  naturalHeight={preview.height}
                  aspect={cropAspect}
                  zoom={cropZoom}
                  panX={panX}
                  panY={panY}
                  onPanChange={(x, y) => {
                    setPanX(x);
                    setPanY(y);
                  }}
                />
              ) : (
                <div
                  className="flex items-center justify-center rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground"
                  style={{ aspectRatio: String(cropAspect) }}
                >
                  读取中…
                </div>
              )
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
                {preview ? (
                  <img src={preview.objectUrl} alt="" className="mx-auto max-h-48 w-auto object-contain" />
                ) : (
                  <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">读取中…</div>
                )}
              </div>
            )}
            {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-muted-foreground sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground/70">尺寸</dt>
                <dd className="font-mono text-foreground">
                  {preview
                    ? crop
                      ? `${Math.round(crop.width)} × ${Math.round(crop.height)}`
                      : `${preview.width} × ${preview.height}`
                    : "…"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground/70">文件大小</dt>
                <dd className="font-mono text-foreground">{formatBytes(file.size)}</dd>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-xs text-muted-foreground/70">类型</dt>
                <dd className="truncate font-mono text-foreground" title={typeLabel}>
                  {typeLabel}
                </dd>
              </div>
            </dl>

            <fieldset className="mt-4">
              <legend className="mb-1.5 text-xs text-muted-foreground">格式</legend>
              <div className="grid grid-cols-4 gap-1.5">
                {FORMAT_OPTIONS.map((opt) => {
                  const disabled = opt.id === "webp" && !supportsWebp;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => setFormat(opt.id)}
                      className={
                        format === opt.id
                          ? "btn-primary h-9 px-0"
                          : "h-9 rounded-lg border border-border text-sm text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {cropAspect ? (
              <label className="mt-4 block">
                <span className="flex items-center justify-between text-xs text-muted-foreground">
                  构图缩放
                  <span className="font-mono text-foreground">{Math.round(cropZoom * 100)}%</span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={cropZoom}
                  onChange={(e) => setCropZoom(Number(e.target.value))}
                  className="range-muted mt-2 w-full"
                />
              </label>
            ) : null}

            <label className="mt-4 block">
              <span className="flex items-center justify-between text-xs text-muted-foreground">
                等比例缩放
                <span className="font-mono text-foreground">
                  {scale}%{preview ? ` · ${outWidth} × ${outHeight}` : ""}
                </span>
              </span>
              <input
                type="range"
                min={10}
                max={100}
                step={1}
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="range-muted mt-2 w-full"
              />
            </label>

            {needsQuality ? (
              <label className="mt-3 block">
                <span className="flex items-center justify-between text-xs text-muted-foreground">
                  画质
                  <span className="font-mono text-foreground">{quality}%</span>
                </span>
                <input
                  type="range"
                  min={40}
                  max={100}
                  step={1}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="range-muted mt-2 w-full"
                />
              </label>
            ) : null}

            <p className="mt-4 text-sm text-muted-foreground">
              转换后约{" "}
              <span className="font-mono text-foreground">
                {encoding || expectedBytes == null ? "计算中…" : formatBytes(expectedBytes)}
              </span>
            </p>
            {actionError ? <p className="mt-2 text-sm text-destructive">{actionError}</p> : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="h-10 flex-1 rounded-md border border-border text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleInsert()}
                disabled={!preview || uploading}
                className="btn-primary h-10 flex-1 gap-1.5"
              >
                {uploading ? <SpinnerIcon size={16} className="animate-spin" /> : null}
                {uploading ? "上传中" : confirmLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
