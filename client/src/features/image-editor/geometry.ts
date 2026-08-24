import type { ImageLayer, Rect } from "./types";

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function contentBounds(layers: ImageLayer[]): Rect | null {
  if (!layers.length) return null;
  const left = Math.min(...layers.map((item) => item.x));
  const top = Math.min(...layers.map((item) => item.y));
  const right = Math.max(...layers.map((item) => item.x + item.width));
  const bottom = Math.max(...layers.map((item) => item.y + item.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function fitZoom(layers: ImageLayer[], viewport: { width: number; height: number }, padding = 80) {
  const bounds = contentBounds(layers);
  if (!bounds) return 1;
  return clamp(Math.min(
    (viewport.width - padding * 2) / bounds.width,
    (viewport.height - padding * 2) / bounds.height,
    1,
  ), 0.1, 4);
}

export function resizedRect(rect: Rect, dx: number, dy: number, lockAspect: boolean): Rect {
  const width = Math.max(40, rect.width + dx);
  const height = lockAspect ? width / (rect.width / rect.height) : Math.max(40, rect.height + dy);
  return { ...rect, width, height };
}

