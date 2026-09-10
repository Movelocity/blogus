import { $generateNodesFromDOM } from "@lexical/html";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $createTextNode,
  $insertNodes,
  COMMAND_PRIORITY_LOW,
  PASTE_COMMAND,
} from "lexical";
import { useEffect } from "react";
import { useRichEditorContext } from "../../../components/rich-editor/context";
import { insertUploadResult, uploadImageOrAttachment } from "./upload";

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

export function PastePlugin() {
  const [editor] = useLexicalComposerContext();
  const { notify, addAsset } = useRichEditorContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const clipboard = event.clipboardData;
        if (!clipboard) return false;

        const files = Array.from(clipboard.files);
        const imageFiles = files.filter(isImageFile);
        const otherFiles = files.filter((f) => !isImageFile(f));

        if (imageFiles.length > 0) {
          event.preventDefault();
          void (async () => {
            for (const file of imageFiles) {
              const result = await uploadImageOrAttachment(file, notify);
              if (!result || result.kind !== "image") continue;
              insertUploadResult(editor, result, addAsset);
            }
          })();
          return true;
        }

        if (otherFiles.length > 0) {
          event.preventDefault();
          void (async () => {
            for (const file of otherFiles) {
              const result = await uploadImageOrAttachment(file, notify);
              if (!result || result.kind !== "attachment") continue;
              insertUploadResult(editor, result, addAsset);
            }
          })();
          return true;
        }

        const html = clipboard.getData("text/html");
        if (html) {
          event.preventDefault();
          const parser = new DOMParser();
          const dom = parser.parseFromString(html, "text/html");
          editor.update(() => {
            const nodes = $generateNodesFromDOM(editor, dom);
            if (nodes.length > 0) $insertNodes(nodes);
          });
          return true;
        }

        const text = clipboard.getData("text/plain");
        if (text) {
          event.preventDefault();
          const lines = text.split(/\r?\n/);
          editor.update(() => {
            const paragraphs = lines.map((line) => {
              const p = $createParagraphNode();
              if (line) p.append($createTextNode(line));
              return p;
            });
            if (paragraphs.length > 0) $insertNodes(paragraphs);
          });
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [addAsset, editor, notify]);

  return null;
}
