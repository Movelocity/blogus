import type { ImageLayer } from "./types";

export async function filesToLayers(files: File[], startIndex: number): Promise<ImageLayer[]> {
  const images = files.filter((file) => file.type.startsWith("image/"));
  return Promise.all(images.map(async (file, index) => {
    const src = URL.createObjectURL(file);
    const image = new Image();
    image.src = src;
    await image.decode();
    const scale = Math.min(1, 520 / Math.max(image.naturalWidth, image.naturalHeight));
    return {
      id: crypto.randomUUID(), name: file.name, src,
      naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
      width: Math.round(image.naturalWidth * scale), height: Math.round(image.naturalHeight * scale),
      x: 80 + ((startIndex + index) % 5) * 36, y: 80 + ((startIndex + index) % 5) * 36,
      bytes: file.size, z: startIndex + index + 1,
    };
  }));
}

export function clipboardImageFiles(event: ClipboardEvent): File[] {
  return Array.from(event.clipboardData?.items ?? [])
    .filter((item) => item.type.startsWith("image/"))
    .map((item) => item.getAsFile()).filter((file): file is File => Boolean(file));
}

