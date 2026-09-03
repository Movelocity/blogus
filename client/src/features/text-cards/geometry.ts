import type { TextCardPane } from "@blogus/shared";
import {
  CANVAS_MIN_HEIGHT,
  CANVAS_MIN_WIDTH,
  CANVAS_PADDING,
  DEFAULT_PANE_HEIGHT,
  DEFAULT_PANE_WIDTH,
  POSITION_STAGGER
} from "./constants";

export function nextPosition(panes: TextCardPane[]): { x: number; y: number } {
  if (panes.length === 0) {
    return { x: CANVAS_PADDING, y: CANVAS_PADDING };
  }

  const visible = panes.filter((pane) => !pane.minimized);
  const source = visible.length > 0 ? visible : panes;
  const last = source.reduce((current, pane) => (pane.zIndex >= current.zIndex ? pane : current), source[0]);

  return {
    x: last.x + POSITION_STAGGER,
    y: last.y + POSITION_STAGGER
  };
}

export function canvasBounds(panes: TextCardPane[]) {
  let width = CANVAS_MIN_WIDTH;
  let height = CANVAS_MIN_HEIGHT;

  for (const pane of panes) {
    if (pane.minimized) continue;
    width = Math.max(width, pane.x + pane.width + CANVAS_PADDING);
    height = Math.max(height, pane.y + pane.height + CANVAS_PADDING);
  }

  return { width, height };
}

export function nextZIndex(panes: TextCardPane[]) {
  if (panes.length === 0) return 1;
  return Math.max(...panes.map((pane) => pane.zIndex)) + 1;
}

export function defaultPaneSize() {
  return { width: DEFAULT_PANE_WIDTH, height: DEFAULT_PANE_HEIGHT };
}
