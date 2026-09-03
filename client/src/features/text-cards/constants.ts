import type { HlMode } from "@blogus/shared";

export const DEFAULT_PANE_WIDTH = 560;
export const DEFAULT_PANE_HEIGHT = 280;
export const MIN_PANE_HEIGHT = 120;
export const MIN_PANE_WIDTH = 80;
export const SAVE_DEBOUNCE_MS = 600;
export const ACTIVE_WORKSPACE_KEY = "blogus:text-cards:active-workspace";
export const TOP_BAR_HEIGHT = 48;
export const CANVAS_PADDING = 120;
export const POSITION_STAGGER = 32;
export const CANVAS_MIN_WIDTH = 1200;
export const CANVAS_MIN_HEIGHT = 800;

export const HL_MODE_OPTIONS: { value: HlMode; label: string }[] = [
  { value: "", label: "Raw" },
  { value: "json", label: "JSON" },
  { value: "sh", label: "Shell" },
  { value: "md", label: "Markdown" },
  { value: "js", label: "JavaScript" },
  { value: "ts", label: "TypeScript" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "sql", label: "SQL" },
  { value: "yaml", label: "YAML" },
  { value: "py", label: "Python" },
  { value: "text", label: "Text" }
];
