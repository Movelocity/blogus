import { ArrowLeft, Moon, Plus, Sun } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { HlMode, TextCardPane } from "@blogus/shared";
import { Canvas, type CanvasHandle } from "../components/text-cards/Canvas";
import { HlModePortal } from "../components/text-cards/HlModePortal";
import { PaneIndex } from "../components/text-cards/PaneIndex";
import { WorkspaceFab } from "../components/text-cards/WorkspaceFab";
import { WorkspaceSwitcher } from "../components/text-cards/WorkspaceSwitcher";
import { nextPosition, nextZIndex } from "../features/text-cards/geometry";
import { usePanes } from "../features/text-cards/hooks/usePanes";
import { usePaneSave } from "../features/text-cards/hooks/usePaneSave";
import { useWorkspaces } from "../features/text-cards/hooks/useWorkspaces";
import "../features/text-cards/text-cards.css";
import { useTheme } from "../hooks/useTheme";
import { importPanes, updatePane } from "../lib/text-cards";
import { refreshSession } from "../lib/api";

export function TextCardsPage() {
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();
  const canvasRef = useRef<CanvasHandle>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const [maximizedPaneId, setMaximizedPaneId] = useState<string | null>(null);
  const [hlMenu, setHlMenu] = useState<{ paneId: string; rect: DOMRect } | null>(null);

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
  const { status, error: saveError, queueSave, saveNow, flush } = usePaneSave((id, pane) => patchPaneLocal(id, pane));

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

  useEffect(() => {
    setActivePaneId(null);
    setMaximizedPaneId(null);
    setHlMenu(null);
  }, [activeWorkspaceId]);

  const handleSelectWorkspace = useCallback(
    async (id: string) => {
      if (id === activeWorkspaceId) return;
      await flush();
      setMaximizedPaneId(null);
      selectWorkspace(id);
    },
    [activeWorkspaceId, flush, selectWorkspace]
  );

  const bringToFront = useCallback(
    (id: string) => {
      const next = nextZIndex(panes);
      const current = panes.find((pane) => pane.id === id);
      if (!current || current.zIndex >= next - 1) {
        setActivePaneId(id);
        return;
      }
      patchPaneLocal(id, { zIndex: next });
      saveNow(id, { zIndex: next });
      setActivePaneId(id);
    },
    [panes, patchPaneLocal, saveNow]
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

  const handleLayoutChange = useCallback(
    (id: string, patch: Partial<Pick<TextCardPane, "x" | "y" | "width" | "height" | "minimized">>) => {
      patchPaneLocal(id, patch);
      saveNow(id, patch);
      if (patch.minimized) setMaximizedPaneId((current) => (current === id ? null : current));
    },
    [patchPaneLocal, saveNow]
  );

  const handleHlModeChange = useCallback(
    (id: string, hlMode: HlMode) => {
      patchPaneLocal(id, { hlMode });
      saveNow(id, { hlMode });
    },
    [patchPaneLocal, saveNow]
  );

  const handleWordWrapChange = useCallback(
    (id: string, wordWrap: boolean) => {
      patchPaneLocal(id, { wordWrap });
      saveNow(id, { wordWrap });
    },
    [patchPaneLocal, saveNow]
  );

  const handleMinimize = useCallback(
    (id: string) => {
      if (maximizedPaneId === id) setMaximizedPaneId(null);
      patchPaneLocal(id, { minimized: true });
      saveNow(id, { minimized: true });
    },
    [maximizedPaneId, patchPaneLocal, saveNow]
  );

  const handleFocusPane = useCallback(
    (id: string) => {
      const pane = panes.find((item) => item.id === id);
      if (!pane) return;
      if (maximizedPaneId && maximizedPaneId !== id) {
        setMaximizedPaneId(id);
        setActivePaneId(id);
        return;
      }
      if (pane.minimized) {
        patchPaneLocal(id, { minimized: false });
        saveNow(id, { minimized: false });
      }
      bringToFront(id);
      canvasRef.current?.scrollToPane({ ...pane, minimized: false });
    },
    [bringToFront, maximizedPaneId, panes, patchPaneLocal, saveNow]
  );

  const handleCreatePane = useCallback(async () => {
    const pane = await addPane();
    if (!pane) return;
    const position = nextPosition(panes);
    const { pane: positioned } = await updatePane(pane.id, position);
    patchPaneLocal(pane.id, positioned);
    bringToFront(pane.id);
    canvasRef.current?.scrollToPane(positioned);
    void refreshWorkspaces();
  }, [addPane, bringToFront, panes, patchPaneLocal, refreshWorkspaces]);

  const handleDeletePane = useCallback(
    async (id: string, hasContent: boolean) => {
      if (hasContent && !window.confirm("确定删除这张卡片？")) return;
      await flush();
      await removePane(id);
      if (activePaneId === id) setActivePaneId(null);
      if (maximizedPaneId === id) setMaximizedPaneId(null);
      void refreshWorkspaces();
    },
    [activePaneId, flush, maximizedPaneId, removePane, refreshWorkspaces]
  );

  const handleImport = useCallback(
    async (items: Parameters<typeof importPanes>[1]["panes"]) => {
      if (!activeWorkspaceId) return;
      await flush();
      const { panes: imported } = await importPanes(activeWorkspaceId, { panes: items });
      replacePanes(imported);
      setMaximizedPaneId(null);
      void refreshWorkspaces();
    },
    [activeWorkspaceId, flush, replacePanes, refreshWorkspaces]
  );

  if (!authReady || workspacesLoading) {
    return (
      <div className="tc-page grid place-items-center">
        <span className="font-mono text-sm text-[var(--tc-dim)]">加载中…</span>
      </div>
    );
  }

  const hlPane = hlMenu ? panes.find((pane) => pane.id === hlMenu.paneId) : null;

  return (
    <div className="tc-page">
      <header className="tc-topbar">
        <Link className="flex flex-none items-center gap-1 text-sm text-[var(--tc-dim)] hover:text-[var(--tc-ink)]" to="/">
          <ArrowLeft size={16} />
          <span className="max-sm:hidden">首页</span>
        </Link>
        <WorkspaceSwitcher
          activeWorkspace={activeWorkspace}
          activeWorkspaceId={activeWorkspaceId}
          workspaces={workspaces}
          onCreateWorkspace={() => void createWorkspace()}
          onDeleteWorkspace={(id) => void removeWorkspace(id)}
          onRenameWorkspace={(id, name) => void renameWorkspace(id, name)}
          onSelectWorkspace={handleSelectWorkspace}
        />
        <PaneIndex
          activePaneId={activePaneId}
          maximizedPaneId={maximizedPaneId}
          panes={panes}
          onSelect={handleFocusPane}
        />
        <button
          aria-label={theme === "dark" ? "切换浅色模式" : "切换深色模式"}
          className="tc-theme-btn"
          type="button"
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button className="tc-add-btn" type="button" onClick={() => void handleCreatePane()}>
          <Plus size={16} weight="bold" />
          添加
        </button>
      </header>

      {workspacesError ? (
        <p className="fixed left-4 top-14 z-[10000] text-xs text-[var(--tc-danger)]" role="alert">
          {workspacesError}
        </p>
      ) : null}

      {panesLoading ? (
        <div className="tc-canvas-viewport grid place-items-center text-sm text-[var(--tc-dim)]">加载卡片中…</div>
      ) : (
        <Canvas
          ref={canvasRef}
          maximizedPaneId={maximizedPaneId}
          panes={panes}
          onBringToFront={bringToFront}
          onContentChange={handleContentChange}
          onCreate={handleCreatePane}
          onDelete={handleDeletePane}
          onLayoutChange={handleLayoutChange}
          onMaximize={setMaximizedPaneId}
          onMinimize={handleMinimize}
          onOpenHlMenu={(id, rect) => setHlMenu({ paneId: id, rect })}
          onRestore={() => setMaximizedPaneId(null)}
          onTitleChange={handleTitleChange}
          onWordWrapChange={handleWordWrapChange}
        />
      )}

      <WorkspaceFab
        activeWorkspace={activeWorkspace}
        panes={panes}
        saveError={saveError}
        saveStatus={status}
        onImport={handleImport}
      />

      {hlMenu && hlPane ? (
        <HlModePortal
          anchor={hlMenu.rect}
          value={hlPane.hlMode}
          onClose={() => setHlMenu(null)}
          onSelect={(mode) => handleHlModeChange(hlMenu.paneId, mode)}
        />
      ) : null}
    </div>
  );
}
