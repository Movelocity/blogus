import type { ImportTextCardPaneInput, TextCardPane } from "@blogus/shared";

export const BACKUP_APP = "text-cards";
export const BACKUP_VERSION = 1;

export interface TextCardsBackupV1 {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  panes: BackupPaneV1[];
}

export interface BackupPaneV1 {
  title: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  hlMode: string;
  minimized: boolean;
  wordWrap: boolean;
}

export function paneToBackupItem(pane: TextCardPane): BackupPaneV1 {
  return {
    title: pane.title,
    content: pane.content,
    x: pane.x,
    y: pane.y,
    width: pane.width,
    height: pane.height,
    zIndex: pane.zIndex,
    hlMode: pane.hlMode,
    minimized: pane.minimized,
    wordWrap: pane.wordWrap
  };
}

export function buildBackup(panes: TextCardPane[]): TextCardsBackupV1 {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    panes: panes.map(paneToBackupItem)
  };
}

export function downloadBackup(panes: TextCardPane[], workspaceName: string) {
  const payload = buildBackup(panes);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = Object.assign(document.createElement("a"), {
    href: url,
    download: `text-cards-${workspaceName.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`
  });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPaneItem(raw: unknown): ImportTextCardPaneInput | null {
  if (!isRecord(raw)) return null;
  return {
    title: typeof raw.title === "string" ? raw.title : "",
    content: typeof raw.content === "string" ? raw.content : "",
    x: typeof raw.x === "number" ? raw.x : undefined,
    y: typeof raw.y === "number" ? raw.y : undefined,
    width: typeof raw.width === "number" ? raw.width : undefined,
    height: typeof raw.height === "number" ? raw.height : undefined,
    zIndex: typeof raw.zIndex === "number" ? raw.zIndex : undefined,
    hlMode: typeof raw.hlMode === "string" ? raw.hlMode : undefined,
    highlightOn: typeof raw.highlightOn === "boolean" ? raw.highlightOn : undefined,
    minimized: typeof raw.minimized === "boolean" ? raw.minimized : undefined,
    wordWrap: typeof raw.wordWrap === "boolean" ? raw.wordWrap : undefined
  };
}

export function parseBackupFile(text: string): ImportTextCardPaneInput[] {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) {
    throw new Error("无效的备份文件");
  }

  if (parsed.app === BACKUP_APP && parsed.version === BACKUP_VERSION && Array.isArray(parsed.panes)) {
    return parsed.panes.map(readPaneItem).filter((item): item is ImportTextCardPaneInput => item !== null);
  }

  if (Array.isArray(parsed)) {
    return parsed.map(readPaneItem).filter((item): item is ImportTextCardPaneInput => item !== null);
  }

  if (Array.isArray(parsed.panes)) {
    return parsed.panes.map(readPaneItem).filter((item): item is ImportTextCardPaneInput => item !== null);
  }

  throw new Error("无法识别的备份格式");
}
