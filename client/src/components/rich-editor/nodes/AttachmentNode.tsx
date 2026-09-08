import {
  $applyNodeReplacement,
  DecoratorNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import type { JSX } from "react";
import { formatBytes } from "../../../features/rich-editor/assets";

export type SerializedAttachmentNode = Spread<
  {
    assetId: string;
    fileName: string;
    mime: string;
    url: string;
    size: number;
  },
  SerializedLexicalNode
>;

function fileExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toUpperCase().slice(0, 4) : "FILE";
}

export class AttachmentNode extends DecoratorNode<JSX.Element> {
  __assetId: string;
  __fileName: string;
  __mime: string;
  __url: string;
  __size: number;

  static getType(): string {
    return "attachment";
  }

  static clone(node: AttachmentNode): AttachmentNode {
    return new AttachmentNode(
      node.__assetId,
      node.__fileName,
      node.__mime,
      node.__url,
      node.__size,
      node.__key,
    );
  }

  constructor(
    assetId: string,
    fileName: string,
    mime: string,
    url: string,
    size: number,
    key?: NodeKey,
  ) {
    super(key);
    this.__assetId = assetId;
    this.__fileName = fileName;
    this.__mime = mime;
    this.__url = url;
    this.__size = size;
  }

  createDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "re-attachment";
    return div;
  }

  updateDOM(): false {
    return false;
  }

  static importJSON(serializedNode: SerializedAttachmentNode): AttachmentNode {
    return $createAttachmentNode({
      assetId: serializedNode.assetId,
      fileName: serializedNode.fileName,
      mime: serializedNode.mime,
      url: serializedNode.url,
      size: serializedNode.size,
    });
  }

  exportJSON(): SerializedAttachmentNode {
    return {
      type: "attachment",
      version: 1,
      assetId: this.__assetId,
      fileName: this.__fileName,
      mime: this.__mime,
      url: this.__url,
      size: this.__size,
    };
  }

  getAssetId(): string {
    return this.__assetId;
  }

  decorate(): JSX.Element {
    return (
      <div className="re-attachment" contentEditable={false}>
        <div className="re-attachment-icon">{fileExt(this.__fileName)}</div>
        <div className="re-attachment-info">
          <div className="re-attachment-name">{this.__fileName}</div>
          <div className="re-attachment-meta">{formatBytes(this.__size)}</div>
        </div>
        <a
          className="re-attachment-download"
          href={this.__url}
          download={this.__fileName}
          target="_blank"
          rel="noopener noreferrer"
        >
          下载
        </a>
      </div>
    );
  }
}

export function $createAttachmentNode(payload: {
  assetId: string;
  fileName: string;
  mime: string;
  url: string;
  size: number;
}): AttachmentNode {
  return $applyNodeReplacement(
    new AttachmentNode(
      payload.assetId,
      payload.fileName,
      payload.mime,
      payload.url,
      payload.size,
    ),
  );
}

export function $isAttachmentNode(node: LexicalNode | null | undefined): node is AttachmentNode {
  return node instanceof AttachmentNode;
}
