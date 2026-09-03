import type { HlMode } from "@blogus/shared";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrap(className: string, value: string) {
  return `<span class="${className}">${value}</span>`;
}

function highlightJson(code: string) {
  return escapeHtml(code).replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    (match, quoted, colon) => {
      if (quoted) {
        return colon ? `${wrap("tc-json-key", quoted)}${colon}` : wrap("tc-json-string", quoted);
      }
      if (match === "true" || match === "false" || match === "null") return wrap("tc-json-keyword", match);
      return wrap("tc-json-number", match);
    }
  );
}

function highlightShell(code: string) {
  return escapeHtml(code)
    .replace(/(^|\n)(#.*)/g, (_, prefix, comment) => `${prefix}${wrap("tc-sh-comment", comment)}`)
    .replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, (match) => wrap("tc-sh-string", match))
    .replace(
      /\b(if|then|else|fi|for|do|done|case|esac|function|return|export|local|while|in)\b/g,
      (match) => wrap("tc-sh-keyword", match)
    );
}

function highlightMarkdown(code: string) {
  return escapeHtml(code)
    .replace(/^#{1,6}\s.+$/gm, (line) => wrap("tc-md-heading", line))
    .replace(/`[^`]+`/g, (match) => wrap("tc-sh-string", match));
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
  if (mode === "json") return highlightJson(code);
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
