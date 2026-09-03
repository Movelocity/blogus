import { Plus, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TextCardWorkspaceWithCount } from "@blogus/shared";

interface WorkspaceSettingsDialogProps {
  open: boolean;
  activeWorkspace: TextCardWorkspaceWithCount | null;
  activeWorkspaceId: string | null;
  workspaces: TextCardWorkspaceWithCount[];
  onClose: () => void;
  onCreateWorkspace: () => void | Promise<void>;
  onRenameWorkspace: (id: string, name: string) => void | Promise<void>;
  onDeleteWorkspace: (id: string) => void | Promise<void>;
}

export function WorkspaceSettingsDialog({
  open,
  activeWorkspace,
  activeWorkspaceId,
  workspaces,
  onClose,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace
}: WorkspaceSettingsDialogProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(activeWorkspace?.name ?? "");
    const timer = window.setTimeout(() => inputRef.current?.select(), 0);
    return () => window.clearTimeout(timer);
  }, [activeWorkspace?.name, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  const trimmedName = name.trim();
  const isDirty = Boolean(trimmedName && trimmedName !== (activeWorkspace?.name ?? ""));

  const commitRename = async () => {
    if (!activeWorkspaceId || saving || !isDirty) return;
    setSaving(true);
    try {
      await onRenameWorkspace(activeWorkspaceId, trimmedName);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="tc-workspace-dialog-backdrop">
      <div aria-labelledby="tc-workspace-dialog-title" aria-modal="true" className="tc-workspace-dialog" role="dialog">
        <div className="tc-workspace-dialog-header">
          <h2 className="tc-workspace-dialog-title" id="tc-workspace-dialog-title">
            工作区设置
          </h2>
          <button aria-label="关闭" className="tc-workspace-dialog-close" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="tc-workspace-dialog-body">
          <div className="tc-workspace-dialog-form">
            <label className="tc-workspace-dialog-field">
              <span className="tc-workspace-dialog-label">当前工作区名称</span>
              <input
                ref={inputRef}
                className="tc-workspace-dialog-input"
                disabled={!activeWorkspace || saving}
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && isDirty) void commitRename();
                }}
              />
            </label>
            {isDirty ? (
              <div className="tc-workspace-dialog-form-actions">
                <button
                  className="tc-workspace-dialog-btn-primary"
                  disabled={!activeWorkspaceId || saving}
                  type="button"
                  onClick={() => void commitRename()}
                >
                  {saving ? "保存中…" : "保存名称"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="tc-workspace-dialog-section">
            <div className="tc-workspace-dialog-section-label">其他操作</div>
            <button className="tc-workspace-dialog-btn-secondary" type="button" onClick={() => void onCreateWorkspace()}>
              <Plus size={16} />
              新建工作区
            </button>
          </div>

          {workspaces.length > 1 && activeWorkspace ? (
            <div className="tc-workspace-dialog-danger-zone">
              <button
                className="tc-workspace-dialog-btn-text-danger"
                type="button"
                onClick={() => {
                  if (!window.confirm(`确定删除工作区「${activeWorkspace.name}」？其中的卡片将一并删除。`)) return;
                  void onDeleteWorkspace(activeWorkspace.id);
                  onClose();
                }}
              >
                删除当前工作区
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
