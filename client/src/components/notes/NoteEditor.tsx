import { useEffect, useRef, useState } from "react";
import { HashIcon, LockIcon, LockOpenIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";

const DRAFT_KEY = "blogus:note-draft";

interface NoteEditorProps {
  onSubmit: (content: string, tags: string[], isPublic: boolean) => Promise<boolean>;
  loading?: boolean;
}

function splitTags(input: string): string[] {
  return input
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);
}

/**
 * 创建笔记编辑器：内容 + 标签 + 公开开关，草稿自动缓存到 localStorage。
 * 结构对齐 nextblog；颜色收敛为三个层级：网站背景 / 卡片背景 / 卡片按钮。
 * Ctrl/Cmd+S 快速保存。
 */
export function NoteEditor({ onSubmit, loading = false }: NoteEditorProps) {
  const [content, setContent] = useState(() => localStorage.getItem(DRAFT_KEY) ?? "");
  const [tags, setTags] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [tagEditing, setTagEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // 草稿自动缓存，防止误关/断网丢内容
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, content);
  }, [content]);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = Math.round(window.innerHeight * 0.5);
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [content]);

  useEffect(() => {
    if (tagEditing) tagInputRef.current?.focus();
  }, [tagEditing]);

  const handleSubmit = async () => {
    if (!content.trim() || loading) return;
    const ok = await onSubmit(content, splitTags(tags), isPublic);
    if (ok) {
      setContent("");
      setTags("");
      setIsPublic(false);
      setTagEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const canSave = Boolean(content.trim()) && !loading;
  const showTagInput = tagEditing || tags.length > 0;

  return (
    <section className="rounded-lg border border-foreground/10 bg-card-2">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="写点什么..."
        disabled={loading}
        className="max-h-[50vh] min-h-[108px] w-full resize-y overflow-y-auto bg-transparent px-4 py-3 text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50 disabled:opacity-60"
      />

      <div className="flex items-center justify-between gap-2 border-t border-foreground/[0.07] px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsPublic(!isPublic)}
            disabled={loading}
            aria-pressed={isPublic}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors disabled:opacity-60 ${
              isPublic
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                : "bg-muted/50 text-muted-foreground"
            }`}
          >
            {isPublic ? (
              <LockOpenIcon className="h-3.5 w-3.5" weight="fill" />
            ) : (
              <LockIcon className="h-3.5 w-3.5" />
            )}
            {isPublic ? "Public" : "Private"}
          </button>

          {showTagInput ? (
            <label className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground focus-within:bg-muted/40">
              <HashIcon className="h-4 w-4 shrink-0" />
              <input
                ref={tagInputRef}
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                onBlur={() => {
                  if (!tags.trim()) setTagEditing(false);
                }}
                disabled={loading}
                placeholder="标签，用逗号分隔"
                className="w-[9rem] min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50 disabled:opacity-60 sm:w-[11rem]"
              />
            </label>
          ) : (
            <button
              type="button"
              onClick={() => setTagEditing(true)}
              disabled={loading}
              aria-label="添加标签"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-60"
            >
              <HashIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSave}
          className={`gap-1.5 px-3 py-1.5 ${canSave ? "btn-primary" : "btn-secondary"}`}
        >
          <PaperPlaneTiltIcon className="h-4 w-4" />
          {loading ? "保存中..." : "保存"}
        </button>
      </div>
    </section>
  );
}
