import { ArrowLeft } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ImportExportMenu } from "../components/text-cards/ImportExportMenu";
import { PaneList } from "../components/text-cards/PaneList";
import { WorkspaceSwitcher } from "../components/text-cards/WorkspaceSwitcher";
import { usePanes } from "../features/text-cards/hooks/usePanes";
import { usePaneSave } from "../features/text-cards/hooks/usePaneSave";
import { useWorkspaces } from "../features/text-cards/hooks/useWorkspaces";
import { importPanes } from "../lib/text-cards";
import { refreshSession } from "../lib/api";

function SaveIndicator({ status, error, onRetry }: { status: string; error: string | null; onRetry: () => void }) {
  if (status === "saving" || status === "pending") {
    return <span className="text-xs text-muted-foreground">保存中…</span>;
  }
  if (status === "saved") {
    return <span className="text-xs text-muted-foreground">已保存</span>;
  }
  if (status === "error") {
    return (
      <button className="text-xs text-destructive underline-offset-2 hover:underline" type="button" onClick={onRetry}>
        保存失败{error ? `：${error}` : ""}，点击重试
      </button>
    );
  }
  return null;
}

export function TextCardsPage() {
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);
  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    loading: workspacesLoading,
    error: workspacesError,
    selectWorkspace,
    createWorkspace,
    renameWorkspace,
    removeWorkspace,
    refresh: refreshWorkspaces
  } = useWorkspaces();

  const { panes, loading: panesLoading, addPane, removePane, replacePanes, patchPaneLocal } = usePanes(activeWorkspaceId);
  const { status, error: saveError, queueSave, flush, retry } = usePaneSave((id, pane) => patchPaneLocal(id, pane));

  useEffect(() => {
    void (async () => {
      const ok = await refreshSession();
      if (!ok) {
        navigate("/login?redirect=/tools/text-cards", { replace: true });
        return;
      }
      setAuthReady(true);
    })();
  }, [navigate]);

  const handleSelectWorkspace = useCallback(
    async (id: string) => {
      if (id === activeWorkspaceId) return;
      await flush();
      selectWorkspace(id);
    },
    [activeWorkspaceId, flush, selectWorkspace]
  );

  const handleTitleChange = useCallback(
    (id: string, title: string) => {
      patchPaneLocal(id, { title });
      queueSave(id, { title });
    },
    [patchPaneLocal, queueSave]
  );

  const handleContentChange = useCallback(
    (id: string, content: string) => {
      patchPaneLocal(id, { content });
      queueSave(id, { content });
    },
    [patchPaneLocal, queueSave]
  );

  const handleDeletePane = useCallback(
    async (id: string, hasContent: boolean) => {
      if (hasContent && !window.confirm("确定删除这张卡片？")) return;
      await flush();
      await removePane(id);
      void refreshWorkspaces();
    },
    [flush, removePane, refreshWorkspaces]
  );

  const handleImport = useCallback(
    async (items: Parameters<typeof importPanes>[1]["panes"]) => {
      if (!activeWorkspaceId) return;
      await flush();
      const { panes: imported } = await importPanes(activeWorkspaceId, { panes: items });
      replacePanes(imported);
      void refreshWorkspaces();
    },
    [activeWorkspaceId, flush, replacePanes, refreshWorkspaces]
  );

  if (!authReady || workspacesLoading) {
    return (
      <div className="grid h-[100dvh] place-items-center bg-background text-muted-foreground">
        <span className="font-mono text-sm">加载中…</span>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-foreground/10 px-4 lg:px-6">
        <Link className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" to="/">
          <ArrowLeft size={16} />
          首页
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 truncate font-display text-lg font-semibold">卡片笔记</h1>
        </div>
        <SaveIndicator error={saveError} status={status} onRetry={retry} />
        {activeWorkspace ? (
          <ImportExportMenu panes={panes} workspaceName={activeWorkspace.name} onImport={handleImport} />
        ) : null}
        <WorkspaceSwitcher
          activeWorkspaceId={activeWorkspaceId}
          workspaces={workspaces}
          onCreate={() => void createWorkspace()}
          onDelete={(id) => void removeWorkspace(id)}
          onRename={(id, name) => void renameWorkspace(id, name)}
          onSelect={handleSelectWorkspace}
        />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {workspacesError ? (
            <p className="text-sm text-destructive" role="alert">
              {workspacesError}
            </p>
          ) : null}
          <PaneList
            loading={panesLoading}
            panes={panes}
            onContentChange={handleContentChange}
            onCreate={async () => {
              await addPane();
              void refreshWorkspaces();
            }}
            onDelete={handleDeletePane}
            onTitleChange={handleTitleChange}
          />
        </div>
      </main>
    </div>
  );
}
