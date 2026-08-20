const MIRROR_STYLE_KEYS = [
  "direction",
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
] as const;

let mirror: HTMLDivElement | null = null;

function getMirror(): HTMLDivElement {
  if (!mirror) {
    mirror = document.createElement("div");
    mirror.setAttribute("aria-hidden", "true");
    document.body.appendChild(mirror);
  }
  return mirror;
}

/** 返回 textarea 内指定偏移处 caret 的 viewport 坐标 */
export function getTextareaCaretRect(textarea: HTMLTextAreaElement, position: number) {
  const computed = window.getComputedStyle(textarea);
  const div = getMirror();
  div.style.cssText =
    "position:absolute;visibility:hidden;top:0;left:-9999px;white-space:pre-wrap;word-wrap:break-word;";

  for (const key of MIRROR_STYLE_KEYS) {
    const value = computed.getPropertyValue(key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`));
    if (value) div.style.setProperty(key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`), value);
  }

  div.style.width = `${textarea.clientWidth}px`;
  div.style.height = "auto";
  div.style.overflow = "hidden";

  const prefix = textarea.value.slice(0, position);
  div.textContent = prefix;
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  div.appendChild(marker);

  const taRect = textarea.getBoundingClientRect();
  const top = taRect.top + (marker.offsetTop - textarea.scrollTop);
  const left = taRect.left + (marker.offsetLeft - textarea.scrollLeft);
  const lineHeight = Number.parseFloat(computed.lineHeight);
  const height = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : marker.offsetHeight || 18;

  return { top, left, height, bottom: top + height };
}

export type ViewportBox = { top: number; left: number; width: number; height: number };

export function getVisibleViewport(): ViewportBox {
  const vv = window.visualViewport;
  if (vv) {
    return { top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height };
  }
  return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
}

export function placeNearCaret(
  caret: { top: number; left: number; height: number },
  size: { width: number; height: number },
  gap = 8,
) {
  const view = getVisibleViewport();
  const pad = 8;
  let top = caret.top + caret.height + gap;
  if (top + size.height > view.top + view.height - pad) {
    top = caret.top - size.height - gap;
  }
  top = Math.min(Math.max(view.top + pad, top), Math.max(view.top + pad, view.top + view.height - size.height - pad));

  let left = caret.left;
  const maxLeft = view.left + view.width - size.width - pad;
  left = Math.min(Math.max(view.left + pad, left), Math.max(view.left + pad, maxLeft));

  const maxWidth = view.width - pad * 2;
  return { top, left, maxWidth };
}
