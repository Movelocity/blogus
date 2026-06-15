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
        text: heading[2],
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
          <img alt={label} className="my-6 max-h-[560px] w-full object-contain" key={key} src={url} />
        ) : (
          label
        )
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
        )
      );
    } else if (code !== undefined) {
      nodes.push(
        <code className="bg-secondary px-1.5 py-0.5 font-mono text-[0.92em] text-foreground" key={key}>
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
    return <p className="m-0 text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="grid gap-5 text-[17px] leading-8 text-foreground/80 max-sm:text-base">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "heading") {
          const className =
            block.level === 1
              ? "mt-6 font-display text-4xl leading-tight tracking-tight text-foreground"
              : block.level === 2
                ? "mt-6 font-display text-3xl leading-tight tracking-tight text-foreground"
                : "mt-4 font-display text-2xl leading-snug tracking-tight text-foreground";
          const Heading = `h${block.level}` as "h1" | "h2" | "h3";
          return (
            <Heading className={className} key={key}>
              {renderInline(block.text)}
            </Heading>
          );
        }
        if (block.type === "code") {
          return (
            <pre className="overflow-x-auto bg-foreground p-5 font-mono text-sm leading-6 text-primary-foreground" key={key}>
              <code>{block.text}</code>
            </pre>
          );
        }
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List className={`grid gap-2 pl-6 leading-8 ${block.ordered ? "list-decimal" : "list-disc"}`} key={key}>
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{renderInline(item)}</li>
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
          <p className="m-0 leading-8 text-foreground/70" key={key}>
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
