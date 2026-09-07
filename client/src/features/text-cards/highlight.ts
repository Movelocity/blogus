import type { HlMode } from "@blogus/shared";

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrap(className: string, value: string) {
  return `<span class="${className}">${value}</span>`;
}

function emptyPlaceholder() {
  return '<span class="tc-hl-empty">无内容</span>';
}

function isValidJSON(str: string) {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

function extractJSON(text: string, startIndex: number) {
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  let buf = "";
  let endIndex = startIndex;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      buf += ch;
      endIndex = i + 1;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      buf += ch;
      endIndex = i + 1;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      buf += ch;
      endIndex = i + 1;
      continue;
    }
    if (inString) {
      buf += ch;
      endIndex = i + 1;
      continue;
    }

    if (ch === "{" || ch === "[") {
      stack.push(ch);
      buf += ch;
      endIndex = i + 1;
    } else if (ch === "}" || ch === "]") {
      const expected = ch === "}" ? "{" : "[";
      if (stack.length > 0 && stack[stack.length - 1] === expected) {
        stack.pop();
        buf += ch;
        endIndex = i + 1;
        if (stack.length === 0) {
          return { json: buf, endIndex, isValid: isValidJSON(buf) };
        }
      } else {
        return { json: buf, endIndex, isValid: false };
      }
    } else {
      buf += ch;
      endIndex = i + 1;
    }

    if (buf.length > 100000) break;
  }

  return null;
}

function syntaxHighlight(jsonStr: string) {
  return jsonStr.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "tc-json-number";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "tc-json-key" : "tc-json-string";
      } else if (/true|false/.test(match)) {
        cls = "tc-json-boolean";
      } else if (/null/.test(match)) {
        cls = "tc-json-null";
      }
      return wrap(cls, match);
    }
  );
}

function scanAndHighlight(text: string) {
  if (!text.trim()) return emptyPlaceholder();

  let result = "";
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (ch === "{" || ch === "[") {
      const extracted = extractJSON(text, i);
      if (extracted) {
        if (extracted.isValid) {
          try {
            const formatted = JSON.stringify(JSON.parse(extracted.json), null, 2);
            result += syntaxHighlight(formatted);
          } catch {
            result += escapeHtml(extracted.json);
          }
        } else {
          result += escapeHtml(extracted.json);
        }
        i = extracted.endIndex;
        continue;
      }
    }
    result += escapeHtml(ch);
    i++;
  }

  return result || emptyPlaceholder();
}

function highlightShell(text: string) {
  if (!text.trim()) return emptyPlaceholder();

  const lines = text.split("\n");
  const result = lines.map((line) => {
    if (/^\s*#/.test(line)) {
      return wrap("tc-sh-comment", escapeHtml(line));
    }

    let out = "";
    let i = 0;
    const raw = line;

    while (i < raw.length) {
      if (raw[i] === "#") {
        out += wrap("tc-sh-comment", escapeHtml(raw.slice(i)));
        break;
      }
      if (raw[i] === '"') {
        let j = i + 1;
        while (j < raw.length && !(raw[j] === '"' && raw[j - 1] !== "\\")) j++;
        if (j < raw.length) j++;
        out += wrap("tc-sh-string", escapeHtml(raw.slice(i, j)));
        i = j;
        continue;
      }
      if (raw[i] === "'") {
        let j = i + 1;
        while (j < raw.length && raw[j] !== "'") j++;
        if (j < raw.length) j++;
        out += wrap("tc-sh-string", escapeHtml(raw.slice(i, j)));
        i = j;
        continue;
      }
      if (raw[i] === "$") {
        const m = raw.slice(i).match(/^\$(\{[^}]*\}|[A-Za-z_][A-Za-z0-9_]*|\d+|[@#?$!*])/);
        if (m) {
          out += wrap("tc-sh-var", escapeHtml(m[0]));
          i += m[0].length;
          continue;
        }
      }
      const kwMatch = raw
        .slice(i)
        .match(/^(if|then|else|elif|fi|for|do|done|while|until|case|esac|in|function|return|export|local|readonly|shift|source|\.)\b/);
      if (kwMatch && (i === 0 || /\W/.test(raw[i - 1]))) {
        out += wrap("tc-sh-keyword", escapeHtml(kwMatch[0]));
        i += kwMatch[0].length;
        continue;
      }
      out += escapeHtml(raw[i]);
      i++;
    }

    return out;
  });

  return result.join("\n");
}

function highlightMarkdown(text: string) {
  if (!text.trim()) return emptyPlaceholder();

  const CODE_BLOCK_RE = /```[\s\S]*?```/g;
  const INLINE_CODE_RE = /`[^`\n]+`/g;

  const codeBlocks: string[] = [];
  let processed = text.replace(CODE_BLOCK_RE, (match) => {
    const idx = codeBlocks.length;
    codeBlocks.push(wrap("tc-md-code", escapeHtml(match)));
    return `\x00CODE${idx}\x00`;
  });
  processed = processed.replace(INLINE_CODE_RE, (match) => {
    const idx = codeBlocks.length;
    codeBlocks.push(wrap("tc-md-code", escapeHtml(match).replace(/`/g, "")));
    return `\x00CODE${idx}\x00`;
  });

  const lines = processed.split("\n");
  const result = lines.map((line) => {
    let out = line;

    const hMatch = out.match(/^(#{1,6})\s(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const inner = hMatch[2];
      return wrap(`tc-md-h${level}`, `${escapeHtml(hMatch[1])} ${escapeHtml(inner)}`);
    }

    if (/^\s*>/.test(out)) {
      return wrap("tc-md-blockquote", escapeHtml(out));
    }

    if (/^\s*([-*_])\s*\1\s*\1\s*$/.test(out)) {
      return wrap("tc-md-hr", escapeHtml(out));
    }

    out = out.replace(/^(\s*)([-*+]|\d+\.)(\s)/, (_match, sp: string, bullet: string, space: string) =>
      `${sp}${wrap("tc-md-bullet", escapeHtml(bullet))}${space}`
    );

    out = out.replace(/\*\*\*([^*\n]+)\*\*\*/g, (_match, inner: string) =>
      `<span class="tc-md-bold tc-md-italic">${escapeHtml(inner)}</span>`
    );
    out = out.replace(/\*\*([^*\n]+)\*\*/g, (_match, inner: string) => wrap("tc-md-bold", escapeHtml(inner)));
    out = out.replace(/~~([^~\n]+)~~/g, (_match, inner: string) => wrap("tc-md-strike", escapeHtml(inner)));
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, url: string) =>
      `[${wrap("tc-md-link-text", escapeHtml(label))}](${wrap("tc-md-url", escapeHtml(url))})`
    );

    return out;
  });

  let html = result.join("\n");
  html = html.replace(/\x00CODE(\d+)\x00/g, (_match, idx: string) => codeBlocks[parseInt(idx, 10)]);
  return html;
}

function highlightKeywords(code: string, keywords: string[]) {
  const pattern = new RegExp(`\\b(${keywords.join("|")})\\b`, "g");
  return escapeHtml(code)
    .replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g, (match) => wrap("tc-sh-string", match))
    .replace(/(\/\/.*|#.*)$/gm, (match) => wrap("tc-sh-comment", match))
    .replace(pattern, (match) => wrap("tc-sh-keyword", match));
}

const KEYWORDS: Partial<Record<HlMode, string[]>> = {
  js: ["const", "let", "var", "function", "return", "if", "else", "import", "export", "from", "async", "await"],
  ts: ["const", "let", "var", "function", "return", "if", "else", "import", "export", "from", "async", "await", "type", "interface"],
  html: ["html", "head", "body", "div", "span", "script", "style"],
  css: ["color", "background", "margin", "padding", "display", "flex"],
  sql: ["select", "from", "where", "insert", "into", "update", "delete", "join"],
  yaml: ["true", "false", "null"],
  py: ["def", "class", "import", "from", "return", "if", "elif", "else", "for", "while"]
};

export function highlightContent(code: string, mode: HlMode): string {
  if (!mode || mode === "text") return escapeHtml(code);
  if (mode === "json") return scanAndHighlight(code);
  if (mode === "sh") return highlightShell(code);
  if (mode === "md") return highlightMarkdown(code);
  if (mode === "xml" || mode === "html") return highlightKeywords(code, KEYWORDS.html ?? []);
  if (mode === "css") return highlightKeywords(code, KEYWORDS.css ?? []);
  if (mode === "sql") return highlightKeywords(code, KEYWORDS.sql ?? []);
  if (mode === "yaml") return highlightKeywords(code, KEYWORDS.yaml ?? []);
  if (mode === "py") return highlightKeywords(code, KEYWORDS.py ?? []);
  if (mode === "js") return highlightKeywords(code, KEYWORDS.js ?? []);
  if (mode === "ts") return highlightKeywords(code, KEYWORDS.ts ?? []);
  return escapeHtml(code);
}

export function hlModeLabel(mode: HlMode): string {
  if (mode === "sh") return "Shell";
  if (mode === "md") return "MD";
  if (mode === "json") return "JSON";
  if (!mode || mode === "text") return "Raw";
  return mode.toUpperCase();
}
