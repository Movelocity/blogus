import type { ReactNode } from "react";

type ListItem = {
  text: string;
  checked: boolean | null;
};

type Block =
  | { type: "blockquote"; text: string }
  | { type: "code"; text: string }
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "hr" }
  | { type: "list"; ordered: boolean; items: ListItem[] }
  | { type: "paragraph"; text: string };

const UNORDERED_TASK_RE = /^[-*]\s+\[([ xX])\]\s?(.*)$/;
const UNORDERED_ITEM_RE = /^[-*]\s+(.+)$/;
const ORDERED_TASK_RE = /^\d+\.\s+\[([ xX])\]\s?(.*)$/;
const ORDERED_ITEM_RE = /^\d+\.\s+(.+)$/;

function parseListItem(line: string, ordered: boolean): ListItem | null {
  if (ordered) {
    const task = ORDERED_TASK_RE.exec(line);
    if (task) return { text: task[2] ?? "", checked: task[1] !== " " };
    const item = ORDERED_ITEM_RE.exec(line);
    if (item) return { text: item[1] ?? "", checked: null };
    return null;
  }
  const task = UNORDERED_TASK_RE.exec(line);
  if (task) return { text: task[2] ?? "", checked: task[1] !== " " };
  const item = UNORDERED_ITEM_RE.exec(line);
  if (item) return { text: item[1] ?? "", checked: null };
  return null;
}

function isListLine(line: string): boolean {
  return Boolean(parseListItem(line, false) || parseListItem(line, true));
}

function isThematicBreak(line: string): boolean {
  return /^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line);
}

function parseNoteContent(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (!line.trim()) {
      blocks.push({ type: "paragraph", text: "" });
      i += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]?.startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i += 1;
      }
      blocks.push({ type: "code", text: codeLines.join("\n") });
      i += 1;
      continue;
    }

    if (isThematicBreak(line)) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      });
      i += 1;
      continue;
    }

    const unorderedItem = parseListItem(line, false);
    const orderedItem = parseListItem(line, true);
    if (unorderedItem || orderedItem) {
      const isOrdered = Boolean(orderedItem) && !unorderedItem;
      const items: ListItem[] = [];
      while (i < lines.length) {
        const item = parseListItem(lines[i] ?? "", isOrdered);
        if (!item) break;
        items.push(item);
        i += 1;
      }
      blocks.push({ type: "list", ordered: isOrdered, items });
      continue;
    }

    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]?.startsWith(">")) {
        quoteLines.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "blockquote", text: quoteLines.join("\n") });
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i] ?? "";
      if (
        !cur.trim() ||
        cur.startsWith("```") ||
        /^(#{1,3})\s+/.test(cur) ||
        isListLine(cur) ||
        isThematicBreak(cur) ||
        cur.startsWith(">")
      ) {
        break;
      }
      paragraphLines.push(cur);
      i += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join("\n") });
  }

  return blocks;
}

/** 切换正文中第 index 个任务项（跳过代码块，与渲染顺序一致）。 */
export function toggleNoteChecklistItem(source: string, index: number): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let n = 0;
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trimStart();

    if (trimmed.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;

    const item = parseListItem(line, false) ?? parseListItem(line, true);
    if (!item || item.checked === null) continue;
    if (n !== index) {
      n += 1;
      continue;
    }

    const next = item.checked ? " " : "x";
    lines[i] = line.replace(/\[([ xX])\]/, `[${next}]`);
    return lines.join("\n");
  }
  return source;
}

// 链接识别：
// - http(s)://...（行首 / 空格 / 换行后；含 visit: http://... 这类冒号+空格）
// - visit：https://...（中英文冒号后紧跟 URL，无空格）
// 结尾：空格、换行或文本末尾
const AUTO_LINK_RE = /(^|[ \n]|[:：])(https?:\/\/\S+?)(?=[ \n]|$)/g;
const INLINE_RE = /(`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;

function renderAutoLinks(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  AUTO_LINK_RE.lastIndex = 0;
  while ((match = AUTO_LINK_RE.exec(text))) {
    if (match.index > cursor) {
      nodes.push(...renderInlineFormats(text.slice(cursor, match.index), `${keyPrefix}-t-${cursor}`));
    }

    const [, prefix, url] = match;
    const key = `${keyPrefix}-u-${match.index}`;
    if (prefix) {
      nodes.push(renderPlainText(prefix, `${key}-prefix`));
    }
    nodes.push(
      <a
        className="text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        href={url}
        key={key}
        rel="noopener noreferrer"
        target="_blank"
      >
        {url}
      </a>,
    );
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    nodes.push(...renderInlineFormats(text.slice(cursor), `${keyPrefix}-t-${cursor}`));
  }

  return nodes.length > 0 ? nodes : renderInlineFormats(text, keyPrefix);
}

function renderPlainText(text: string, key: string): ReactNode {
  return (
    <span className="whitespace-pre-wrap" key={key}>
      {text}
    </span>
  );
}

function renderInlineFormats(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(text))) {
    if (match.index > cursor) {
      nodes.push(renderPlainText(text.slice(cursor, match.index), `${keyPrefix}-t-${cursor}`));
    }

    const [, full, code, bold, italic] = match;
    const key = `${keyPrefix}-${match.index}-${full}`;

    if (code !== undefined) {
      nodes.push(
        <code
          className="whitespace-pre-wrap rounded bg-foreground/8 px-1 py-px font-mono text-[0.92em]"
          key={key}
        >
          {code}
        </code>,
      );
    } else if (bold !== undefined) {
      nodes.push(
        <strong className="whitespace-pre-wrap" key={key}>
          {bold}
        </strong>,
      );
    } else if (italic !== undefined) {
      nodes.push(
        <em className="whitespace-pre-wrap" key={key}>
          {italic}
        </em>,
      );
    }

    cursor = match.index + full!.length;
  }

  if (cursor < text.length) {
    nodes.push(renderPlainText(text.slice(cursor), `${keyPrefix}-t-${cursor}`));
  }

  return nodes;
}

function renderInline(text: string): ReactNode[] {
  return renderAutoLinks(text, "inline");
}

const HEADING_CLASS: Record<1 | 2 | 3, string> = {
  1: "font-semibold text-[1.06em]",
  2: "font-semibold text-[1.04em]",
  3: "font-semibold text-[1.02em]",
};

export function NoteContentView({
  content,
  emptyText = "暂无内容",
  onChecklistToggle,
}: {
  content: string;
  emptyText?: string;
  /** 点击任务列表复选框时回调，参数为切换后的全文 */
  onChecklistToggle?: (nextContent: string) => void;
}) {
  const blocks = parseNoteContent(content);

  if (blocks.length === 0) {
    return <p className="note-content m-0">{emptyText}</p>;
  }

  let checklistIndex = 0;

  return (
    <div className="note-content grid gap-0.5 whitespace-pre-wrap text-base leading-normal *:min-w-0">
      {blocks.map((block, idx) => {
        const key = `${block.type}-${idx}`;

        if (block.type === "heading") {
          const Heading = `h${block.level}` as "h1" | "h2" | "h3";
          return (
            <Heading className={`m-0 ${HEADING_CLASS[block.level]}`} key={key}>
              {renderInline(block.text)}
            </Heading>
          );
        }

        if (block.type === "code") {
          return (
            <pre
              className="m-0 overflow-x-hidden whitespace-pre-wrap break-words rounded border border-foreground/10 bg-foreground/[0.03] px-2 py-1.5 font-mono text-[0.9em] leading-snug"
              key={key}
            >
              {block.text}
            </pre>
          );
        }

        if (block.type === "hr") {
          return <hr className="my-1 border-0 border-t border-foreground/12" key={key} />;
        }

        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          const hasTasks = block.items.some((item) => item.checked !== null);
          return (
            <List
              className={`m-0 pl-4 ${
                hasTasks ? "list-none pl-0" : block.ordered ? "list-decimal" : "list-disc"
              }`}
              key={key}
            >
              {block.items.map((item, ii) => {
                if (item.checked === null) {
                  return (
                    <li className="leading-normal" key={`${key}-${ii}`}>
                      {renderInline(item.text)}
                    </li>
                  );
                }
                const itemIndex = checklistIndex;
                checklistIndex += 1;
                const interactive = Boolean(onChecklistToggle);
                return (
                  <li className="flex list-none items-start gap-2 leading-normal" key={`${key}-${ii}`}>
                    <input
                      type="checkbox"
                      checked={item.checked}
                      disabled={!interactive}
                      onChange={() => {
                        if (!onChecklistToggle) return;
                        onChecklistToggle(toggleNoteChecklistItem(content, itemIndex));
                      }}
                      className="mt-[0.2em] size-3.5 shrink-0 cursor-pointer accent-foreground disabled:cursor-default"
                    />
                    <span
                      className={
                        item.checked ? "text-muted-foreground line-through decoration-foreground/30" : ""
                      }
                    >
                      {renderInline(item.text)}
                    </span>
                  </li>
                );
              })}
            </List>
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote
              className="m-0 border-l-2 border-foreground/25 pl-3 whitespace-pre-wrap"
              key={key}
            >
              {renderInline(block.text)}
            </blockquote>
          );
        }

        if (!block.text) {
          return <p aria-hidden="true" className="m-0 min-h-[1lh]" key={key} />;
        }

        return (
          <p className="m-0 break-words" key={key}>
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
