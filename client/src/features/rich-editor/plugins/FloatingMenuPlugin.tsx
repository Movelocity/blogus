import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

function containsNode(parent: HTMLElement | null, target: EventTarget | null): boolean {
  if (!parent || !target || !(target instanceof Node)) return false;
  return parent.contains(target);
}

type MenuAnchor = {
  selectionTop: number;
  selectionBottom: number;
  centerX: number;
};

const VIEWPORT_MARGIN = 8;
const MENU_GAP = 8;

function clampMenuPosition(menu: HTMLElement, anchor: MenuAnchor): { top: number; left: number } {
  const { width, height } = menu.getBoundingClientRect();
  const halfW = width / 2;

  let left = anchor.centerX;
  left = Math.max(
    VIEWPORT_MARGIN + halfW,
    Math.min(window.innerWidth - VIEWPORT_MARGIN - halfW, left),
  );

  let top = anchor.selectionTop - height - MENU_GAP;
  if (top < VIEWPORT_MARGIN) {
    top = anchor.selectionBottom + MENU_GAP;
  }
  top = Math.max(
    VIEWPORT_MARGIN,
    Math.min(window.innerHeight - height - VIEWPORT_MARGIN, top),
  );

  return { top, left };
}

export function FloatingMenuPlugin() {
  const [editor] = useLexicalComposerContext();
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [activeFormats, setActiveFormats] = useState<Set<Format>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(false);
  const deferMenuRef = useRef(false);
  const pointerDownInEditorRef = useRef(false);

  const hide = useCallback(() => {
    if (!visibleRef.current) return;
    visibleRef.current = false;
    setVisible(false);
  }, []);

  const dismiss = useCallback(() => {
    deferMenuRef.current = false;
    pointerDownInEditorRef.current = false;
    hide();
  }, [hide]);

  const update = useCallback(() => {
    if (deferMenuRef.current) {
      hide();
      return;
    }

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
      const nextAnchor = {
        selectionTop: rect.top,
        selectionBottom: rect.bottom,
        centerX: rect.left + rect.width / 2,
      };
      setAnchor(nextAnchor);
      setPosition({
        top: rect.top - 48,
        left: nextAnchor.centerX,
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

  useLayoutEffect(() => {
    if (!visible || !anchor || !menuRef.current) return;
    setPosition(clampMenuPosition(menuRef.current, anchor));
  }, [visible, anchor, activeFormats]);

  useEffect(() => {
    return editor.registerCommand(
      BLUR_COMMAND,
      () => {
        dismiss();
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, dismiss]);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (containsNode(menuRef.current, target)) return;

      if (containsNode(root, target)) {
        deferMenuRef.current = true;
        pointerDownInEditorRef.current = true;
        hide();
        return;
      }

      dismiss();
    };

    const onPointerUp = () => {
      if (!pointerDownInEditorRef.current) return;
      deferMenuRef.current = false;
      pointerDownInEditorRef.current = false;
      update();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [editor, dismiss, hide, update]);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (containsNode(root, target) || containsNode(menuRef.current, target)) return;
      dismiss();
    };

    document.addEventListener("focusin", onFocusIn, true);
    return () => document.removeEventListener("focusin", onFocusIn, true);
  }, [editor, dismiss]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };

    const onWindowBlur = () => dismiss();
    const onResize = () => dismiss();
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") dismiss();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [dismiss]);

  useEffect(() => {
    const root = editor.getRootElement();
    const scrollParent = findScrollParent(root);
    if (!scrollParent) return;

    const onWheelOrScroll = () => {
      if (visibleRef.current) dismiss();
    };

    scrollParent.addEventListener("scroll", onWheelOrScroll, { passive: true });
    scrollParent.addEventListener("wheel", onWheelOrScroll, { passive: true });
    return () => {
      scrollParent.removeEventListener("scroll", onWheelOrScroll);
      scrollParent.removeEventListener("wheel", onWheelOrScroll);
    };
  }, [editor, dismiss]);

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

  if (!visible || !anchor) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="re-floating-menu"
      style={{
        position: "fixed",
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
