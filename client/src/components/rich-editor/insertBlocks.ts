import { $createCodeNode } from "@lexical/code";
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $createHorizontalRuleNode } from "./nodes/HorizontalRuleNode";
import { $createParagraphNode, $insertNodes, type LexicalEditor } from "lexical";
import { $createImageNode } from "./nodes/ImageNode";
import { $createLinkCardNode } from "./nodes/LinkCardNode";

export type BlockInsertType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "bullet"
  | "number"
  | "check"
  | "quote"
  | "hr"
  | "code"
  | "image"
  | "attachment"
  | "link-card";

export function insertBlock(editor: LexicalEditor, type: BlockInsertType) {
  editor.update(() => {
    switch (type) {
      case "paragraph":
        $insertNodes([$createParagraphNode()]);
        break;
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        $insertNodes([$createHeadingNode(type)]);
        break;
      case "quote":
        $insertNodes([$createQuoteNode()]);
        break;
      case "hr":
        $insertNodes([$createHorizontalRuleNode()]);
        break;
      case "code":
        $insertNodes([$createCodeNode()]);
        break;
      default:
        break;
    }
  });

  if (type === "bullet") editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  if (type === "number") editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  if (type === "check") editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
}

export function insertImageAtCursor(editor: LexicalEditor, src: string, alt?: string) {
  editor.update(() => {
    $insertNodes([$createImageNode({ src, alt })]);
  });
}

export function insertLinkCardAtCursor(
  editor: LexicalEditor,
  payload: { url: string; title: string; description: string },
) {
  editor.update(() => {
    $insertNodes([$createLinkCardNode(payload)]);
  });
}
