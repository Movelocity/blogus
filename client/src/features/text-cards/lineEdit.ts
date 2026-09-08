export type LineMoveDirection = "up" | "down";

export interface LineMoveResult {
  text: string;
  selStart: number;
  selEnd: number;
}

function lineColAt(text: string, pos: number): { line: number; col: number } {
  const before = text.slice(0, pos);
  const line = before.split("\n").length - 1;
  const lastNewline = before.lastIndexOf("\n");
  const col = lastNewline === -1 ? before.length : before.length - lastNewline - 1;
  return { line, col };
}

function posAtLineCol(text: string, line: number, col: number): number {
  const lines = text.split("\n");
  let pos = 0;
  for (let i = 0; i < line; i++) {
    pos += lines[i].length + 1;
  }
  const lineLen = lines[line]?.length ?? 0;
  return pos + Math.min(col, lineLen);
}

/** Alt/Option + ↑↓：上移或下移当前行（含多行选区），与常见编辑器行为一致。 */
export function moveLines(
  text: string,
  selStart: number,
  selEnd: number,
  direction: LineMoveDirection
): LineMoveResult | null {
  const lines = text.split("\n");
  if (lines.length <= 1) return null;

  const startLine = lineColAt(text, selStart).line;
  const endLine = selEnd === selStart ? startLine : lineColAt(text, Math.max(0, selEnd - 1)).line;

  if (direction === "up" && startLine === 0) return null;
  if (direction === "down" && endLine === lines.length - 1) return null;

  const startCol = lineColAt(text, selStart).col;
  const endCol = lineColAt(text, selEnd).col;

  let nextLines: string[];
  if (direction === "up") {
    const block = lines.slice(startLine, endLine + 1);
    const above = lines[startLine - 1];
    nextLines = [...lines.slice(0, startLine - 1), ...block, above, ...lines.slice(endLine + 1)];
  } else {
    const block = lines.slice(startLine, endLine + 1);
    const below = lines[endLine + 1];
    nextLines = [...lines.slice(0, startLine), below, ...block, ...lines.slice(endLine + 2)];
  }

  const nextText = nextLines.join("\n");
  const lineDelta = direction === "up" ? -1 : 1;

  return {
    text: nextText,
    selStart: posAtLineCol(nextText, startLine + lineDelta, startCol),
    selEnd: posAtLineCol(nextText, endLine + lineDelta, endCol)
  };
}

/** Shift + Alt/Option + ↑↓：复制当前行（含多行选区）到上方或下方，与常见编辑器行为一致。 */
export function duplicateLines(
  text: string,
  selStart: number,
  selEnd: number,
  direction: LineMoveDirection
): LineMoveResult | null {
  const lines = text.split("\n");

  const startLine = lineColAt(text, selStart).line;
  const endLine = selEnd === selStart ? startLine : lineColAt(text, Math.max(0, selEnd - 1)).line;
  const block = lines.slice(startLine, endLine + 1);

  const startCol = lineColAt(text, selStart).col;
  const endCol = lineColAt(text, selEnd).col;

  let nextLines: string[];
  let dupStartLine: number;
  let dupEndLine: number;

  if (direction === "up") {
    nextLines = [...lines.slice(0, startLine), ...block, ...lines.slice(startLine)];
    dupStartLine = startLine;
    dupEndLine = startLine + block.length - 1;
  } else {
    nextLines = [...lines.slice(0, endLine + 1), ...block, ...lines.slice(endLine + 1)];
    dupStartLine = endLine + 1;
    dupEndLine = endLine + block.length;
  }

  const nextText = nextLines.join("\n");

  return {
    text: nextText,
    selStart: posAtLineCol(nextText, dupStartLine, startCol),
    selEnd: posAtLineCol(nextText, dupEndLine, endCol)
  };
}
