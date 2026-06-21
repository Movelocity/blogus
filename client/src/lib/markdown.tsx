import type { ReactNode } from "react";
import hljs from "highlight.js/lib/common";
import "highlight.js/styles/github-dark.min.css";
import katex from "katex";
import "katex/dist/katex.min.css";

type Alignment = "left" | "center" | "right" | null;

type Block =
  | { type: "blockquote"; text: string }
  | { type: "code"; lang: string; text: string }
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "math"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "table"; headers: string[]; alignments: Alignment[]; rows: string[][] };

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

function parseMarkdown(source: string) {
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

    // --- List ---
    const unordered = /^[-*]\s+(.+)$/.exec(line);
    const ordered = /^\d+\.\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered);
      const items: string[] = [];
      while (i < lines.length) {
        const item = isOrdered
          ? /^\d+\.\s+(.+)$/.exec(lines[i] ?? "")
          : /^[-*]\s+(.+)$/.exec(lines[i] ?? "");
        if (!item) break;
        items.push(item[1]);
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
      blocks.push({ type: "blockquote", text: quoteLines.join(" ") });
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
        /^[-*]\s+/.test(cur) ||
        /^\d+\.\s+/.test(cur) ||
        cur.startsWith(">") ||
        (cur.includes("|") && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1] ?? ""))
      ) {
        break;
      }
      paragraphLines.push(cur);
      i += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
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

function renderKatex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false, strict: false });
  } catch {
    return tex;
  }
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
          <img alt={label} className="my-6 max-h-[560px] w-full object-contain rounded-xl shadow-sm" key={key} src={url} />
        ) : (
          label
        ),
      );
    } else if (label !== undefined && url !== undefined) {
      nodes.push(
        isSafeUrl(url) ? (
          <a
            className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
            href={url}
            key={key}
          >
            {label || url}
          </a>
        ) : (
          label || url
        ),
      );
    } else if (code !== undefined) {
      nodes.push(
        <code className="bg-secondary px-1.5 py-0.5 font-mono text-[0.92em] text-foreground" key={key}>
          {code}
        </code>,
      );
    } else if (inlineMath !== undefined) {
      nodes.push(
        <span dangerouslySetInnerHTML={{ __html: renderKatex(inlineMath, false) }} key={key} />,
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

export function MarkdownView({ content, emptyText = "暂无内容" }: { content: string; emptyText?: string }) {
  const blocks = parseMarkdown(content);

  if (blocks.length === 0) {
    return <p className="m-0 text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="grid gap-3 *:min-w-0 text-base leading-8 text-foreground/80">
      {blocks.map((block, idx) => {
        const key = `${block.type}-${idx}`;

        if (block.type === "heading") {
          const className =
            block.level === 1
              ? "mt-6 font-display text-4xl leading-tight tracking-tight text-foreground"
              : block.level === 2
                ? "mt-6 font-display text-3xl leading-tight tracking-tight text-foreground"
                : "mt-4 font-display text-2xl leading-snug tracking-tight text-foreground";
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
            <div
              className="my-2 overflow-x-auto py-2 text-center"
              dangerouslySetInnerHTML={{ __html: renderKatex(block.text, true) }}
              key={key}
            />
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
                        className="px-4 py-3 text-left font-semibold text-foreground min-w-32"
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
                    <tr className="border-b border-foreground/8 transition-colors hover:bg-secondary/50" key={ri}>
                      {row.map((cell, ci) => (
                        <td
                          className="px-4 py-3 text-foreground/70"
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
          return (
            <List className={`grid gap-2 pl-6 leading-8 ${block.ordered ? "list-decimal" : "list-disc"}`} key={key}>
              {block.items.map((item, ii) => (
                <li key={`${key}-${ii}`}>{renderInline(item)}</li>
              ))}
            </List>
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote
              className="border-l-2 border-foreground/20 bg-secondary px-5 py-4 text-muted-foreground"
              key={key}
            >
              {renderInline(block.text)}
            </blockquote>
          );
        }

        return (
          <p className="m-0 leading-8 text-foreground/70 break-all" key={key}>
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
