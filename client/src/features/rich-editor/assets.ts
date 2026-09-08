import type { SerializedEditorState } from "lexical";

export type AssetRef = {
  id: string;
  url: string;
  key?: string;
  bucket?: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
};

export function createAssetRef(
  file: File,
  upload: { url: string; key?: string; bucket?: string },
): AssetRef {
  return {
    id: crypto.randomUUID(),
    url: upload.url,
    key: upload.key,
    bucket: upload.bucket,
    name: file.name,
    mime: file.type || "application/octet-stream",
    size: file.size,
    createdAt: new Date().toISOString(),
  };
}

export function isImageAsset(asset: AssetRef) {
  return asset.mime.startsWith("image/");
}

function walkNodes(node: unknown, visit: (n: Record<string, unknown>) => void) {
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  visit(record);
  const children = record.children;
  if (Array.isArray(children)) {
    for (const child of children) walkNodes(child, visit);
  }
}

export function scanReferencedAssetIds(editorState: SerializedEditorState): Set<string> {
  const ids = new Set<string>();
  const urls = new Set<string>();

  walkNodes(editorState.root, (node) => {
    if (node.type === "attachment" && typeof node.assetId === "string") {
      ids.add(node.assetId);
    }
    if (node.type === "image" && typeof node.src === "string") {
      urls.add(node.src);
    }
  });

  return ids;
}

export function scanReferencedUrls(editorState: SerializedEditorState): Set<string> {
  const urls = new Set<string>();
  walkNodes(editorState.root, (node) => {
    if (node.type === "image" && typeof node.src === "string") urls.add(node.src);
    if (node.type === "attachment" && typeof node.url === "string") urls.add(node.url);
  });
  return urls;
}

export function isAssetReferenced(asset: AssetRef, editorState: SerializedEditorState): boolean {
  const ids = scanReferencedAssetIds(editorState);
  const urls = scanReferencedUrls(editorState);
  return ids.has(asset.id) || urls.has(asset.url);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
