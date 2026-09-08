import { createContext, useContext } from "react";
import type { AssetRef } from "../../features/rich-editor/assets";
import type { ToastType } from "../../lib/toast";

export type SaveStatus = { kind: "saved"; at: Date } | { kind: "dirty" };

/** 仅放稳定、低频变更的依赖，避免 Lexical 子树因保存状态重渲染。 */
export type RichEditorContextValue = {
  notify: (message: string, type?: ToastType) => void;
  addAsset: (ref: AssetRef) => void;
};

export const RichEditorContext = createContext<RichEditorContextValue | null>(null);

export function useRichEditorContext() {
  const ctx = useContext(RichEditorContext);
  if (!ctx) throw new Error("useRichEditorContext must be used within RichEditorProvider");
  return ctx;
}
