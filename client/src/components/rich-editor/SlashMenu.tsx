import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  BLUR_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
} from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  TextHOne,
  TextHTwo,
  TextHThree,
  ListBullets,
  ListNumbers,
  ListChecks,
  Quotes,
  Minus,
  Code,
  Image,
  Paperclip,
  Cards,
} from "@phosphor-icons/react";
import { useRichEditorContext } from "./context";
import { insertBlock, type BlockInsertType } from "./insertBlocks";
import { insertUploadResult, uploadImageOrAttachment } from "../../features/rich-editor/plugins/upload";

type SlashCommand = {
  id: string;
  label: string;
  hint: string;
  type: BlockInsertType | "link-card" | "image-upload" | "attachment-upload";
  icon: React.ReactNode;
};

const COMMANDS: SlashCommand[] = [
  { id: "h1", label: "标题 1", hint: "大标题", type: "h1", icon: <TextHOne size={16} /> },
  { id: "h2", label: "标题 2", hint: "中标题", type: "h2", icon: <TextHTwo size={16} /> },
  { id: "h3", label: "标题 3", hint: "小标题", type: "h3", icon: <TextHThree size={16} /> },
  { id: "bullet", label: "无序列表", hint: "项目符号", type: "bullet", icon: <ListBullets size={16} /> },
  { id: "number", label: "有序列表", hint: "编号列表", type: "number", icon: <ListNumbers size={16} /> },
  { id: "check", label: "待办列表", hint: "勾选框", type: "check", icon: <ListChecks size={16} /> },
  { id: "quote", label: "引用", hint: "引用块", type: "quote", icon: <Quotes size={16} /> },
  { id: "hr", label: "分隔线", hint: "水平线", type: "hr", icon: <Minus size={16} /> },
  { id: "code", label: "代码块", hint: "语法高亮", type: "code", icon: <Code size={16} /> },
  { id: "image", label: "图片", hint: "上传图片", type: "image-upload", icon: <Image size={16} /> },
  { id: "attachment", label: "附件", hint: "上传文件", type: "attachment-upload", icon: <Paperclip size={16} /> },
  { id: "link-card", label: "链接卡片", hint: "块级卡片", type: "link-card", icon: <Cards size={16} /> },
];

function matchCommands(query: string) {
  const q = query.toLowerCase();
  return COMMANDS.filter(
    (cmd) =>
      cmd.id.includes(q) ||
      cmd.label.toLowerCase().includes(q) ||
      cmd.hint.toLowerCase().includes(q),
  );
}

type SlashMatch = { query: string; start: number; end: number };

function matchFingerprint(match: SlashMatch): string {
  return `${match.start}:${match.end}:${match.query}`;
}

function detectSlashQuery(): SlashMatch | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;
  const anchor = selection.anchor;
  const node = anchor.getNode();
  if (!$isTextNode(node)) return null;
  const text = node.getTextContent().slice(0, anchor.offset);
  const match = /(?:^|\s)\/(\w*)$/.exec(text);
  if (!match) return null;
  const query = match[1] ?? "";
  const slashIndex = text.lastIndexOf("/");
  return { query, start: slashIndex, end: anchor.offset };
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

export function SlashMenuPlugin({
  onLinkCard,
}: {
  onLinkCard: () => void;
}) {
  const [editor] = useLexicalComposerContext();
  const { notify, addAsset } = useRichEditorContext();
  const [match, setMatch] = useState<SlashMatch | null>(null);
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingRange = useRef<SlashMatch | null>(null);
  const menuOpenRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const matchRef = useRef<SlashMatch | null>(null);
  const dismissedMatchRef = useRef<string | null>(null);

  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  const close = useCallback(() => {
    if (!menuOpenRef.current) return;
    menuOpenRef.current = false;
    setMatch(null);
    setCommands([]);
    setActive(0);
  }, []);

  const dismiss = useCallback(() => {
    const current = matchRef.current;
    dismissedMatchRef.current = current ? matchFingerprint(current) : "any";
    close();
  }, [close]);

  const removeSlashText = useCallback(
    (range: SlashMatch) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const anchor = selection.anchor;
        const node = anchor.getNode();
        if (!$isTextNode(node)) return;
        const full = node.getTextContent();
        const before = full.slice(0, range.start);
        const after = full.slice(range.end);
        if (before.length === 0 && after.length === 0) {
          node.remove();
        } else {
          node.setTextContent(before + after);
          anchor.set(node.getKey(), before.length, "text");
        }
      });
    },
    [editor],
  );

  const runCommand = useCallback(
    (cmd: SlashCommand) => {
      const range = match;
      if (!range) return;
      dismissedMatchRef.current = null;
      close();
      removeSlashText(range);

      if (cmd.type === "image-upload") {
        pendingRange.current = range;
        imageRef.current?.click();
        return;
      }
      if (cmd.type === "attachment-upload") {
        pendingRange.current = range;
        fileRef.current?.click();
        return;
      }
      if (cmd.type === "link-card") {
        onLinkCard();
        return;
      }
      insertBlock(editor, cmd.type as BlockInsertType);
    },
    [close, editor, match, onLinkCard, removeSlashText],
  );

  const sync = useCallback(() => {
    editor.getEditorState().read(() => {
      const found = detectSlashQuery();
      if (!found) {
        dismissedMatchRef.current = null;
        close();
        return;
      }

      const fp = matchFingerprint(found);
      if (dismissedMatchRef.current === fp) {
        close();
        return;
      }

      const next = matchCommands(found.query);
      if (next.length === 0) {
        close();
        return;
      }

      dismissedMatchRef.current = null;
      menuOpenRef.current = true;
      setMatch(found);
      setCommands(next);
      setActive(0);

      const native = window.getSelection();
      if (native && native.rangeCount > 0) {
        const rect = native.getRangeAt(0).getBoundingClientRect();
        setPosition({
          top: rect.bottom + 4,
          left: rect.left,
        });
      }
    });
  }, [close, editor]);

  useEffect(() => {
    return editor.registerUpdateListener(() => sync());
  }, [editor, sync]);

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
      if (containsNode(root, target)) return;
      dismiss();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [editor, dismiss]);

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
      if (event.key === "Escape" && menuOpenRef.current) dismiss();
    };

    const onWindowBlur = () => {
      if (menuOpenRef.current) dismiss();
    };
    const onResize = () => {
      if (menuOpenRef.current) dismiss();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" && menuOpenRef.current) dismiss();
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
      if (menuOpenRef.current) dismiss();
    };

    scrollParent.addEventListener("scroll", onWheelOrScroll, { passive: true });
    scrollParent.addEventListener("wheel", onWheelOrScroll, { passive: true });
    return () => {
      scrollParent.removeEventListener("scroll", onWheelOrScroll);
      scrollParent.removeEventListener("wheel", onWheelOrScroll);
    };
  }, [editor, dismiss]);

  useEffect(() => {
    const down = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      () => {
        if (!match || commands.length === 0) return false;
        setActive((i) => (i + 1) % commands.length);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
    const up = editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      () => {
        if (!match || commands.length === 0) return false;
        setActive((i) => (i - 1 + commands.length) % commands.length);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
    const enter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      () => {
        if (!match || commands.length === 0) return false;
        runCommand(commands[active]);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
    const tab = editor.registerCommand(
      KEY_TAB_COMMAND,
      () => {
        if (!match || commands.length === 0) return false;
        runCommand(commands[active]);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
    const esc = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        if (!match) return false;
        dismiss();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
    return () => {
      down();
      up();
      enter();
      tab();
      esc();
    };
  }, [active, commands, dismiss, editor, match, runCommand]);

  const visible = match !== null && commands.length > 0;

  return (
    <>
      {visible &&
        createPortal(
          <div
            ref={menuRef}
            className="re-slash-menu"
            style={{ position: "fixed", top: position.top, left: position.left }}
          >
            {commands.map((cmd, i) => (
              <button
                key={cmd.id}
                type="button"
                className={`re-slash-item${i === active ? " active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runCommand(cmd)}
              >
                {cmd.icon}
                <span>{cmd.label}</span>
                <span className="re-slash-hint">{cmd.hint}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          void uploadImageOrAttachment(file, notify).then((result) => {
            if (!result) return;
            insertUploadResult(editor, result, addAsset);
          });
        }}
      />
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          void uploadImageOrAttachment(file, notify).then((result) => {
            if (!result || result.kind !== "attachment") return;
            insertUploadResult(editor, result, addAsset);
          });
        }}
      />
    </>
  );
}
