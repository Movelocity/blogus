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

export async function encodeImage(options: {
  image: HTMLImageElement;
  scale: number;
  mime: ConvertMime;
  quality: number;
}): Promise<Blob> {
  const { image, scale, mime, quality } = options;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前浏览器无法处理图片");
  if (mime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(image, 0, 0, width, height);
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
