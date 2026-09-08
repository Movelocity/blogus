import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
} from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  TextB,
  TextItalic,
  TextStrikethrough,
  TextUnderline,
  Code,
  TextHOne,
  TextHTwo,
  TextHThree,
  ListBullets,
  ListNumbers,
  ListChecks,
  Quotes,
  Minus,
  Image,
  Paperclip,
  Link,
  Cards,
} from "@phosphor-icons/react";
import { useRichEditorContext } from "./context";
import { insertBlock } from "./insertBlocks";
import { $createImageNode } from "./nodes/ImageNode";
import { uploadImageFile, uploadImageOrAttachment } from "../../features/rich-editor/plugins/upload";

type Format = "bold" | "italic" | "underline" | "strikethrough" | "code";

function ToolbarButton({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-foreground/10 text-foreground"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function Toolbar({
  onInsertLinkCard,
}: {
  onInsertLinkCard: () => void;
}) {
  const [editor] = useLexicalComposerContext();
  const { notify, addAsset } = useRichEditorContext();
  const [formats, setFormats] = useState<Set<Format>>(new Set());
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const syncFormats = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        setFormats(new Set());
        return;
      }
      const next = new Set<Format>();
      for (const f of ["bold", "italic", "underline", "strikethrough", "code"] as Format[]) {
        if (selection.hasFormat(f)) next.add(f);
      }
      setFormats(next);
    });
  }, [editor]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => syncFormats());
    });
  }, [editor, syncFormats]);

  const toggleFormat = (format: Format) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    syncFormats();
  };

  const insertLink = () => {
    const url = window.prompt("链接地址");
    if (!url) return;
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
  };

  const handleImagePick = async (file: File) => {
    const url = await uploadImageFile(file, notify, addAsset);
    if (!url) return;
    editor.update(() => {
      $insertNodes([$createImageNode({ src: url, alt: file.name })]);
    });
  };

  const handleFilePick = async (file: File) => {
    const result = await uploadImageOrAttachment(file, notify, addAsset);
    if (!result || result.kind !== "attachment") return;
    editor.update(() => {
      $insertNodes([result.node]);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5 md:px-4">
      <ToolbarButton active={formats.has("bold")} title="加粗" onClick={() => toggleFormat("bold")}>
        <TextB size={16} />
      </ToolbarButton>
      <ToolbarButton active={formats.has("italic")} title="斜体" onClick={() => toggleFormat("italic")}>
        <TextItalic size={16} />
      </ToolbarButton>
      <ToolbarButton active={formats.has("underline")} title="下划线" onClick={() => toggleFormat("underline")}>
        <TextUnderline size={16} />
      </ToolbarButton>
      <ToolbarButton active={formats.has("strikethrough")} title="删除线" onClick={() => toggleFormat("strikethrough")}>
        <TextStrikethrough size={16} />
      </ToolbarButton>
      <ToolbarButton active={formats.has("code")} title="行内代码" onClick={() => toggleFormat("code")}>
        <Code size={16} />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-foreground/10" />

      <ToolbarButton title="标题 1" onClick={() => insertBlock(editor, "h1")}>
        <TextHOne size={16} />
      </ToolbarButton>
      <ToolbarButton title="标题 2" onClick={() => insertBlock(editor, "h2")}>
        <TextHTwo size={16} />
      </ToolbarButton>
      <ToolbarButton title="标题 3" onClick={() => insertBlock(editor, "h3")}>
        <TextHThree size={16} />
      </ToolbarButton>
      <ToolbarButton title="无序列表" onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}>
        <ListBullets size={16} />
      </ToolbarButton>
      <ToolbarButton title="有序列表" onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}>
        <ListNumbers size={16} />
      </ToolbarButton>
      <ToolbarButton title="待办列表" onClick={() => editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)}>
        <ListChecks size={16} />
      </ToolbarButton>
      <ToolbarButton title="引用" onClick={() => insertBlock(editor, "quote")}>
        <Quotes size={16} />
      </ToolbarButton>
      <ToolbarButton title="分隔线" onClick={() => insertBlock(editor, "hr")}>
        <Minus size={16} />
      </ToolbarButton>
      <ToolbarButton title="代码块" onClick={() => insertBlock(editor, "code")}>
        <Code size={16} />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-foreground/10" />

      <ToolbarButton title="插入图片" onClick={() => imageInputRef.current?.click()}>
        <Image size={16} />
      </ToolbarButton>
      <ToolbarButton title="插入附件" onClick={() => fileInputRef.current?.click()}>
        <Paperclip size={16} />
      </ToolbarButton>
      <ToolbarButton title="插入链接" onClick={insertLink}>
        <Link size={16} />
      </ToolbarButton>
      <ToolbarButton title="插入链接卡片" onClick={onInsertLinkCard}>
        <Cards size={16} />
      </ToolbarButton>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImagePick(file);
          e.target.value = "";
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFilePick(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
