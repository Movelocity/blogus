import type { TextCardPane } from "@blogus/shared";
import { paneLabel } from "../../features/text-cards/constants";

interface PaneIndexProps {
  panes: TextCardPane[];
  activePaneId: string | null;
  maximizedPaneId: string | null;
  onSelect: (id: string) => void;
}

export function PaneIndex({ panes, activePaneId, maximizedPaneId, onSelect }: PaneIndexProps) {
  if (panes.length === 0) return null;

  return (
    <div className="tc-pane-index flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-2">
      {panes.map((pane, index) => {
        const label = paneLabel(pane.title, index);
        return (
          <button
            key={pane.id}
            className="tc-chip"
            data-active={pane.id === activePaneId ? "" : undefined}
            data-minimized={pane.minimized ? "" : undefined}
            data-maximized={pane.id === maximizedPaneId ? "" : undefined}
            title={pane.minimized ? `${label}（最小化）` : label}
            type="button"
            onClick={() => onSelect(pane.id)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
