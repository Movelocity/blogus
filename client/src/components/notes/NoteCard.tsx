import { useEffect, useRef, useState } from "react";
import {
  ArchiveIcon,
  CaretDownIcon,
  CaretUpIcon,
  ClockIcon,
  CopyIcon,
  DotsThreeVerticalIcon,
  FloppyDiskIcon,
  HashIcon,
  LockIcon,
  LockOpenIcon,
  PencilSimpleIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { BlogNote } from "@blogus/shared";
import { NoteContentView } from "../../lib/note-content";
import type { ToastType } from "../../lib/toast";
import { copyText } from "../../lib/clipboard";

const COLLAPSE_HEIGHT = 260;

interface NoteCardProps {
  note: BlogNote;
  isOwner: boolean;
  onUpdate: (id: string, updates: Partial<Pick<BlogNote, "content" | "isPublic" | "tags">>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onArchive: (id: string, isArchived: boolean) => Promise<boolean>;
  notify: (message: string, type: ToastType) => void;
}

function formatNoteDate(dateString: string): string {
  const [y, m, d] = dateString.split("-");
  if (y && m && d) return `${y}/${m}/${d}`;
  return dateString;
}

function splitTags(input: string): string[] {
  return input
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);
}

/**
 * 笔记卡片：查看 / 内联编辑 / 归档 / 公开切换 / 删除 / 复制。
 * 公开视图用 NoteContentView 渲染；过长内容折叠 + 展开。
 */
export function NoteCard({ note, isOwner, onUpdate, onDelete, onArchive, notify }: NoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [tags, setTags] = useState(note.tags.join(", "));
  const [isPublic, setIsPublic] = useState(note.isPublic);
  const [expanded, setExpanded] = useState(false);
  const [shouldCollapse, setShouldCollapse] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing && contentRef.current) {
      setShouldCollapse(contentRef.current.scrollHeight > COLLAPSE_HEIGHT);
      setExpanded(false);
    }
  }, [note.content, editing]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

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
    setMenuOpen(false);
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
    setMenuOpen(false);
    const next = !note.isPublic;
    const ok = await onUpdate(note.id, { isPublic: next });
    if (ok) notify(next ? "已设为公开" : "已设为私密", "success");
  };

  const toggleArchive = async () => {
    setMenuOpen(false);
    const next = !note.isArchived;
    const ok = await onArchive(note.id, next);
    if (ok) notify(next ? "已归档" : "已取消归档", "success");
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    if (!window.confirm("确定要删除这条笔记吗？此操作不可恢复。")) return;
    const ok = await onDelete(note.id);
    if (ok) notify("笔记已删除", "success");
  };

  const handleCopy = async () => {
    setMenuOpen(false);
    const ok = await copyText(note.content);
    notify(ok ? "内容已复制到剪贴板" : "复制失败", ok ? "success" : "error");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      void saveEdit();
    }
  };

  return (
    <article className="rounded-lg bg-card-2 shadow-[0_1px_4px_rgba(0,0,0,0.06)] ring-1 ring-foreground/[0.07]">
      <div className="px-4 py-3">
        {/* 头部：日期 + 更多菜单（编辑时隐藏菜单） */}
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground/75">
            <ClockIcon className="h-4 w-4 shrink-0" weight="regular" />
            <span>{formatNoteDate(note.date)}</span>
            {note.isArchived && (
              <span className="flex items-center gap-1 text-muted-foreground/60">
                <ArchiveIcon className="h-3.5 w-3.5" />
                已归档
              </span>
            )}
            {note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded-md bg-muted/70 px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    <HashIcon className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {isOwner && !editing && (
            <div ref={menuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-label="更多操作"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <DotsThreeVerticalIcon className="h-5 w-5" weight="bold" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[9.5rem] overflow-hidden rounded-lg border border-foreground/10 bg-background py-1 shadow-lg">
                  <MenuItem icon={<PencilSimpleIcon className="h-4 w-4" />} label="编辑" onClick={startEdit} />
                  <MenuItem
                    icon={
                      note.isPublic ? (
                        <LockOpenIcon className="h-4 w-4" />
                      ) : (
                        <LockIcon className="h-4 w-4" />
                      )
                    }
                    label={note.isPublic ? "取消公开" : "设为公开"}
                    onClick={() => void togglePublic()}
                  />
                  <MenuItem icon={<CopyIcon className="h-4 w-4" />} label="复制" onClick={() => void handleCopy()} />
                  <MenuItem
                    icon={<ArchiveIcon className="h-4 w-4" />}
                    label={note.isArchived ? "取消归档" : "归档"}
                    onClick={() => void toggleArchive()}
                  />
                  <MenuItem
                    icon={<TrashIcon className="h-4 w-4" />}
                    label="删除"
                    danger
                    onClick={() => void handleDelete()}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="笔记内容..."
              className="max-h-[50vh] min-h-[120px] w-full resize-y overflow-y-auto bg-transparent text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50"
            />

            {/* 编辑底部操作栏 */}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-foreground/[0.07] pt-3">
              <button
                type="button"
                onClick={() => setIsPublic(!isPublic)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  isPublic
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {isPublic ? (
                  <LockOpenIcon className="h-3.5 w-3.5" weight="fill" />
                ) : (
                  <LockIcon className="h-3.5 w-3.5" />
                )}
                {isPublic ? "Public" : "Private"}
              </button>

              <label className="flex min-w-[8rem] flex-1 items-center gap-1.5 rounded-md border border-foreground/10 px-2.5 py-1.5 text-sm text-muted-foreground focus-within:border-foreground/20">
                <HashIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="标签（用逗号分隔）"
                  className="w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/50"
                />
              </label>

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="btn-secondary gap-1.5 px-3 py-1.5"
                >
                  <XIcon className="h-4 w-4" />
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void saveEdit()}
                  className="btn-primary gap-1.5 px-3 py-1.5"
                >
                  <FloppyDiskIcon className="h-4 w-4" />
                  保存
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="relative">
              <div
                ref={contentRef}
                className={`overflow-hidden transition-[max-height] duration-300 ${
                  shouldCollapse && !expanded ? "max-h-[220px]" : "max-h-none"
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
                <NoteContentView
                  content={note.content}
                  onChecklistToggle={
                    isOwner
                      ? (next) => {
                          void onUpdate(note.id, { content: next });
                        }
                      : undefined
                  }
                />
              </div>

              {shouldCollapse && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
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
          </>
        )}
      </div>
    </article>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
        danger
          ? "text-destructive hover:bg-destructive/8"
          : "text-foreground/85 hover:bg-muted/60"
      }`}
    >
      <span className={danger ? "text-destructive" : "text-muted-foreground"}>{icon}</span>
      {label}
    </button>
  );
}
