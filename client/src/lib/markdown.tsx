import { useState, useEffect, type ReactNode } from "react";
import hljs from "highlight.js/lib/common";
import "highlight.js/styles/github-dark.min.css";

// Lazy KaTeX loader - caches the import promise
let katexPromise: Promise<typeof import("katex").default> | null = null;

async function loadKaTeX() {
  if (!katexPromise) {
    katexPromise = Promise.all([
      import("katex").then((mod) => mod.default),
      import("katex/dist/katex.min.css"),
    ]).then(([katex]) => katex);
  }
  return katexPromise;
}

type Alignment = "left" | "center" | "right" | null;

type ListItem = {
  text: string;
  /** 任务列表：true 已勾选，false 未勾选；普通列表项为 null */
  checked: boolean | null;
};

type Block =
  | { type: "blockquote"; text: string }
  | { type: "code"; lang: string; text: string }
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "list"; ordered: boolean; items: ListItem[] }
  | { type: "math"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "table"; headers: string[]; alignments: Alignment[]; rows: string[][] };

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

/**
 * 切换正文中第 index 个任务项（跳过代码块 / 数学块，与渲染顺序一致）。
 */
export function toggleChecklistItem(source: string, index: number): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let n = 0;
  let inCode = false;
  let inMath = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trimStart();

    if (!inMath && trimmed.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;

    if (trimmed.startsWith("$$")) {
      const rest = trimmed.slice(2);
      if (!(rest.trimEnd().endsWith("$$") && rest.trimEnd().length > 2)) {
        inMath = !inMath;
      }
      continue;
    }
    if (inMath) continue;

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

function isSafeUrl(url: string) {
  const trimmed = url.trim();
  return (
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:")
  );
}

function parseTableRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function parseAlignment(separator: string): Alignment {
  const s = separator.trim();
  if (s.startsWith(":") && s.endsWith(":")) return "center";
  if (s.endsWith(":")) return "right";
  if (s.startsWith(":")) return "left";
  return null;
}

const TABLE_SEP_RE = /^\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/;

export function slugify(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/[`*~\[\]()!]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseMarkdown(source: string, options: { breaks?: boolean } = {}) {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // --- Math block: $$ ... $$ ---
    if (line.trimStart().startsWith("$$")) {
      const rest = line.trimStart().slice(2);
      if (rest.trimEnd().endsWith("$$") && rest.trimEnd().length > 2) {
        blocks.push({ type: "math", text: rest.trimEnd().slice(0, -2).trim() });
        i += 1;
        continue;
      }
      const mathLines: string[] = [];
      if (rest.trim()) mathLines.push(rest);
      i += 1;
      while (i < lines.length) {
        const cur = lines[i] ?? "";
        if (cur.trimEnd().endsWith("$$")) {
          const last = cur.trimEnd().slice(0, -2);
          if (last.trim()) mathLines.push(last);
          i += 1;
          break;
        }
        mathLines.push(cur);
        i += 1;
      }
      blocks.push({ type: "math", text: mathLines.join("\n") });
      continue;
    }

    // --- Code block ---
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]?.startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i += 1;
      }
      blocks.push({ type: "code", lang, text: codeLines.join("\n") });
      i += 1;
      continue;
    }

    // --- Heading ---
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

    // --- Table ---
    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1] ?? "")) {
      const headers = parseTableRow(line);
      const alignments = parseTableRow(lines[i + 1] ?? "").map(parseAlignment);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length) {
        const rowLine = lines[i] ?? "";
        if (!rowLine.includes("|") || !rowLine.trim()) break;
        rows.push(parseTableRow(rowLine));
        i += 1;
      }
      blocks.push({ type: "table", headers, alignments, rows });
      continue;
    }

    // --- List（含 GFM 任务列表 - [ ] / 1. [x]）---
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

    // --- Blockquote ---
    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]?.startsWith(">")) {
        quoteLines.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "blockquote", text: quoteLines.join(options.breaks ? "\n" : " ") });
      continue;
    }

    // --- Paragraph ---
    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i] ?? "";
      if (
        !cur.trim() ||
        cur.startsWith("```") ||
        cur.trimStart().startsWith("$$") ||
        /^(#{1,3})\s+/.test(cur) ||
        isListLine(cur) ||
        cur.startsWith(">") ||
        (cur.includes("|") && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1] ?? ""))
      ) {
        break;
      }
      paragraphLines.push(cur);
      i += 1;
    }
    // 默认按 CommonMark 把软换行收成空格；notes 等场景用 breaks 保留行内换行
    blocks.push({ type: "paragraph", text: paragraphLines.join(options.breaks ? "\n" : " ") });
  }

  return blocks;
}

export interface HeadingItem {
  level: 1 | 2 | 3;
  text: string;
  slug: string;
}

export function getHeadings(source: string): HeadingItem[] {
  return parseMarkdown(source)
    .filter((b): b is typeof b & { type: "heading" } => b.type === "heading")
    .map((b) => ({ level: b.level, text: b.text, slug: slugify(b.text) }));
}

// KaTeX renderer component with lazy loading
function KaTeXRenderer({ tex, displayMode }: { tex: string; displayMode: boolean }) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    
    loadKaTeX()
      .then((katex) => {
        if (cancelled) return;
        try {
          const rendered = katex.renderToString(tex, { 
            displayMode, 
            throwOnError: false, 
            strict: false 
          });
          setHtml(rendered);
        } catch {
          setError(true);
        } finally {
          setLoading(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tex, displayMode]);

  if (loading) {
    return <span className="animate-pulse bg-secondary/30 px-2 py-1 rounded">Loading...</span>;
  }

  if (error) {
    return <span className="text-destructive">{tex}</span>;
  }

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlightCode(code: string, lang: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(code, { language: lang }).value;
    } catch {
      /* fall through */
    }
  }
  return escapeHtml(code);
}

const INLINE_RE =
  /(!?\[([^\]]*)\]\(([^)]+)\)|`([^`]+)`|\$([^$\n]+?)\$|\*\*([^*]+)\*\*|\*([^*]+)\*|~~([^~]+)~~)/g;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(text))) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    const [, full, label, url, code, inlineMath, bold, italic, strikethrough] = match;
    const key = `${match.index}-${full}`;

    if (full!.startsWith("![")) {
      nodes.push(
        isSafeUrl(url!) ? (
          <img alt={label} className="my-6 max-h-[560px] object-contain rounded-xl shadow-sm" key={key} src={url} />
        ) : (
          label
        ),
      );
    } else if (label !== undefined && url !== undefined) {
      nodes.push(
        isSafeUrl(url) ? (
          <a
            className="font-base hover:underline underline-offset-4 transition-colors hover:text-accent"
            href={url}
            key={key}
            target="_blank"
          >
            {label || url}
          </a>
        ) : (
          label || url
        ),
      );
    } else if (code !== undefined) {
      nodes.push(
        <code className="bg-secondary/20 rounded-md px-1.5 py-0.5 font-mono text-[0.92em]" key={key}>
          {code}
        </code>,
      );
    } else if (inlineMath !== undefined) {
      nodes.push(
        <KaTeXRenderer key={key} tex={inlineMath} displayMode={false} />,
      );
    } else if (bold !== undefined) {
      nodes.push(<strong key={key}>{bold}</strong>);
    } else if (italic !== undefined) {
      nodes.push(<em key={key}>{italic}</em>);
    } else if (strikethrough !== undefined) {
      nodes.push(<del key={key}>{strikethrough}</del>);
    }

    cursor = match.index + full!.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

export function MarkdownView({
  content,
  emptyText = "暂无内容",
  breaks = false,
  compact = false,
  underlineH1 = false,
  onChecklistToggle,
}: {
  content: string;
  emptyText?: string;
  /** 为 true 时保留段落内的单个换行（不被 Markdown 收成空格） */
  breaks?: boolean;
  /** 笔记等紧凑场景：缩小列表间距 */
  compact?: boolean;
  /** 文章查看：一级标题全宽下划线 */
  underlineH1?: boolean;
  /** 点击任务列表复选框时回调，参数为切换后的全文 */
  onChecklistToggle?: (nextContent: string) => void;
}) {
  const blocks = parseMarkdown(content, { breaks });
  let checklistIndex = 0;

  if (blocks.length === 0) {
    return <p className="markdown-content m-0">{emptyText}</p>;
  }

  return (
    <div
      className={`markdown-content grid *:min-w-0 text-base ${
        compact ? "gap-2 leading-7" : "gap-3 leading-8"
      }`}
    >
      {blocks.map((block, idx) => {
        const key = `${block.type}-${idx}`;

        if (block.type === "heading") {
          const className =
            block.level === 1
              ? `mt-6 font-display text-4xl leading-tight tracking-tight ${
                  underlineH1 ? "w-full border-b border-foreground/20 pb-2" : ""
                }`
              : block.level === 2
                ? "mt-6 font-display text-3xl leading-tight tracking-tight"
                : "mt-4 font-display text-2xl leading-snug tracking-tight";
          const Heading = `h${block.level}` as "h1" | "h2" | "h3";
          const id = slugify(block.text);
          return (
            <Heading className={className} id={id} key={key}>
              {renderInline(block.text)}
            </Heading>
          );
        }

        if (block.type === "code") {
          const html = highlightCode(block.text, block.lang);
          return (
            <div className="group relative" key={key}>
              {block.lang && (
                <span className="absolute right-3 top-3 select-none font-mono text-xs text-primary-foreground/30 transition-opacity group-hover:text-primary-foreground/50">
                  {block.lang}
                </span>
              )}
              <pre className="overflow-x-auto bg-foreground p-5 font-mono text-sm leading-6 text-primary-foreground rounded-xl">
                <code
                  dangerouslySetInnerHTML={{ __html: html }}
                  style={{ background: "transparent", padding: 0 }}
                />
              </pre>
            </div>
          );
        }

        if (block.type === "math") {
          return (
            <div className="my-2 overflow-x-auto py-2 text-center" key={key}>
              <KaTeXRenderer tex={block.text} displayMode={true} />
            </div>
          );
        }

        if (block.type === "table") {
          return (
            <div className="my-2 overflow-x-auto" key={key}>
              <table className="w-full border-collapse text-[0.94em]">
                <thead>
                  <tr className="border-b-2 border-foreground/15">
                    {block.headers.map((header, hi) => (
                      <th
                        className="px-4 py-3 text-left font-semibold min-w-32"
                        key={hi}
                        style={{ textAlign: block.alignments[hi] ?? "left" }}
                      >
                        {renderInline(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, ri) => (
                    <tr className="border-b border-foreground/8 transition-colors hover:bg-secondary/10" key={ri}>
                      {row.map((cell, ci) => (
                        <td
                          className="px-4 py-3"
                          key={ci}
                          style={{ textAlign: block.alignments[ci] ?? "left" }}
                        >
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          const hasTasks = block.items.some((item) => item.checked !== null);
          return (
            <List
              className={`grid ${compact ? "gap-0.5 leading-6" : "gap-2 leading-8"} pl-6 ${
                hasTasks ? "list-none pl-0" : block.ordered ? "list-decimal" : "list-disc"
              }`}
              key={key}
            >
              {block.items.map((item, ii) => {
                if (item.checked === null) {
                  return (
                    <li
                      key={`${key}-${ii}`}
                      className={hasTasks ? (block.ordered ? "list-decimal ml-6" : "list-disc ml-6") : undefined}
                    >
                      {renderInline(item.text)}
                    </li>
                  );
                }
                const itemIndex = checklistIndex;
                checklistIndex += 1;
                const interactive = Boolean(onChecklistToggle);
                return (
                  <li key={`${key}-${ii}`} className="flex list-none items-start gap-2">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      disabled={!interactive}
                      onChange={() => {
                        if (!onChecklistToggle) return;
                        onChecklistToggle(toggleChecklistItem(content, itemIndex));
                      }}
                      className="mt-[0.35em] size-4 shrink-0 cursor-pointer accent-foreground disabled:cursor-default"
                    />
                    <span className={item.checked ? "text-muted-foreground line-through decoration-foreground/30" : ""}>
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
              className={`border-l-4 border-foreground/20 bg-trinary px-5 py-4 rounded-lg ${breaks ? "whitespace-pre-wrap" : ""}`}
              key={key}
            >
              {renderInline(block.text)}
            </blockquote>
          );
        }

        return (
          <p className={`m-0 leading-8 break-all ${breaks ? "whitespace-pre-wrap" : ""}`} key={key}>
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
