export type ConvertMime = "image/webp" | "image/jpeg" | "image/png";

export type ImageFormatId = "original" | "webp" | "jpeg" | "png";

const MIME_BY_FORMAT: Record<Exclude<ImageFormatId, "original">, ConvertMime> = {
  webp: "image/webp",
  jpeg: "image/jpeg",
  png: "image/png",
};

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function extForMime(mime: string) {
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  const sub = mime.split("/")[1];
  return sub?.split("+")[0] || "img";
}

export function replaceExt(filename: string, ext: string) {
  const base = filename.replace(/\.[^.]+$/, "");
  return `${base || "image"}.${ext}`;
}

export function canvasSupportsMime(mime: ConvertMime) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL(mime).startsWith(`data:${mime}`);
  } catch {
    return false;
  }
}

export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取该图片"));
    };
    img.src = url;
  });
}

/** 文章封面推荐比例，与前台 `aspect-video` 展示一致 */
export const COVER_CROP_ASPECT = 16 / 9;

export type ImageCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

/**
 * 按目标宽高比从原图中取一块覆盖裁剪。
 * zoom=1 时取能铺满目标比例的最大矩形；zoom>1 时从中心缩小取景，再用 panX/panY（0–1）平移。
 */
export function coverCropRect(
  naturalWidth: number,
  naturalHeight: number,
  aspect: number,
  zoom: number,
  panX: number,
  panY: number,
): ImageCrop {
  const z = Math.max(1, zoom);
  const imageAspect = naturalWidth / naturalHeight;
  let width: number;
  let height: number;
  if (imageAspect > aspect) {
    height = naturalHeight / z;
    width = height * aspect;
    if (width > naturalWidth) {
      width = naturalWidth;
      height = width / aspect;
    }
  } else {
    width = naturalWidth / z;
    height = width / aspect;
    if (height > naturalHeight) {
      height = naturalHeight;
      width = height * aspect;
    }
  }
  width = Math.min(width, naturalWidth);
  height = Math.min(height, naturalHeight);
  const maxX = Math.max(0, naturalWidth - width);
  const maxY = Math.max(0, naturalHeight - height);
  return {
    x: maxX * clamp01(panX),
    y: maxY * clamp01(panY),
    width,
    height,
  };
}

export async function encodeImage(options: {
  image: HTMLImageElement;
  scale: number;
  mime: ConvertMime;
  quality: number;
  crop?: ImageCrop;
}): Promise<Blob> {
  const { image, scale, mime, quality, crop } = options;
  const src = crop ?? {
    x: 0,
    y: 0,
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
  const sx = Math.max(0, src.x);
  const sy = Math.max(0, src.y);
  const sw = Math.min(src.width, image.naturalWidth - sx);
  const sh = Math.min(src.height, image.naturalHeight - sy);
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前浏览器无法处理图片");
  if (mime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, quality);
  });
  if (!blob) throw new Error("图片转换失败");
  return blob;
}

export function mimeForFormat(format: ImageFormatId, originalType: string): ConvertMime | "original" {
  if (format === "original") {
    if (originalType === "image/webp" || originalType === "image/jpeg" || originalType === "image/png") {
      return originalType;
    }
    return "original";
  }
  return MIME_BY_FORMAT[format];
}
