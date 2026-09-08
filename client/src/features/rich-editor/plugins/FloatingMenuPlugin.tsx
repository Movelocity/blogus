import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { $isImageNode } from "../../../components/rich-editor/nodes/ImageNode";
import { $isAttachmentNode } from "../../../components/rich-editor/nodes/AttachmentNode";
import { $isLinkCardNode } from "../../../components/rich-editor/nodes/LinkCardNode";

type Format = "bold" | "italic" | "underline" | "strikethrough" | "code";

const FORMATS: { id: Format; label: string }[] = [
  { id: "bold", label: "B" },
  { id: "italic", label: "I" },
  { id: "underline", label: "U" },
  { id: "strikethrough", label: "S" },
  { id: "code", label: "</>" },
];

function isInsideDecoratorBlock(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  const nodes = selection.getNodes();
  return nodes.some(
    (node) => $isImageNode(node) || $isLinkCardNode(node) || $isAttachmentNode(node),
  );
}

export function FloatingMenuPlugin() {
  const [editor] = useLexicalComposerContext();
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [activeFormats, setActiveFormats] = useState<Set<Format>>(new Set());
  const visibleRef = useRef(false);

  const hide = useCallback(() => {
    if (!visibleRef.current) return;
    visibleRef.current = false;
    setVisible(false);
  }, []);

  const update = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || selection.isCollapsed() || isInsideDecoratorBlock()) {
        hide();
        return;
      }

      const native = window.getSelection();
      if (!native || native.rangeCount === 0) {
        hide();
        return;
      }

      const rect = native.getRangeAt(0).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        hide();
        return;
      }

      visibleRef.current = true;
      setPosition({
        top: rect.top - 48 + window.scrollY,
        left: rect.left + rect.width / 2 + window.scrollX,
      });
      setActiveFormats(
        new Set(
          FORMATS.filter((f) => selection.hasFormat(f.id)).map((f) => f.id),
        ),
      );
      setVisible(true);
    });
  }, [editor, hide]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        update();
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, update]);

  const applyFormat = (format: Format) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    update();
  };

  const clearFormat = () => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      for (const f of FORMATS) {
        if (selection.hasFormat(f.id)) {
          selection.toggleFormat(f.id);
        }
      }
    });
    update();
  };

  if (!visible) return null;

  return createPortal(
    <div
      className="re-floating-menu"
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
        transform: "translateX(-50%)",
      }}
    >
      {FORMATS.map((f) => (
        <button
          key={f.id}
          type="button"
          className={activeFormats.has(f.id) ? "active" : ""}
          title={f.label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyFormat(f.id)}
        >
          {f.label}
        </button>
      ))}
      <span className="divider" />
      <button type="button" title="清除格式" onMouseDown={(e) => e.preventDefault()} onClick={clearFormat}>
        ✕
      </button>
    </div>,
    document.body,
  );
}
