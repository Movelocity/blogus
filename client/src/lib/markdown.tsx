import { useEffect, useState, type ReactNode } from "react";
import { ListDashesIcon } from "@phosphor-icons/react";
import hljs from "highlight.js/lib/common";

// Lazy KaTeX loader - caches the import promise
let katexPromise: Promise<typeof import("katex").default> | null = null;

async function loadKaTeX() {
  if (!katexPromise) {
    katexPromise = Promise.all([
      import("katex").then((mod) => mod.default),
      import("katex/dist/katex.min.css"),
    ])
      .then(([katex]) => katex)
      .catch((error: unknown) => {
        katexPromise = null;
        throw error;
      });
  }
  return katexPromise;
}

type KaTeX = Awaited<ReturnType<typeof loadKaTeX>>;

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

const INLINE_MATH_RE = /\$[^$\n]+?\$/;

function blockContainsMath(block: Block): boolean {
  if (block.type === "math") return true;
  if (block.type === "code") return false;
  if (block.type === "list") return block.items.some((item) => INLINE_MATH_RE.test(item.text));
  if (block.type === "table") {
    return [...block.headers, ...block.rows.flat()].some((cell) => INLINE_MATH_RE.test(cell));
  }
  return INLINE_MATH_RE.test(block.text);
}

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

/** 在文章数据到达后立即请求公式资源，与文章页首次渲染并行。 */
export function preloadMathRendering(source: string): void {
  if (parseMarkdown(source).some(blockContainsMath)) {
    void loadKaTeX().catch(() => {
      // 实际渲染仍会保留 TeX 源文本，预加载失败无需阻断文章展示。
    });
  }
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

function KaTeXRenderer({ katex, tex, displayMode }: { katex: KaTeX | null; tex: string; displayMode: boolean }) {
  if (!katex) {
    // 加载期间保留原始公式，避免每个公式各自显示 Loading 造成布局抖动。
    return <span className="font-mono text-[0.92em]">{displayMode ? `$$${tex}$$` : `$${tex}$`}</span>;
  }

  const html = katex.renderToString(tex, {
    displayMode,
    throwOnError: false,
    strict: false,
  });
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

function renderInline(text: string, katex: KaTeX | null): ReactNode[] {
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
        <KaTeXRenderer katex={katex} key={key} tex={inlineMath} displayMode={false} />,
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

function MarkdownCodeBlock({
  html,
  lang,
  compact,
}: {
  html: string;
  lang: string;
  compact: boolean;
}) {
  const [wrap, setWrap] = useState(false);
  const codePad = compact ? "px-3 py-2" : "px-4 py-3";
  const codeRadius = compact ? "rounded-lg" : "rounded-xl";
  const corner = compact ? "right-2 top-2" : "right-3 top-3";

  return (
    <div className="group relative">
      <div className={`absolute z-10 flex items-center gap-1.5 ${corner}`}>
        {lang ? (
          <span className="select-none font-mono text-xs text-muted-foreground/50 transition-opacity group-hover:text-muted-foreground/70">
            {lang}
          </span>
        ) : null}
        <button
          type="button"
          aria-label={wrap ? "取消自动换行" : "自动换行"}
          aria-pressed={wrap}
          title={wrap ? "取消自动换行" : "自动换行"}
          onClick={() => setWrap((on) => !on)}
          className={`rounded p-0.5 transition-colors hover:bg-foreground/10 ${
            wrap ? "text-foreground/80" : "text-muted-foreground/50 group-hover:text-muted-foreground/70"
          }`}
        >
          <ListDashesIcon size={14} weight={wrap ? "bold" : "regular"} />
        </button>
      </div>
      <pre
        className={`bg-muted font-mono text-sm leading-6 text-foreground ${codePad} ${codeRadius} ${
          wrap ? "overflow-x-hidden whitespace-pre-wrap break-all" : "overflow-x-auto"
        }`}
      >
        <code
          className="hljs"
          dangerouslySetInnerHTML={{ __html: html }}
          style={{ background: "transparent", padding: 0 }}
        />
      </pre>
    </div>
  );
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
  const hasMath = blocks.some(blockContainsMath);
  const [katex, setKatex] = useState<KaTeX | null>(null);

  useEffect(() => {
    if (!hasMath) return;
    let cancelled = false;
    loadKaTeX()
      .then((loaded) => {
        if (!cancelled) setKatex(() => loaded);
      })
      .catch(() => {
        // 网络失败时保留可读的 TeX 源文本，避免整篇 Markdown 渲染失败。
      });
    return () => {
      cancelled = true;
    };
  }, [hasMath]);

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
              ? `mt-6 font-display text-3xl leading-tight tracking-tight ${
                  underlineH1 ? "w-full border-b border-foreground/20 pb-2" : ""
                }`
              : block.level === 2
                ? "mt-6 font-display text-2xl leading-tight tracking-tight"
                : "mt-4 font-display text-xl leading-snug tracking-tight";
          const Heading = `h${block.level}` as "h1" | "h2" | "h3";
          const id = slugify(block.text);
          return (
            <Heading className={className} id={id} key={key}>
              {renderInline(block.text, katex)}
            </Heading>
          );
        }

        if (block.type === "code") {
          const html = highlightCode(block.text, block.lang);
          return (
            <MarkdownCodeBlock key={key} compact={compact} html={html} lang={block.lang} />
          );
        }

        if (block.type === "math") {
          return (
            <div className="my-2 overflow-x-auto py-2 text-center" key={key}>
              <KaTeXRenderer katex={katex} tex={block.text} displayMode={true} />
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
                        {renderInline(header, katex)}
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
                          {renderInline(cell, katex)}
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
                      {renderInline(item.text, katex)}
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
                      {renderInline(item.text, katex)}
                    </span>
                  </li>
                );
              })}
            </List>
          );
        }

        if (block.type === "blockquote") {
          const quotePad = compact ? "px-3 py-2" : "px-4 py-3";
          return (
            <blockquote
              className={`rounded-lg border-l-4 border-foreground/20 bg-trinary ${quotePad} ${breaks ? "whitespace-pre-wrap" : ""}`}
              key={key}
            >
              {renderInline(block.text, katex)}
            </blockquote>
          );
        }

        return (
          <p className={`m-0 leading-8 break-all ${breaks ? "whitespace-pre-wrap" : ""}`} key={key}>
            {renderInline(block.text, katex)}
          </p>
        );
      })}
    </div>
  );
}
