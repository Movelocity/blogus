import {
  $applyNodeReplacement,
  ElementNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
} from "lexical";

export type SerializedHorizontalRuleNode = Spread<
  {
    type: "horizontalrule";
  },
  SerializedElementNode
>;

export class HorizontalRuleNode extends ElementNode {
  static getType(): string {
    return "horizontalrule";
  }

  static clone(node: HorizontalRuleNode): HorizontalRuleNode {
    return new HorizontalRuleNode(node.__key);
  }

  createDOM(): HTMLElement {
    const hr = document.createElement("hr");
    hr.className = "re-hr";
    return hr;
  }

  updateDOM(): false {
    return false;
  }

  static importDOM(): DOMConversionMap {
    return {
      hr: () => ({
        conversion: () => ({ node: $createHorizontalRuleNode() }),
        priority: 0,
      }),
    };
  }

  exportDOM(): DOMExportOutput {
    return { element: document.createElement("hr") };
  }

  static importJSON(_serializedNode: SerializedHorizontalRuleNode): HorizontalRuleNode {
    return $createHorizontalRuleNode();
  }

  exportJSON(): SerializedHorizontalRuleNode {
    return {
      ...super.exportJSON(),
      type: "horizontalrule",
      version: 1,
    };
  }

  isInline(): boolean {
    return false;
  }

  canBeEmpty(): boolean {
    return true;
  }
}

export function $createHorizontalRuleNode(): HorizontalRuleNode {
  return $applyNodeReplacement(new HorizontalRuleNode());
}

export function $isHorizontalRuleNode(
  node: LexicalNode | null | undefined,
): node is HorizontalRuleNode {
  return node instanceof HorizontalRuleNode;
}
