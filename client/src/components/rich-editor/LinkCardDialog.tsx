import { type FormEvent, useState } from "react";
import { X } from "@phosphor-icons/react";

export function LinkCardDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { url: string; title: string; description: string }) => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onSubmit({ url: url.trim(), title: title.trim(), description: description.trim() });
    setUrl("");
    setTitle("");
    setDescription("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-foreground/10 bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">插入链接卡片</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">链接地址 *</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="https://..."
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">标题</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">描述</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
            >
              插入
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
