import type { SerializedEditorState } from "lexical";
import type { AssetRef } from "./assets";

export const DRAFT_STORAGE_KEY = "blogus:rich-editor:draft";

/** Lexical 要求 root 至少有一个块节点，否则 setEditorState 会抛错。 */
export function createEmptyEditorState(): SerializedEditorState {
  return {
    root: {
      children: [
        {
          children: [],
          direction: null,
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
          textFormat: 0,
          textStyle: "",
        },
      ],
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  } as unknown as SerializedEditorState;
}

export function ensureNonEmptyEditorState(
  editorState: SerializedEditorState,
): SerializedEditorState {
  const root = editorState.root as { children?: unknown[] };
  if (!root?.children || root.children.length === 0) {
    return createEmptyEditorState();
  }
  return editorState;
}

export type RichEditorSnapshotV1 = {
  format: "blogus-rich-editor";
  version: 1;
  title: string;
  updatedAt: string;
  editorState: SerializedEditorState;
  assets: AssetRef[];
};

export function createEmptySnapshot(): RichEditorSnapshotV1 {
  return {
    format: "blogus-rich-editor",
    version: 1,
    title: "未命名文档",
    updatedAt: new Date().toISOString(),
    editorState: createEmptyEditorState(),
    assets: [],
  };
}

export function parseSnapshot(raw: string): RichEditorSnapshotV1 | null {
  try {
    const data = JSON.parse(raw) as Partial<RichEditorSnapshotV1>;
    if (data.format !== "blogus-rich-editor" || data.version !== 1) return null;
    if (!data.editorState || !Array.isArray(data.assets)) return null;
    return {
      format: "blogus-rich-editor",
      version: 1,
      title: data.title ?? "未命名文档",
      updatedAt: data.updatedAt ?? new Date().toISOString(),
      editorState: ensureNonEmptyEditorState(data.editorState),
      assets: data.assets,
    };
  } catch {
    return null;
  }
}

export function loadDraft(): RichEditorSnapshotV1 | null {
  const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
  if (!raw) return null;
  return parseSnapshot(raw);
}

export function saveDraft(snapshot: RichEditorSnapshotV1) {
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
}

/** 用于判断草稿是否真有变化，忽略 updatedAt 等元数据。 */
export function draftFingerprint(
  title: string,
  assets: AssetRef[],
  editorState: SerializedEditorState,
): string {
  return JSON.stringify({ title, assets, editorState });
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
}

export function downloadSnapshot(snapshot: RichEditorSnapshotV1) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const anchor = Object.assign(document.createElement("a"), {
    href: url,
    download: `rich-editor-${stamp}.json`,
  });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
