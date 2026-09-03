import { useCallback, useEffect, useState } from "react";
import type { TextCardPane } from "@blogus/shared";
import * as api from "../../../lib/text-cards";

export function usePanes(workspaceId: string | null) {
  const [panes, setPanes] = useState<TextCardPane[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setPanes([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { panes: items } = await api.listPanes(workspaceId);
      setPanes(items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载卡片失败");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addPane = useCallback(async () => {
    if (!workspaceId) return null;
    const { pane } = await api.createPane(workspaceId);
    setPanes((items) => [...items, pane]);
    return pane;
  }, [workspaceId]);

  const removePane = useCallback(async (id: string) => {
    await api.deletePane(id);
    setPanes((items) => items.filter((item) => item.id !== id));
  }, []);

  const replacePanes = useCallback((items: TextCardPane[]) => {
    setPanes(items);
  }, []);

  const patchPaneLocal = useCallback((id: string, patch: Partial<TextCardPane>) => {
    setPanes((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  return {
    panes,
    loading,
    error,
    refresh,
    addPane,
    removePane,
    replacePanes,
    patchPaneLocal
  };
}
