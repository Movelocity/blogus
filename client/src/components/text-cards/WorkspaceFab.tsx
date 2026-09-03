import { DotsThree, DownloadSimple, Folder, PencilSimple, Plus, Trash, UploadSimple } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { TextCardPane, TextCardWorkspaceWithCount } from "@blogus/shared";
import { downloadBackup, parseBackupFile } from "../../features/text-cards/backup";

interface WorkspaceFabProps {
  workspaces: TextCardWorkspaceWithCount[];
  activeWorkspace: TextCardWorkspaceWithCount | null;
  activeWorkspaceId: string | null;
  panes: TextCardPane[];
  saveStatus: string;
  saveError: string | null;
  onSelectWorkspace: (id: string) => void | Promise<void>;
  onCreateWorkspace: () => void | Promise<void>;
  onRenameWorkspace: (id: string, name: string) => void | Promise<void>;
  onDeleteWorkspace: (id: string) => void | Promise<void>;
  onImport: (items: ReturnType<typeof parseBackupFile>) => void | Promise<void>;
}

export function WorkspaceFab({
  workspaces,
  activeWorkspace,
  activeWorkspaceId,
  panes,
  saveStatus,
  saveError,
  onSelectWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onImport
}: WorkspaceFabProps) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supportsHover = useRef(
    typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );

  const close = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setOpen(false);
    setRenaming(false);
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

  const startRename = () => {
    if (!activeWorkspace) return;
    setRenameValue(activeWorkspace.name);
    setRenaming(true);
  };

  const commitRename = async () => {
    if (!activeWorkspaceId) return;
    const trimmed = renameValue.trim();
    if (trimmed) await onRenameWorkspace(activeWorkspaceId, trimmed);
    setRenaming(false);
  };

  return (
    <div ref={rootRef} className="tc-fab">
      <button
        aria-expanded={open}
        aria-label="工作区与数据"
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
          <div className="tc-fab-section">工作区</div>
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              className="tc-fab-item"
              data-active={workspace.id === activeWorkspaceId ? "" : undefined}
              type="button"
              onClick={() => {
                void onSelectWorkspace(workspace.id);
                close();
              }}
            >
              <Folder size={16} />
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              <span className="text-xs opacity-70">{workspace.paneCount}</span>
            </button>
          ))}

          {renaming ? (
            <div className="px-2 py-1">
              <input
                autoFocus
                className="w-full rounded border border-[var(--tc-line)] bg-[var(--tc-page)] px-2 py-1.5 text-sm text-[var(--tc-ink)] outline-none focus:border-[var(--tc-accent-hi)]"
                value={renameValue}
                onBlur={() => void commitRename()}
                onChange={(event) => setRenameValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void commitRename();
                  if (event.key === "Escape") setRenaming(false);
                }}
              />
            </div>
          ) : (
            <>
              <button className="tc-fab-item" type="button" onClick={() => void onCreateWorkspace()}>
                <Plus size={16} />
                新建工作区
              </button>
              {activeWorkspace ? (
                <button className="tc-fab-item" type="button" onClick={startRename}>
                  <PencilSimple size={16} />
                  重命名当前工作区
                </button>
              ) : null}
              {workspaces.length > 1 && activeWorkspace ? (
                <button
                  className="tc-fab-item text-[var(--tc-danger)]"
                  type="button"
                  onClick={() => {
                    if (!window.confirm(`确定删除工作区「${activeWorkspace.name}」？其中的卡片将一并删除。`)) return;
                    void onDeleteWorkspace(activeWorkspace.id);
                    close();
                  }}
                >
                  <Trash size={16} />
                  删除当前工作区
                </button>
              ) : null}
            </>
          )}

          <div className="tc-fab-divider" />
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
