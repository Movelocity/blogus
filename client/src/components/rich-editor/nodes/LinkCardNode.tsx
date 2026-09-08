import {
  $applyNodeReplacement,
  DecoratorNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import type { JSX } from "react";

export type SerializedLinkCardNode = Spread<
  {
    url: string;
    title: string;
    description: string;
  },
  SerializedLexicalNode
>;

export class LinkCardNode extends DecoratorNode<JSX.Element> {
  __url: string;
  __title: string;
  __description: string;

  static getType(): string {
    return "link-card";
  }

  static clone(node: LinkCardNode): LinkCardNode {
    return new LinkCardNode(node.__url, node.__title, node.__description, node.__key);
  }

  constructor(url: string, title: string, description: string, key?: NodeKey) {
    super(key);
    this.__url = url;
    this.__title = title;
    this.__description = description;
  }

  createDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "re-link-card";
    return div;
  }

  updateDOM(): false {
    return false;
  }

  static importJSON(serializedNode: SerializedLinkCardNode): LinkCardNode {
    return $createLinkCardNode({
      url: serializedNode.url,
      title: serializedNode.title,
      description: serializedNode.description,
    });
  }

  exportJSON(): SerializedLinkCardNode {
    return {
      type: "link-card",
      version: 1,
      url: this.__url,
      title: this.__title,
      description: this.__description,
    };
  }

  decorate(): JSX.Element {
    return (
      <div className="re-link-card" contentEditable={false}>
        <div className="re-link-card-title">{this.__title || this.__url}</div>
        {this.__description ? (
          <div className="re-link-card-desc">{this.__description}</div>
        ) : null}
        <div className="re-link-card-url">{this.__url}</div>
      </div>
    );
  }
}

export function $createLinkCardNode(payload: {
  url: string;
  title: string;
  description: string;
}): LinkCardNode {
  return $applyNodeReplacement(
    new LinkCardNode(payload.url, payload.title, payload.description),
  );
}

export function $isLinkCardNode(node: LexicalNode | null | undefined): node is LinkCardNode {
  return node instanceof LinkCardNode;
}
