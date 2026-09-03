import { useCallback, useEffect, useRef, useState } from "react";
import type { TextCardPane, UpdateTextCardPaneInput } from "@blogus/shared";
import { SAVE_DEBOUNCE_MS } from "../constants";
import * as api from "../../../lib/text-cards";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

type TextPatch = Pick<UpdateTextCardPaneInput, "title" | "content">;
type LayoutPatch = Omit<UpdateTextCardPaneInput, "title" | "content">;
type PendingEdit = UpdateTextCardPaneInput;

export function usePaneSave(onPatched?: (id: string, pane: TextCardPane) => void) {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, TextPatch>());
  const inflight = useRef(new Map<string, Promise<void>>());
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const hasPending = useCallback(
    () => timers.current.size > 0 || pending.current.size > 0 || inflight.current.size > 0,
    []
  );

  const savePane = useCallback(
    async (id: string, patch: PendingEdit) => {
      const promise = (async () => {
        setStatus("saving");
        setError(null);
        try {
          const { pane } = await api.updatePane(id, patch);
          onPatched?.(id, pane);
          setStatus("saved");
        } catch (cause) {
          setStatus("error");
          setError(cause instanceof Error ? cause.message : "保存失败");
          throw cause;
        } finally {
          inflight.current.delete(id);
          if (!hasPending()) {
            setStatus((current) => (current === "error" ? "error" : "saved"));
          }
        }
      })();
      inflight.current.set(id, promise);
      await promise;
    },
    [hasPending, onPatched]
  );

  const queueSave = useCallback(
    (id: string, patch: TextPatch) => {
      const existing = pending.current.get(id) ?? {};
      pending.current.set(id, { ...existing, ...patch });
      setStatus("pending");

      const previous = timers.current.get(id);
      if (previous) clearTimeout(previous);

      const timer = setTimeout(() => {
        timers.current.delete(id);
        const payload = pending.current.get(id);
        pending.current.delete(id);
        if (!payload) return;
        void savePane(id, payload);
      }, SAVE_DEBOUNCE_MS);

      timers.current.set(id, timer);
    },
    [savePane]
  );

  const saveNow = useCallback(
    (id: string, patch: LayoutPatch) => {
      void savePane(id, patch);
    },
    [savePane]
  );

  const flush = useCallback(async () => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();

    const payloads = Array.from(pending.current.entries());
    pending.current.clear();

    const saves = payloads.map(([id, patch]) => savePane(id, patch));
    const running = Array.from(inflight.current.values());
    await Promise.all([...saves, ...running]);
  }, [savePane]);

  const retry = useCallback(() => {
    setError(null);
    setStatus("idle");
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
    };
  }, []);

  return { status, error, queueSave, saveNow, flush, retry, hasPending };
}
