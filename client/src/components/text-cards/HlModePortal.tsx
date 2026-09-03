import { useEffect } from "react";
import type { HlMode } from "@blogus/shared";
import { HL_MODE_OPTIONS } from "../../features/text-cards/constants";

interface HlModePortalProps {
  anchor: DOMRect | null;
  value: HlMode;
  onSelect: (mode: HlMode) => void;
  onClose: () => void;
}

const CARD_MODES = HL_MODE_OPTIONS.filter((item) =>
  ["", "json", "sh", "md", "js", "ts", "html", "css", "sql", "yaml", "py", "text"].includes(item.value)
);

export function HlModePortal({ anchor, value, onSelect, onClose }: HlModePortalProps) {
  useEffect(() => {
    if (!anchor) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".tc-hl-menu")) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [anchor, onClose]);

  if (!anchor) return null;

  return (
    <div
      className="tc-hl-menu"
      style={{ left: anchor.left, top: anchor.bottom + 2 }}
    >
      {CARD_MODES.map((item) => (
        <button
          key={item.label}
          className="tc-hl-item block w-full text-left"
          data-selected={item.value === value ? "" : undefined}
          type="button"
          onClick={() => {
            onSelect(item.value);
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
