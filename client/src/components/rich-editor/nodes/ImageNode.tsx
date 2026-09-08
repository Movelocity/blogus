import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import type { JSX } from "react";

export type SerializedImageNode = Spread<
  {
    src: string;
    alt?: string;
    width?: number;
  },
  SerializedLexicalNode
>;

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __alt?: string;
  __width?: number;

  static getType(): string {
    return "image";
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__alt, node.__width, node.__key);
  }

  constructor(src: string, alt?: string, width?: number, key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__alt = alt;
    this.__width = width;
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "re-image-block";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  static importDOM(): DOMConversionMap {
    return {
      img: () => ({
        conversion: (domNode) => {
          const img = domNode as HTMLImageElement;
          const src = img.getAttribute("src") ?? "";
          if (!src) return null;
          const alt = img.getAttribute("alt") ?? undefined;
          const widthAttr = img.getAttribute("width");
          const width = widthAttr ? Number(widthAttr) : undefined;
          return { node: $createImageNode({ src, alt, width }) };
        },
        priority: 1,
      }),
    };
  }

  exportDOM(): DOMExportOutput {
    const img = document.createElement("img");
    img.setAttribute("src", this.__src);
    if (this.__alt) img.setAttribute("alt", this.__alt);
    if (this.__width) img.setAttribute("width", String(this.__width));
    return { element: img };
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return $createImageNode({
      src: serializedNode.src,
      alt: serializedNode.alt,
      width: serializedNode.width,
    });
  }

  exportJSON(): SerializedImageNode {
    return {
      type: "image",
      version: 1,
      src: this.__src,
      alt: this.__alt,
      width: this.__width,
    };
  }

  getSrc(): string {
    return this.__src;
  }

  decorate(): JSX.Element {
    return (
      <figure className="re-image-block" contentEditable={false}>
        <img
          src={this.__src}
          alt={this.__alt ?? ""}
          width={this.__width}
          draggable={false}
        />
      </figure>
    );
  }
}

export function $createImageNode(payload: {
  src: string;
  alt?: string;
  width?: number;
}): ImageNode {
  return $applyNodeReplacement(new ImageNode(payload.src, payload.alt, payload.width));
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}
