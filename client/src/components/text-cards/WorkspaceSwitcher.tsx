import { CaretDown, Plus, Trash } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { TextCardWorkspaceWithCount } from "@blogus/shared";

interface WorkspaceSwitcherProps {
  workspaces: TextCardWorkspaceWithCount[];
  activeWorkspaceId: string | null;
  onSelect: (id: string) => void | Promise<void>;
  onCreate: () => void | Promise<void>;
  onRename: (id: string, name: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  onSelect,
  onCreate,
  onRename,
  onDelete
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const root = useRef<HTMLDivElement>(null);

  const active = workspaces.find((item) => item.id === activeWorkspaceId) ?? workspaces[0] ?? null;

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const startRename = (workspace: TextCardWorkspaceWithCount) => {
    setRenamingId(workspace.id);
    setRenameValue(workspace.name);
    setOpen(false);
  };

  const commitRename = async () => {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    if (trimmed) await onRename(renamingId, trimmed);
    setRenamingId(null);
  };

  const handleDelete = async (id: string, name: string) => {
    if (workspaces.length <= 1) return;
    if (!window.confirm(`确定删除工作区「${name}」？其中的卡片将一并删除。`)) return;
    await onDelete(id);
    setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      {renamingId ? (
        <input
          autoFocus
          className="h-9 min-w-[10rem] rounded-md border border-foreground/15 bg-background px-3 text-sm outline-none focus:border-accent"
          value={renameValue}
          onBlur={() => void commitRename()}
          onChange={(event) => setRenameValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void commitRename();
            if (event.key === "Escape") setRenamingId(null);
          }}
        />
      ) : (
        <button
          className="inline-flex h-9 items-center gap-2 rounded-md border border-foreground/15 px-3 text-sm hover:bg-muted/60"
          type="button"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="max-w-[12rem] truncate">{active?.name ?? "工作区"}</span>
          {active ? <span className="text-xs text-muted-foreground">({active.paneCount})</span> : null}
          <CaretDown aria-hidden size={14} />
        </button>
      )}

      {open ? (
        <div className="absolute left-0 top-[calc(100%+0.35rem)] z-20 min-w-[14rem] rounded-md border border-foreground/10 bg-background p-1 shadow-lg">
          {workspaces.map((workspace) => (
            <div key={workspace.id} className="flex items-center gap-1">
              <button
                className={`flex-1 rounded px-2 py-2 text-left text-sm hover:bg-muted/60 ${
                  workspace.id === activeWorkspaceId ? "bg-muted/40" : ""
                }`}
                type="button"
                onClick={() => {
                  void onSelect(workspace.id);
                  setOpen(false);
                }}
              >
                <span>{workspace.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{workspace.paneCount}</span>
              </button>
              <button
                aria-label="重命名"
                className="rounded px-2 py-2 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                type="button"
                onClick={() => startRename(workspace)}
              >
                改名
              </button>
              {workspaces.length > 1 ? (
                <button
                  aria-label="删除工作区"
                  className="rounded px-2 py-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  type="button"
                  onClick={() => void handleDelete(workspace.id, workspace.name)}
                >
                  <Trash size={14} />
                </button>
              ) : null}
            </div>
          ))}
          <button
            className="mt-1 flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-muted/60"
            type="button"
            onClick={() => {
              void onCreate();
              setOpen(false);
            }}
          >
            <Plus size={14} />
            新建工作区
          </button>
        </div>
      ) : null}
    </div>
  );
}
