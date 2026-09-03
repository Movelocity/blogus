import { Plus, Trash } from "@phosphor-icons/react";
import type { TextCardPane } from "@blogus/shared";
import { PaneCard } from "./PaneCard";

interface PaneListProps {
  panes: TextCardPane[];
  loading: boolean;
  onCreate: () => void | Promise<void>;
  onDelete: (id: string, hasContent: boolean) => void | Promise<void>;
  onTitleChange: (id: string, title: string) => void;
  onContentChange: (id: string, content: string) => void;
}

export function PaneList({ panes, loading, onCreate, onDelete, onTitleChange, onContentChange }: PaneListProps) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">加载卡片中…</p>;
  }

  if (panes.length === 0) {
    return (
      <div className="grid place-items-center gap-4 rounded-lg border border-dashed border-foreground/15 px-6 py-16 text-center">
        <p className="m-0 text-sm text-muted-foreground">这个工作区还没有卡片</p>
        <button
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          type="button"
          onClick={() => void onCreate()}
        >
          <Plus size={16} weight="bold" />
          新建卡片
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {panes.map((pane) => (
        <PaneCard
          key={pane.id}
          pane={pane}
          onContentChange={onContentChange}
          onDelete={() => void onDelete(pane.id, Boolean(pane.title.trim() || pane.content.trim()))}
          onTitleChange={onTitleChange}
        />
      ))}
      <button
        className="inline-flex items-center gap-2 self-start rounded-full border border-foreground/15 px-4 py-2 text-sm hover:bg-muted/60"
        type="button"
        onClick={() => void onCreate()}
      >
        <Plus size={16} />
        新建卡片
      </button>
    </div>
  );
}
