import { ArrowLeft, DownloadSimple, Gear, Moon, Sun } from "@phosphor-icons/react";
import { useCallback, useRef, useState } from "react";
import { Link } from "react-router";
import { useScrollHide } from "../hooks/useScrollHide";
import { useTheme } from "../hooks/useTheme";
import { chromeMotionStyle } from "../features/rich-editor/chrome";
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
  const { theme, toggle: toggleTheme } = useTheme();

  const [title, setTitle] = useState(draft.title);
  const [assets, setAssets] = useState<AssetRef[]>(draft.assets);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "saved", at: new Date() });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [linkCardOpen, setLinkCardOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<SerializedEditorState | null>(null);

  const getStateRef = useRef<(() => SerializedEditorState) | null>(null);
  const editorRef = useRef<LexicalEditor | null>(null);
  const { hidden: chromeHidden, scrollRef } = useScrollHide(80);
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
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      <header
        className="fixed inset-x-0 top-0 z-50 h-14 border-b border-border bg-background"
        style={{
          ...chromeMotionStyle,
          transform: chromeHidden ? "translateY(-100%)" : "translateY(0)",
        }}
      >
        <div className="mx-auto flex h-full max-w-[1180px] items-center gap-2 px-6 md:gap-3">
          <Link
            to="/"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="返回首页"
          >
            <ArrowLeft size={18} />
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
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
            title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="设置"
            title="设置"
          >
            <Gear size={18} />
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <DownloadSimple size={16} />
            <span className="hidden sm:inline">导出 JSON</span>
          </button>
        </div>
      </header>

      <RichEditor
        className="min-h-0 flex-1"
        scrollRef={scrollRef}
        chromeHidden={chromeHidden}
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
