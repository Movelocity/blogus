import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { HorizontalRuleNode } from "../../components/rich-editor/nodes/HorizontalRuleNode";
import { AttachmentNode } from "../../components/rich-editor/nodes/AttachmentNode";
import { ImageNode } from "../../components/rich-editor/nodes/ImageNode";
import { LinkCardNode } from "../../components/rich-editor/nodes/LinkCardNode";

export const richEditorNodes = [
  HeadingNode,
  QuoteNode,
  HorizontalRuleNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  CodeNode,
  CodeHighlightNode,
  ImageNode,
  LinkCardNode,
  AttachmentNode,
];
