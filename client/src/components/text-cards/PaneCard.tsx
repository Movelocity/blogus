import { Trash } from "@phosphor-icons/react";
import type { TextCardPane } from "@blogus/shared";

interface PaneCardProps {
  pane: TextCardPane;
  onTitleChange: (id: string, title: string) => void;
  onContentChange: (id: string, content: string) => void;
  onDelete: () => void;
}

export function PaneCard({ pane, onTitleChange, onContentChange, onDelete }: PaneCardProps) {
  return (
    <article className="rounded-lg border border-foreground/10 bg-card/40 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <input
          className="min-w-0 flex-1 border-b border-transparent bg-transparent text-base font-medium outline-none transition-colors focus:border-accent"
          placeholder="无标题"
          value={pane.title}
          onChange={(event) => onTitleChange(pane.id, event.target.value)}
        />
        <button
          aria-label="删除卡片"
          className="rounded p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          type="button"
          onClick={onDelete}
        >
          <Trash size={16} />
        </button>
      </div>
      <textarea
        className="min-h-[10rem] w-full resize-y rounded-md border border-foreground/10 bg-background/80 p-3 font-mono text-sm leading-6 outline-none focus:border-accent"
        placeholder="输入正文…"
        value={pane.content}
        onChange={(event) => onContentChange(pane.id, event.target.value)}
      />
    </article>
  );
}
