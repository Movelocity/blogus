import { ArrowLeft, DownloadSimple, Gear } from "@phosphor-icons/react";
import { useCallback, useRef, useState } from "react";
import { Link } from "react-router";
import type { LexicalEditor, SerializedEditorState } from "lexical";
import { LinkCardDialog } from "../components/rich-editor/LinkCardDialog";
import { RichEditor } from "../components/rich-editor/RichEditor";
import { SettingsDialog } from "../components/rich-editor/SettingsDialog";
import { insertLinkCardAtCursor } from "../components/rich-editor/insertBlocks";
import type { SaveStatus } from "../components/rich-editor/context";
import type { AssetRef } from "../features/rich-editor/assets";
import {
  createEmptySnapshot,
  downloadSnapshot,
  draftFingerprint,
  loadDraft,
  type RichEditorSnapshotV1,
} from "../features/rich-editor/storage";
import { ToastView, useToast } from "../lib/toast";

function formatSaveStatus(status: SaveStatus): string {
  if (status.kind === "dirty") return "未保存更改";
  const time = status.at.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  return `已自动保存 · ${time}`;
}

export function RichEditorPage() {
  const draft = loadDraft() ?? createEmptySnapshot();
  const { toasts, dismiss, notify } = useToast();

  const [title, setTitle] = useState(draft.title);
  const [assets, setAssets] = useState<AssetRef[]>(draft.assets);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "saved", at: new Date() });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [linkCardOpen, setLinkCardOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<SerializedEditorState | null>(null);

  const getStateRef = useRef<(() => SerializedEditorState) | null>(null);
  const editorRef = useRef<LexicalEditor | null>(null);
  const initialFingerprint = draftFingerprint(draft.title, draft.assets, draft.editorState);

  const addAsset = useCallback((ref: AssetRef) => {
    setAssets((prev) => (prev.some((a) => a.id === ref.id) ? prev : [...prev, ref]));
  }, []);

  const removeAsset = useCallback((id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleImportApplied = useCallback(() => setPendingImport(null), []);
  const handleLinkCardRequest = useCallback(() => setLinkCardOpen(true), []);

  const handleExport = () => {
    const getState = getStateRef.current;
    if (!getState) return;
    downloadSnapshot({
      format: "blogus-rich-editor",
      version: 1,
      title,
      updatedAt: new Date().toISOString(),
      editorState: getState(),
      assets,
    });
    notify("已导出 JSON", "success");
  };

  const handleImport = (snapshot: RichEditorSnapshotV1) => {
    setTitle(snapshot.title);
    setAssets(snapshot.assets);
    setPendingImport(snapshot.editorState);
    setSaveStatus({ kind: "dirty" });
  };

  const handleClearDraft = useCallback(() => {
    const empty = createEmptySnapshot();
    setTitle(empty.title);
    setAssets([]);
    setPendingImport(empty.editorState);
    setSaveStatus({ kind: "saved", at: new Date() });
  }, []);

  const handleLinkCardSubmit = (payload: { url: string; title: string; description: string }) => {
    const editor = editorRef.current;
    if (editor) {
      insertLinkCardAtCursor(editor, payload);
      return;
    }
    notify("编辑器尚未就绪", "error");
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-2 md:gap-3 md:px-5">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          aria-label="返回首页"
        >
          <ArrowLeft size={20} />
        </Link>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setSaveStatus((prev) => (prev.kind === "dirty" ? prev : { kind: "dirty" }));
          }}
          className="min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground md:text-lg"
          placeholder="文档标题"
        />
        <span className="hidden text-xs text-muted-foreground md:inline">{formatSaveStatus(saveStatus)}</span>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          title="设置"
        >
          <Gear size={20} />
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-md border border-foreground/10 px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <DownloadSimple size={16} />
          <span className="hidden sm:inline">导出 JSON</span>
        </button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <RichEditor
          initialEditorState={draft.editorState}
          pendingImport={pendingImport}
          onImportApplied={handleImportApplied}
          assets={assets}
          addAsset={addAsset}
          notify={notify}
          setSaveStatus={setSaveStatus}
          title={title}
          onEditorReadyRef={getStateRef}
          editorRef={editorRef}
          onLinkCardRequest={handleLinkCardRequest}
          initialFingerprint={initialFingerprint}
        />
      </main>

      <p className="shrink-0 border-t px-4 py-1.5 text-center text-xs text-muted-foreground md:hidden">
        {formatSaveStatus(saveStatus)}
      </p>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        assets={assets}
        editorState={getStateRef.current?.() ?? null}
        title={title}
        onRemoveAsset={removeAsset}
        onImport={handleImport}
        onClearDraft={handleClearDraft}
        notify={notify}
      />

      <LinkCardDialog
        open={linkCardOpen}
        onClose={() => setLinkCardOpen(false)}
        onSubmit={handleLinkCardSubmit}
      />

      <ToastView toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
