import type { ReactNode } from "react";

type Block =
  | { type: "blockquote"; text: string }
  | { type: "code"; text: string }
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "paragraph"; text: string };

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

function parseMarkdown(source: string) {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]?.startsWith("```")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      blocks.push({ type: "code", text: codeLines.join("\n") });
      index += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2]
      });
      index += 1;
      continue;
    }

    const unordered = /^[-*]\s+(.+)$/.exec(line);
    const ordered = /^\d+\.\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered);
      const items: string[] = [];
      while (index < lines.length) {
        const item = isOrdered
          ? /^\d+\.\s+(.+)$/.exec(lines[index] ?? "")
          : /^[-*]\s+(.+)$/.exec(lines[index] ?? "");
        if (!item) {
          break;
        }
        items.push(item[1]);
        index += 1;
      }
      blocks.push({ type: "list", ordered: isOrdered, items });
      continue;
    }

    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index]?.startsWith(">")) {
        quoteLines.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "blockquote", text: quoteLines.join(" ") });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index] ?? "";
      if (
        !current.trim() ||
        current.startsWith("```") ||
        /^(#{1,3})\s+/.test(current) ||
        /^[-*]\s+/.test(current) ||
        /^\d+\.\s+/.test(current) ||
        current.startsWith(">")
      ) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(!?\[([^\]]*)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    const [, full, label, url, code, bold, italic] = match;
    const key = `${match.index}-${full}`;
    if (full.startsWith("![")) {
      nodes.push(
        isSafeUrl(url) ? (
          <img alt={label} className="my-4 max-h-[520px] w-full rounded-md object-contain" key={key} src={url} />
        ) : (
          label
        )
      );
    } else if (label !== undefined && url !== undefined) {
      nodes.push(
        isSafeUrl(url) ? (
          <a className="font-medium text-teal-700 underline-offset-4 hover:underline" href={url} key={key}>
            {label || url}
          </a>
        ) : (
          label || url
        )
      );
    } else if (code !== undefined) {
      nodes.push(
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.92em] text-slate-900" key={key}>
          {code}
        </code>
      );
    } else if (bold !== undefined) {
      nodes.push(<strong key={key}>{bold}</strong>);
    } else if (italic !== undefined) {
      nodes.push(<em key={key}>{italic}</em>);
    }

    cursor = match.index + full.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

export function MarkdownView({ content, emptyText = "暂无内容" }: { content: string; emptyText?: string }) {
  const blocks = parseMarkdown(content);

  if (blocks.length === 0) {
    return <p className="m-0 text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="grid gap-4 text-slate-800">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "heading") {
          const className =
            block.level === 1
              ? "mt-2 text-3xl font-bold leading-tight text-slate-950"
              : block.level === 2
                ? "mt-2 text-2xl font-semibold leading-tight text-slate-950"
                : "mt-1 text-xl font-semibold leading-snug text-slate-950";
          const Heading = `h${block.level}` as "h1" | "h2" | "h3";
          return (
            <Heading className={className} key={key}>
              {renderInline(block.text)}
            </Heading>
          );
        }
        if (block.type === "code") {
          return (
            <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-sm text-slate-100" key={key}>
              <code>{block.text}</code>
            </pre>
          );
        }
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List className={`grid gap-2 pl-6 ${block.ordered ? "list-decimal" : "list-disc"}`} key={key}>
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{renderInline(item)}</li>
              ))}
            </List>
          );
        }
        if (block.type === "blockquote") {
          return (
            <blockquote className="border-l-4 border-teal-700 bg-teal-50 px-4 py-3 text-slate-700" key={key}>
              {renderInline(block.text)}
            </blockquote>
          );
        }
        return (
          <p className="m-0 leading-7 text-slate-700" key={key}>
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
