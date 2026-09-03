import { DotsThree, DownloadSimple, UploadSimple } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { TextCardPane, TextCardWorkspaceWithCount } from "@blogus/shared";
import { downloadBackup, parseBackupFile } from "../../features/text-cards/backup";

interface WorkspaceFabProps {
  activeWorkspace: TextCardWorkspaceWithCount | null;
  panes: TextCardPane[];
  saveStatus: string;
  saveError: string | null;
  onImport: (items: ReturnType<typeof parseBackupFile>) => void | Promise<void>;
}

export function WorkspaceFab({ activeWorkspace, panes, saveStatus, saveError, onImport }: WorkspaceFabProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supportsHover = useRef(
    typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );

  const close = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setOpen(false);
  };

  const openMenu = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setOpen(true);
  };

  const scheduleClose = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpen(false), 500);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !supportsHover.current) return;
    root.addEventListener("mouseenter", openMenu);
    root.addEventListener("mouseleave", scheduleClose);
    return () => {
      root.removeEventListener("mouseenter", openMenu);
      root.removeEventListener("mouseleave", scheduleClose);
    };
  }, []);

  const statusLabel =
    saveStatus === "saving" || saveStatus === "pending"
      ? "保存中…"
      : saveStatus === "error"
        ? saveError || "保存失败"
        : saveStatus === "saved"
          ? "已保存"
          : "";

  return (
    <div ref={rootRef} className="tc-fab">
      <button
        aria-expanded={open}
        aria-label="数据与备份"
        className="tc-fab-trigger"
        type="button"
        onClick={() => {
          if (!supportsHover.current) setOpen((value) => !value);
        }}
      >
        <DotsThree size={22} weight="bold" />
      </button>

      {open ? (
        <div className="tc-fab-menu">
          <div className="tc-fab-section">数据</div>
          <button
            className="tc-fab-item"
            type="button"
            onClick={() => {
              if (activeWorkspace) downloadBackup(panes, activeWorkspace.name);
              close();
            }}
          >
            <DownloadSimple size={16} />
            导出 JSON
          </button>
          <button className="tc-fab-item" type="button" onClick={() => fileRef.current?.click()}>
            <UploadSimple size={16} />
            载入 JSON
          </button>

          {statusLabel ? (
            <>
              <div className="tc-fab-divider" />
              <div className="tc-fab-status" data-error={saveStatus === "error" ? "" : undefined}>
                {statusLabel}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <input
        ref={fileRef}
        accept="application/json,.json"
        className="hidden"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          void (async () => {
            try {
              const items = parseBackupFile(await file.text());
              if (!window.confirm(`将用备份中的 ${items.length} 张卡片覆盖当前工作区，确定继续？`)) return;
              await onImport(items);
              close();
            } catch (cause) {
              window.alert(cause instanceof Error ? cause.message : "载入失败");
            }
          })();
        }}
      />
    </div>
  );
}
