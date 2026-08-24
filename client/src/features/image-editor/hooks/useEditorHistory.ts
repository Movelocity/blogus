import { useCallback, useState } from "react";
import { editorReducer, initialDocument, type EditorAction } from "../reducer";

export function useEditorHistory() {
  const [past, setPast] = useState<typeof initialDocument[]>([]);
  const [present, setPresent] = useState(initialDocument);
  const [future, setFuture] = useState<typeof initialDocument[]>([]);
  const dispatch = useCallback((action: EditorAction, historical = true) => {
    setPresent((current) => {
      const next = editorReducer(current, action);
      if (next !== current && historical) setPast((items) => [...items.slice(-49), current]);
      return next;
    });
    if (historical) setFuture([]);
  }, []);
  const undo = useCallback(() => setPast((items) => {
    const previous = items.at(-1); if (!previous) return items;
    setPresent((current) => { setFuture((next) => [current, ...next]); return previous; });
    return items.slice(0, -1);
  }), []);
  const redo = useCallback(() => setFuture((items) => {
    const next = items[0]; if (!next) return items;
    setPresent((current) => { setPast((prev) => [...prev, current]); return next; });
    return items.slice(1);
  }), []);
  return { document: present, dispatch, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}

