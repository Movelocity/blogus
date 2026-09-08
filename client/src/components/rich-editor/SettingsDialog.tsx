import { useRef, useState } from "react";
import { X, Trash } from "@phosphor-icons/react";
import type { SerializedEditorState } from "lexical";
import {
  formatBytes,
  isAssetReferenced,
  isImageAsset,
  type AssetRef,
} from "../../features/rich-editor/assets";
import {
  clearDraft,
  downloadSnapshot,
  parseSnapshot,
  type RichEditorSnapshotV1,
} from "../../features/rich-editor/storage";

type Tab = "assets" | "document";

export function SettingsDialog({
  open,
  onClose,
  assets,
  editorState,
  title,
  onRemoveAsset,
  onImport,
  onClearDraft,
  notify,
}: {
  open: boolean;
  onClose: () => void;
  assets: AssetRef[];
  editorState: SerializedEditorState | null;
  title: string;
  onRemoveAsset: (id: string) => void;
  onImport: (snapshot: RichEditorSnapshotV1) => void;
  onClearDraft: () => void;
  notify: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [tab, setTab] = useState<Tab>("assets");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleExport = () => {
    if (!editorState) return;
    downloadSnapshot({
      format: "blogus-rich-editor",
      version: 1,
      title,
      updatedAt: new Date().toISOString(),
      editorState,
      assets,
    });
    notify("已导出 JSON", "success");
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const snapshot = parseSnapshot(String(reader.result));
      if (!snapshot) {
        notify("文件格式或版本不匹配", "error");
        return;
      }
      if (!window.confirm("导入将覆盖当前草稿，是否继续？")) return;
      onImport(snapshot);
      notify("导入成功", "success");
      onClose();
    };
    reader.readAsText(file);
  };

  const handleClear = () => {
    if (!window.confirm("确定清空草稿？此操作不可撤销。")) return;
    clearDraft();
    onClearDraft();
    notify("草稿已清空", "success");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-foreground/10 bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-foreground/10 px-5 py-4">
          <h2 className="text-lg font-semibold">设置</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-foreground/10 px-5">
          {(["assets", "document"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm transition-colors ${
                tab === t
                  ? "border-b-2 border-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "assets" ? "资源" : "文档"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "assets" && (
            <div className="space-y-2">
              {assets.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无上传资源</p>
              ) : (
                assets.map((asset) => {
                  const referenced = editorState
                    ? isAssetReferenced(asset, editorState)
                    : false;
                  return (
                    <div
                      key={asset.id}
                      className="flex items-center gap-3 rounded-lg border border-foreground/10 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{asset.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {isImageAsset(asset) ? "图片" : "附件"} · {formatBytes(asset.size)}
                          {referenced ? " · 仍被引用" : " · 未引用"}
                        </div>
                      </div>
                      <button
                        type="button"
                        title="从列表移除"
                        onClick={() => onRemoveAsset(asset.id)}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === "document" && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleExport}
                className="w-full rounded-lg border border-foreground/10 px-4 py-2.5 text-left text-sm hover:bg-foreground/5"
              >
                导出 JSON
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-lg border border-foreground/10 px-4 py-2.5 text-left text-sm hover:bg-foreground/5"
              >
                导入 JSON
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="w-full rounded-lg border border-destructive/30 px-4 py-2.5 text-left text-sm text-destructive hover:bg-destructive/5"
              >
                清空草稿
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) handleImportFile(file);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
