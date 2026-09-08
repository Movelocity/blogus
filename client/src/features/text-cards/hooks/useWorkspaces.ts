import { useCallback, useEffect, useRef, useState } from "react";
import type { TextCardWorkspaceWithCount } from "@blogus/shared";
import { ACTIVE_WORKSPACE_KEY } from "../constants";
import * as api from "../../../lib/text-cards";

function readStoredWorkspaceId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

function storeWorkspaceId(id: string) {
  try {
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
  } catch {
    // ignore quota errors
  }
}

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<TextCardWorkspaceWithCount[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const pickActive = useCallback((items: TextCardWorkspaceWithCount[]) => {
    if (items.length === 0) return null;
    const stored = readStoredWorkspaceId();
    if (stored && items.some((item) => item.id === stored)) return stored;
    return items[0].id;
  }, []);

  const refresh = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    setError(null);
    try {
      let { workspaces: items } = await api.listWorkspaces();
      if (items.length === 0) {
        const created = await api.createWorkspace();
        items = [{ ...created.workspace, paneCount: 0 }];
      }
      setWorkspaces(items);
      setActiveWorkspaceId((current) => {
        if (current && items.some((item) => item.id === current)) return current;
        return pickActive(items);
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载工作区失败");
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [pickActive]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    storeWorkspaceId(id);
  }, []);

  const createWorkspace = useCallback(async () => {
    const { workspace } = await api.createWorkspace();
    const next = { ...workspace, paneCount: 0 };
    setWorkspaces((items) => [...items, next]);
    selectWorkspace(workspace.id);
    return workspace;
  }, [selectWorkspace]);

  const renameWorkspace = useCallback(async (id: string, name: string) => {
    const { workspace } = await api.updateWorkspace(id, { name });
    setWorkspaces((items) => items.map((item) => (item.id === id ? { ...item, ...workspace } : item)));
    return workspace;
  }, []);

  const removeWorkspace = useCallback(
    async (id: string) => {
      await api.deleteWorkspace(id);
      setWorkspaces((items) => {
        const next = items.filter((item) => item.id !== id);
        setActiveWorkspaceId((current) => {
          if (current !== id) return current;
          const fallback = pickActive(next);
          if (fallback) storeWorkspaceId(fallback);
          return fallback;
        });
        return next;
      });
    },
    [pickActive]
  );

  const adjustPaneCount = useCallback((workspaceId: string, delta: number) => {
    setWorkspaces((items) =>
      items.map((item) =>
        item.id === workspaceId ? { ...item, paneCount: Math.max(0, item.paneCount + delta) } : item
      )
    );
  }, []);

  const setPaneCount = useCallback((workspaceId: string, count: number) => {
    setWorkspaces((items) => items.map((item) => (item.id === workspaceId ? { ...item, paneCount: count } : item)));
  }, []);

  const activeWorkspace = workspaces.find((item) => item.id === activeWorkspaceId) ?? null;

  return {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    loading,
    error,
    refresh,
    selectWorkspace,
    createWorkspace,
    renameWorkspace,
    removeWorkspace,
    adjustPaneCount,
    setPaneCount
  };
}
