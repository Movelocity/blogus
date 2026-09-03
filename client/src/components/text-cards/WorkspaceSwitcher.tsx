import { CaretDown, Check, Folder, GearSix } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import type { TextCardWorkspaceWithCount } from "@blogus/shared";
import { WorkspaceSettingsDialog } from "./WorkspaceSettingsDialog";

interface WorkspaceSwitcherProps {
  workspaces: TextCardWorkspaceWithCount[];
  activeWorkspace: TextCardWorkspaceWithCount | null;
  activeWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void | Promise<void>;
  onCreateWorkspace: () => void | Promise<void>;
  onRenameWorkspace: (id: string, name: string) => void | Promise<void>;
  onDeleteWorkspace: (id: string) => void | Promise<void>;
}

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspace,
  activeWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const closeMenu = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !settingsOpen) closeMenu();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, settingsOpen]);

  const label = activeWorkspace?.name ?? "工作区";

  return (
    <>
      <div ref={rootRef} className="tc-workspace-switcher">
        <button
          aria-controls={menuId}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="tc-workspace-trigger"
          type="button"
          onClick={() => setOpen((value) => !value)}
        >
          <Folder className="flex-none" size={16} weight={open ? "fill" : "regular"} />
          <span className="min-w-0 max-w-[9rem] truncate sm:max-w-[12rem]">{label}</span>
          <CaretDown
            className={`flex-none transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            size={12}
            weight="bold"
          />
        </button>

        {open ? (
          <div className="tc-workspace-menu" id={menuId} role="listbox">
            <div className="tc-workspace-menu-label">切换工作区</div>
            <div className="tc-workspace-list">
              {workspaces.map((workspace) => {
                const isActive = workspace.id === activeWorkspaceId;
                return (
                  <button
                    key={workspace.id}
                    aria-selected={isActive}
                    className="tc-workspace-item"
                    data-active={isActive ? "" : undefined}
                    role="option"
                    type="button"
                    onClick={() => {
                      void onSelectWorkspace(workspace.id);
                      closeMenu();
                    }}
                  >
                    <Check
                      className={`flex-none ${isActive ? "opacity-100" : "opacity-0"}`}
                      size={14}
                      weight="bold"
                    />
                    <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                    <span className="tc-workspace-count">{workspace.paneCount}</span>
                  </button>
                );
              })}
            </div>

            <button
              className="tc-workspace-settings-btn"
              type="button"
              onClick={() => {
                closeMenu();
                setSettingsOpen(true);
              }}
            >
              <GearSix size={16} />
              工作区设置
            </button>
          </div>
        ) : null}
      </div>

      <WorkspaceSettingsDialog
        activeWorkspace={activeWorkspace}
        activeWorkspaceId={activeWorkspaceId}
        open={settingsOpen}
        workspaces={workspaces}
        onClose={() => setSettingsOpen(false)}
        onCreateWorkspace={onCreateWorkspace}
        onDeleteWorkspace={onDeleteWorkspace}
        onRenameWorkspace={onRenameWorkspace}
      />
    </>
  );
}
