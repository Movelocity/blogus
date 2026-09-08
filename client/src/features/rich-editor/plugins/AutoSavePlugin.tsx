import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useCallback, useEffect, useRef } from "react";
import type { AssetRef } from "../assets";
import { draftFingerprint, saveDraft } from "../storage";
import type { SaveStatus } from "../../../components/rich-editor/context";

const DEBOUNCE_MS = 500;

export function AutoSavePlugin({
  title,
  assets,
  initialFingerprint,
  onSaveStatus,
}: {
  title: string;
  assets: AssetRef[];
  initialFingerprint: string;
  onSaveStatus: React.Dispatch<React.SetStateAction<SaveStatus>>;
}) {
  const [editor] = useLexicalComposerContext();
  const timerRef = useRef<number | null>(null);
  const titleRef = useRef(title);
  const assetsRef = useRef(assets);
  const onSaveStatusRef = useRef(onSaveStatus);
  const lastFingerprintRef = useRef(initialFingerprint);
  const lastSavedAtRef = useRef(new Date());

  titleRef.current = title;
  assetsRef.current = assets;
  onSaveStatusRef.current = onSaveStatus;

  const flushSave = useCallback(() => {
    const editorState = editor.getEditorState().toJSON();
    const fingerprint = draftFingerprint(titleRef.current, assetsRef.current, editorState);
    if (fingerprint === lastFingerprintRef.current) return;

    lastFingerprintRef.current = fingerprint;
    saveDraft({
      format: "blogus-rich-editor",
      version: 1,
      title: titleRef.current,
      updatedAt: new Date().toISOString(),
      editorState,
      assets: assetsRef.current,
    });
    onSaveStatusRef.current({ kind: "saved", at: new Date() });
  }, [editor]);

  const scheduleSave = useCallback(() => {
    const editorState = editor.getEditorState().toJSON();
    const fingerprint = draftFingerprint(titleRef.current, assetsRef.current, editorState);
    if (fingerprint === lastFingerprintRef.current) return;

    onSaveStatusRef.current((prev) => (prev.kind === "dirty" ? prev : { kind: "dirty" }));

    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      flushSave();
    }, DEBOUNCE_MS);
  }, [editor, flushSave]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
      const fingerprint = draftFingerprint(
        titleRef.current,
        assetsRef.current,
        editorState.toJSON(),
      );
      if (fingerprint === lastFingerprintRef.current) return;
      scheduleSave();
    });
  }, [editor, scheduleSave]);

  // 标题 / 资源列表变更
  useEffect(() => {
    scheduleSave();
  }, [assets, scheduleSave, title]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return null;
}
