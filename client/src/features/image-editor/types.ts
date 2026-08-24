export type ImageFormat = "png" | "jpeg" | "webp" | "ico";

export interface Rect { x: number; y: number; width: number; height: number }
export interface ImageLayer extends Rect {
  id: string;
  name: string;
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  bytes: number;
  z: number;
}

export interface EditorDocument {
  layers: ImageLayer[];
  selectedId: string | null;
}

export interface ExportPreferences {
  format: ImageFormat;
  quality: number;
  aspectLocked: boolean;
}

export interface CropSelection { x: number; y: number; width: number; height: number }

