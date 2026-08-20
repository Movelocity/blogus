export type SlashCommandId = "image" | "link";

export type SlashCommand = {
  id: SlashCommandId;
  name: string;
  hint: string;
};

export type SlashMatch = {
  /** `/` 在正文中的下标 */
  start: number;
  /** 光标位置（不含） */
  end: number;
  /** `/` 之后、光标之前的查询串，不含空格 */
  query: string;
};

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: "image", name: "image", hint: "上传并插入图片" },
  { id: "link", name: "link", hint: "插入 Markdown 链接" },
];

/**
 * 从光标向前找最近的 `/`。遇到空格立即结束（不匹配）。
 * `/` 须位于行首或空白之后，避免误伤 URL 路径。
 */
export function detectSlashQuery(value: string, cursor: number): SlashMatch | null {
  if (cursor < 1 || cursor > value.length) return null;

  let i = cursor - 1;
  while (i >= 0) {
    const ch = value[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") return null;
    if (ch === "/") {
      if (i > 0 && !/\s/.test(value[i - 1] ?? "")) return null;
      return { start: i, end: cursor, query: value.slice(i + 1, cursor) };
    }
    i -= 1;
  }
  return null;
}

function slashScore(name: string, q: string): number {
  if (name === q) return 2;
  if (name.startsWith(q)) return 1 + q.length / name.length;
  return 0;
}

export function matchSlashCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase();
  // 空查询按原顺序列出全部；有输入时按前缀过滤，匹配度高的在前
  if (!q) return [...SLASH_COMMANDS];
  return SLASH_COMMANDS
    .filter((cmd) => cmd.name.startsWith(q))
    .sort((a, b) => slashScore(b.name, q) - slashScore(a.name, q));
}
