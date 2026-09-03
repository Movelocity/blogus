import { DownloadSimple, UploadSimple } from "@phosphor-icons/react";
import { useRef } from "react";
import type { TextCardPane } from "@blogus/shared";
import { downloadBackup, parseBackupFile } from "../../features/text-cards/backup";

interface ImportExportMenuProps {
  workspaceName: string;
  panes: TextCardPane[];
  onImport: (items: ReturnType<typeof parseBackupFile>) => void | Promise<void>;
}

export function ImportExportMenu({ workspaceName, panes, onImport }: ImportExportMenuProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (file: File) => {
    const text = await file.text();
    const items = parseBackupFile(text);
    if (!window.confirm(`将用备份中的 ${items.length} 张卡片覆盖当前工作区，确定继续？`)) return;
    await onImport(items);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        className="inline-flex items-center gap-2 rounded-md border border-foreground/15 px-3 py-2 text-sm hover:bg-muted/60"
        type="button"
        onClick={() => downloadBackup(panes, workspaceName)}
      >
        <DownloadSimple size={16} />
        导出 JSON
      </button>
      <button
        className="inline-flex items-center gap-2 rounded-md border border-foreground/15 px-3 py-2 text-sm hover:bg-muted/60"
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        <UploadSimple size={16} />
        载入 JSON
      </button>
      <input
        ref={inputRef}
        accept="application/json,.json"
        className="hidden"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleImport(file);
        }}
      />
    </div>
  );
}
