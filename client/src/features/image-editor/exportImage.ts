import type { CropSelection, ImageFormat, ImageLayer } from "./types";

const mime = (format: ImageFormat) => format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
export const extension = (format: ImageFormat) => format === "jpeg" ? "jpg" : format;
export const exportName = (name: string, width: number, height: number, format: ImageFormat) =>
  `${name.replace(/\.[^.]+$/, "")}_${width}x${height}.${extension(format)}`;

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片编码失败")), type, quality));
}

export function buildIco(png: Uint8Array, width: number, height: number): Blob {
  const buffer = new ArrayBuffer(22 + png.length); const view = new DataView(buffer);
  view.setUint16(2, 1, true); view.setUint16(4, 1, true);
  view.setUint8(6, width >= 256 ? 0 : width); view.setUint8(7, height >= 256 ? 0 : height);
  view.setUint16(10, 1, true); view.setUint16(12, 32, true);
  view.setUint32(14, png.length, true); view.setUint32(18, 22, true);
  new Uint8Array(buffer).set(png, 22);
  return new Blob([buffer], { type: "image/x-icon" });
}

export async function renderLayer(layer: ImageLayer, width: number, height: number, format: ImageFormat, quality: number) {
  const image = new Image(); image.src = layer.src; await image.decode();
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d")!;
  if (format === "jpeg") { context.fillStyle = "#fff"; context.fillRect(0, 0, width, height); }
  context.drawImage(image, 0, 0, width, height);
  const blob = await canvasBlob(canvas, mime(format), format === "png" || format === "ico" ? undefined : quality);
  return format === "ico" ? buildIco(new Uint8Array(await blob.arrayBuffer()), width, height) : blob;
}

export async function cropLayer(layer: ImageLayer, crop: CropSelection): Promise<ImageLayer> {
  const image = new Image(); image.src = layer.src; await image.decode();
  const sx = crop.x / layer.width * layer.naturalWidth, sy = crop.y / layer.height * layer.naturalHeight;
  const sw = crop.width / layer.width * layer.naturalWidth, sh = crop.height / layer.height * layer.naturalHeight;
  const canvas = document.createElement("canvas"); canvas.width = Math.round(sw); canvas.height = Math.round(sh);
  canvas.getContext("2d")!.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const blob = await canvasBlob(canvas, "image/png");
  return { ...layer, src: URL.createObjectURL(blob), name: `${layer.name.replace(/\.[^.]+$/, "")}_crop.png`, naturalWidth: canvas.width, naturalHeight: canvas.height, width: crop.width, height: crop.height, bytes: blob.size };
}

export const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;

