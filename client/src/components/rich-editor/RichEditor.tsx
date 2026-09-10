import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { registerCodeHighlighting } from "@lexical/code";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { AutoLinkPlugin, createLinkMatcherWithRegExp } from "@lexical/react/LexicalAutoLinkPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { editorScrollInset } from "../../features/rich-editor/chrome";
import type { LexicalEditor, SerializedEditorState } from "lexical";
import { RichEditorContext, type SaveStatus } from "./context";
import { EditorContent } from "./EditorContent";
import { Toolbar } from "./Toolbar";
import { SlashMenuPlugin } from "./SlashMenu";
import { richEditorNodes } from "../../features/rich-editor/schema";
import { richEditorTheme } from "../../features/rich-editor/theme";
import { AutoSavePlugin } from "../../features/rich-editor/plugins/AutoSavePlugin";
import { FileDropPlugin } from "../../features/rich-editor/plugins/FileDropPlugin";
import { FloatingMenuPlugin } from "../../features/rich-editor/plugins/FloatingMenuPlugin";
import { PastePlugin } from "../../features/rich-editor/plugins/PastePlugin";
import type { AssetRef } from "../../features/rich-editor/assets";
import { ensureNonEmptyEditorState, draftFingerprint } from "../../features/rich-editor/storage";
import type { ToastType } from "../../lib/toast";
import "../../features/rich-editor/rich-editor.css";

const URL_MATCHER = createLinkMatcherWithRegExp(
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/,
  (text) => (text.startsWith("http") ? text : `https://${text}`),
);

function CodeHighlightPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => registerCodeHighlighting(editor), [editor]);
  return null;
}

function EditorStateBridge({
  onReadyRef,
}: {
  onReadyRef: React.MutableRefObject<(() => SerializedEditorState) | null>;
}) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    onReadyRef.current = () => editor.getEditorState().toJSON();
  }, [editor, onReadyRef]);
  return null;
}

function ImportStatePlugin({
  pendingImport,
  onApplied,
}: {
  pendingImport: SerializedEditorState | null;
  onApplied: () => void;
}) {
  const [editor] = useLexicalComposerContext();
  const lastAppliedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingImport) return;
    const key = JSON.stringify(pendingImport);
    if (lastAppliedRef.current === key) return;
    lastAppliedRef.current = key;
    const state = editor.parseEditorState(
      JSON.stringify(ensureNonEmptyEditorState(pendingImport)),
    );
    editor.setEditorState(state);
    onApplied();
  }, [editor, onApplied, pendingImport]);

  return null;
}

function EditorRefPlugin({
  editorRef,
}: {
  editorRef: React.MutableRefObject<LexicalEditor | null>;
}) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);
  return null;
}

export function RichEditor({
  initialEditorState,
  pendingImport,
  onImportApplied,
  assets,
  addAsset,
  notify,
  setSaveStatus,
  title,
  onEditorReadyRef,
  editorRef,
  onLinkCardRequest,
  initialFingerprint,
  scrollRef,
  chromeHidden = false,
  className = "",
}: {
  initialEditorState?: SerializedEditorState;
  pendingImport: SerializedEditorState | null;
  onImportApplied: () => void;
  assets: AssetRef[];
  addAsset: (ref: AssetRef) => void;
  notify: (message: string, type?: ToastType) => void;
  setSaveStatus: React.Dispatch<React.SetStateAction<SaveStatus>>;
  title: string;
  onEditorReadyRef: React.MutableRefObject<(() => SerializedEditorState) | null>;
  editorRef: React.MutableRefObject<LexicalEditor | null>;
  onLinkCardRequest: () => void;
  initialFingerprint: string;
  scrollRef?: (el: HTMLDivElement | null) => void;
  chromeHidden?: boolean;
  className?: string;
}) {
  const initialConfig = useMemo(
    () => ({
      namespace: "BlogusRichEditor",
      theme: richEditorTheme,
      nodes: richEditorNodes,
      editorState: initialEditorState
        ? JSON.stringify(ensureNonEmptyEditorState(initialEditorState))
        : undefined,
      onError(error: Error) {
        console.error("[RichEditor]", error);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const contextValue = useMemo(
    () => ({ notify, addAsset }),
    [addAsset, notify],
  );

  const handleLinkCard = useCallback(() => onLinkCardRequest(), [onLinkCardRequest]);
  const pageRootRef = useRef<HTMLDivElement>(null);

  return (
    <RichEditorContext.Provider value={contextValue}>
      <LexicalComposer initialConfig={initialConfig}>
        <EditorStateBridge onReadyRef={onEditorReadyRef} />
        <EditorRefPlugin editorRef={editorRef} />
        <ImportStatePlugin pendingImport={pendingImport} onApplied={onImportApplied} />
        <div ref={pageRootRef} className={`flex min-h-0 flex-col ${className}`}>
          <Toolbar
            chromeHidden={chromeHidden}
            toolbarHeightRoot={pageRootRef}
            onInsertLinkCard={handleLinkCard}
          />
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto"
            style={{ paddingTop: editorScrollInset }}
          >
            <div className="re-editor-root mx-auto max-w-3xl px-4 py-6 md:px-8">
              <EditorContent />
            </div>
          </div>
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <CheckListPlugin />
        <LinkPlugin />
        <AutoLinkPlugin matchers={[URL_MATCHER]} />
        <CodeHighlightPlugin />
        <TabIndentationPlugin />
        <PastePlugin />
        <FileDropPlugin />
        <FloatingMenuPlugin />
        <SlashMenuPlugin onLinkCard={handleLinkCard} />
        <AutoSavePlugin
          title={title}
          assets={assets}
          initialFingerprint={initialFingerprint}
          onSaveStatus={setSaveStatus}
        />
      </LexicalComposer>
    </RichEditorContext.Provider>
  );
}
