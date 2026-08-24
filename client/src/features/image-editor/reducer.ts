import type { EditorDocument, ImageLayer, Rect } from "./types";

export type EditorAction =
  | { type: "add"; layers: ImageLayer[] }
  | { type: "select"; id: string | null }
  | { type: "remove"; id: string }
  | { type: "duplicate"; id: string }
  | { type: "geometry"; id: string; rect: Rect }
  | { type: "replace"; id: string; layer: ImageLayer };

export const initialDocument: EditorDocument = { layers: [], selectedId: null };

export function editorReducer(state: EditorDocument, action: EditorAction): EditorDocument {
  switch (action.type) {
    case "add": return { layers: [...state.layers, ...action.layers], selectedId: action.layers.at(-1)?.id ?? state.selectedId };
    case "select": return { ...state, selectedId: action.id };
    case "remove": return { layers: state.layers.filter((item) => item.id !== action.id), selectedId: state.selectedId === action.id ? null : state.selectedId };
    case "duplicate": {
      const source = state.layers.find((item) => item.id === action.id);
      if (!source) return state;
      const copy = { ...source, id: crypto.randomUUID(), name: `${source.name.replace(/\.[^.]+$/, "")}_copy.png`, x: source.x + 24, y: source.y + 24, z: Math.max(0, ...state.layers.map((item) => item.z)) + 1 };
      return { layers: [...state.layers, copy], selectedId: copy.id };
    }
    case "geometry": return { ...state, layers: state.layers.map((item) => item.id === action.id ? { ...item, ...action.rect } : item) };
    case "replace": return { ...state, layers: state.layers.map((item) => item.id === action.id ? action.layer : item), selectedId: action.id };
  }
}

