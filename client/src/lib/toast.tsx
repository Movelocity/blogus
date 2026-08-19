import { useCallback, useRef, useState } from "react";
import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

const TOAST_COLORS: Record<ToastType, string> = {
  success: "text-accent",
  error: "text-destructive",
  info: "text-muted-foreground",
};

function ToastIcon({ type }: { type: ToastType }) {
  if (type === "success") return <CheckCircle className="h-4 w-4 shrink-0" weight="fill" />;
  if (type === "error") return <WarningCircle className="h-4 w-4 shrink-0" weight="fill" />;
  return <Info className="h-4 w-4 shrink-0" weight="fill" />;
}

/**
 * 轻量 toast：在页面内维护一个栈，自动消失。Blogus 无全局 toast 组件，
 * 这里按需自实现，作用域限定在使用它的页面，不引入额外依赖。
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-2), { id, type, message }]);
      window.setTimeout(() => dismiss(id), 2800);
    },
    [dismiss],
  );

  return { toasts, dismiss, notify };
}

export function ToastView({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex w-full items-start gap-2.5 rounded-lg border border-foreground/10 bg-card/95 px-3.5 py-2.5 text-sm text-card-foreground shadow-lg backdrop-blur animate-panel-in"
        >
          <span className={TOAST_COLORS[toast.type]}>
            <ToastIcon type={toast.type} />
          </span>
          <span className="flex-1 leading-snug">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="关闭提示"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
