import { useEffect, useRef, useState } from "react";
import {
  ArchiveIcon,
  CaretDownIcon,
  CaretUpIcon,
  CopyIcon,
  HashIcon,
  LockIcon,
  LockOpenIcon,
  PencilSimpleIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { BlogNote } from "@blogus/shared";
import { MarkdownView } from "../../lib/markdown";
import type { ToastType } from "../../lib/toast";

const COLLAPSE_HEIGHT = 260;

interface NoteCardProps {
  note: BlogNote;
  isOwner: boolean;
  onUpdate: (id: string, updates: Partial<Pick<BlogNote, "content" | "isPublic" | "tags">>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onArchive: (id: string, isArchived: boolean) => Promise<boolean>;
  notify: (message: string, type: ToastType) => void;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function splitTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);
}

/**
 * 笔记卡片：查看 / 内联编辑 / 归档 / 公开切换 / 删除 / 复制。
 * 公开视图用 MarkdownView 渲染；过长内容折叠 + 展开。
 */
export function NoteCard({ note, isOwner, onUpdate, onDelete, onArchive, notify }: NoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [tags, setTags] = useState(note.tags.join(", "));
  const [isPublic, setIsPublic] = useState(note.isPublic);
  const [expanded, setExpanded] = useState(false);
  const [shouldCollapse, setShouldCollapse] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing && contentRef.current) {
      setShouldCollapse(contentRef.current.scrollHeight > COLLAPSE_HEIGHT);
      setExpanded(false);
    }
  }, [note.content, editing]);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = Math.round(window.innerHeight * 0.5);
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  };

  useEffect(() => {
    if (editing) adjustHeight();
  }, [content, editing]);

  const startEdit = () => {
    setEditing(true);
    setContent(note.content);
    setTags(note.tags.join(", "));
    setIsPublic(note.isPublic);
  };

  const cancelEdit = () => {
    setEditing(false);
    setContent(note.content);
    setTags(note.tags.join(", "));
    setIsPublic(note.isPublic);
  };

  const saveEdit = async () => {
    if (!content.trim()) {
      notify("笔记内容不能为空", "error");
      return;
    }
    const ok = await onUpdate(note.id, { content, isPublic, tags: splitTags(tags) });
    if (ok) {
      setEditing(false);
      notify("笔记已更新", "success");
    }
  };

  const togglePublic = async () => {
    const next = !note.isPublic;
    const ok = await onUpdate(note.id, { isPublic: next });
    if (ok) notify(next ? "已设为公开" : "已设为私密", "success");
  };

  const toggleArchive = async () => {
    const next = !note.isArchived;
    const ok = await onArchive(note.id, next);
    if (ok) notify(next ? "已归档" : "已取消归档", "success");
  };

  const handleDelete = async () => {
    if (!window.confirm("确定要删除这条笔记吗？此操作不可恢复。")) return;
    const ok = await onDelete(note.id);
    if (ok) notify("笔记已删除", "success");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(note.content);
      notify("内容已复制到剪贴板", "success");
    } catch {
      notify("复制失败", "error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      void saveEdit();
    }
  };

  return (
    <article className="rounded-xl border border-foreground/10 bg-card transition-shadow hover:shadow-sm">
      {editing ? (
        <div className="space-y-3.5 p-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="笔记内容..."
            className="max-h-[50vh] min-h-[120px] w-full resize-none overflow-y-auto bg-transparent px-1 text-base leading-none text-foreground outline-none"
          />
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsPublic(!isPublic)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1 text-sm transition-colors ${
                isPublic ? "bg-foreground text-background" : "bg-muted/60 text-muted-foreground"
              }`}
            >
              {isPublic ? <LockOpenIcon className="h-3.5 w-3.5" /> : <LockIcon className="h-3.5 w-3.5" />}
              {isPublic ? "公开" : "私密"}
            </button>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="标签，用逗号分隔"
              className="min-w-0 flex-1 rounded-lg bg-muted/10 px-3 py-1 text-base text-foreground outline-none ring-1 ring-transparent placeholder:text-muted-foreground/60 focus:ring-ring"
            />
            <button
              onClick={cancelEdit}
              className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <XIcon className="h-4 w-4" />
              取消
            </button>
            <button
              onClick={() => void saveEdit()}
              className="flex items-center gap-2 rounded-lg bg-foreground px-3 py-1 text-sm font-medium text-background transition-opacity hover:opacity-85 mr-1"
            >
              保存
            </button>
          </div>
        </div>
      ) : (
        <div className="py-2 px-3">
          {/* 头部：日期 + 状态 + 操作 */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-base text-muted-foreground/70 ">
              <span className="font-mono text-sm text-muted-foreground/70">{note.date}</span>
              <span className="h-4 w-px bg-foreground/10" />
              <span className="text-sm">{formatDate(note.createdAt)}</span>
              {isOwner && !note.isPublic && (
                <span className="flex items-center gap-1.5 text-sm">
                  <LockIcon className="h-4 w-4" />
                  Private
                </span>
              )}
              {note.isArchived && (
                <span className="flex items-center gap-1.5 text-muted-foreground/70">
                  <ArchiveIcon className="h-4 w-4" />
                  已归档
                </span>
              )}
            </div>

            {isOwner && (
              <div className="flex items-center">
                <IconButton label="编辑" onClick={startEdit} icon={<PencilSimpleIcon className="h-4 w-4" />} />
                <IconButton
                  label={note.isPublic ? "设为私密" : "设为公开"}
                  onClick={() => void togglePublic()}
                  icon={
                    note.isPublic ? (
                      <LockOpenIcon className="h-4 w-4" />
                    ) : (
                      <LockIcon className="h-4 w-4" />
                    )
                  }
                />
                <IconButton
                  label={note.isArchived ? "取消归档" : "归档"}
                  onClick={() => void toggleArchive()}
                  icon={<ArchiveIcon className="h-4 w-4" />}
                />
                <IconButton label="复制" onClick={() => void handleCopy()} icon={<CopyIcon className="h-4 w-4" />} />
                <IconButton
                  label="删除"
                  danger
                  onClick={() => void handleDelete()}
                  icon={<TrashIcon className="h-4 w-4" />}
                />
              </div>
            )}
          </div>

          {/* 内容 */}
          <div className="relative">
            <div
              ref={contentRef}
              className={`overflow-hidden transition-[max-height] duration-300 ${
                shouldCollapse && !expanded ? "max-h-[320px]" : "max-h-none"
              }`}
              style={
                shouldCollapse && !expanded
                  ? {
                      maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
                      WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
                    }
                  : undefined
              }
            >
              <MarkdownView content={note.content} breaks />
            </div>

            {shouldCollapse && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-2.5 flex items-center gap-1.5 text-base text-muted-foreground transition-colors hover:text-foreground"
              >
                {expanded ? (
                  <>
                    <CaretUpIcon className="h-4 w-4" />
                    收起
                  </>
                ) : (
                  <>
                    <CaretDownIcon className="h-4 w-4" />
                    展开
                  </>
                )}
              </button>
            )}
          </div>

          {/* 标签 */}
          {note.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2 border-t border-foreground/[0.07] pt-1">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-sm text-muted-foreground"
                >
                  <HashIcon className="h-3.5 w-3.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function IconButton({
  label,
  onClick,
  icon,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
        danger
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      {icon}
    </button>
  );
}
