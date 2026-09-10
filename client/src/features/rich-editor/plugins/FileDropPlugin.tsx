import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_LOW, DRAGOVER_COMMAND, DROP_COMMAND } from "lexical";
import { useEffect } from "react";
import { useRichEditorContext } from "../../../components/rich-editor/context";
import { insertUploadResult, uploadImageOrAttachment } from "./upload";

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

export function FileDropPlugin() {
  const [editor] = useLexicalComposerContext();
  const { notify, addAsset } = useRichEditorContext();

  useEffect(() => {
    const preventDefault = editor.registerCommand(
      DRAGOVER_COMMAND,
      (event: DragEvent) => {
        if (event.dataTransfer?.types.includes("Files")) {
          event.preventDefault();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    const drop = editor.registerCommand(
      DROP_COMMAND,
      (event: DragEvent) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (files.length === 0) return false;
        event.preventDefault();

        void (async () => {
          for (const file of files) {
            const result = await uploadImageOrAttachment(file, notify);
            if (!result) continue;
            insertUploadResult(editor, result, addAsset);
          }
        })();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );

    return () => {
      preventDefault();
      drop();
    };
  }, [addAsset, editor, notify]);

  return null;
}
