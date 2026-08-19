import { useEffect, useRef, useState } from "react";
import { HashIcon, LockIcon, LockOpenIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";

const DRAFT_KEY = "blogus:note-draft";

interface NoteEditorProps {
  onSubmit: (content: string, tags: string[], isPublic: boolean) => Promise<boolean>;
  loading?: boolean;
}

function splitTags(input: string): string[] {
  return input
    .split(",")
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 草稿自动缓存，防止误关/断网丢内容
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, content);
  }, [content]);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [content]);

  const handleSubmit = async () => {
    if (!content.trim() || loading) return;
    const ok = await onSubmit(content, splitTags(tags), isPublic);
    if (ok) {
      setContent("");
      setTags("");
      setIsPublic(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const canSave = Boolean(content.trim()) && !loading;

  return (
    // 卡片背景：编辑器是一个卡片，浮在网站背景之上
    <section className="rounded-xl border border-foreground/10 bg-card">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="写点什么..."
        disabled={loading}
        className="min-h-[108px] w-full resize-none bg-transparent px-5 py-4 text-xl leading-9 text-foreground outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
      />

      {/* 底部操作栏：一律用「卡片按钮」层级，不再引入 accent/绿色 */}
      <div className="flex flex-wrap items-center gap-2.5 border-t border-foreground/10 px-3 py-2.5">
        <button
          onClick={() => setIsPublic(!isPublic)}
          disabled={loading}
          aria-pressed={isPublic}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-base transition-colors disabled:opacity-60 ${
            isPublic
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          {isPublic ? <LockOpenIcon className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
          {isPublic ? "公开" : "私密"}
        </button>

        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-muted px-3.5 py-2 text-base text-muted-foreground focus-within:ring-1 focus-within:ring-ring">
          <HashIcon className="h-4 w-4 shrink-0" />
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            disabled={loading}
            placeholder="标签，用逗号分隔"
            className="w-full min-w-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
          />
        </label>

        <button
          onClick={() => void handleSubmit()}
          disabled={!canSave}
          className="ml-auto flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-base font-medium text-background transition-opacity enabled:hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PaperPlaneTiltIcon className="h-4 w-4" />
          {loading ? "保存中..." : "保存"}
        </button>
      </div>
    </section>
  );
}
