import { type FormEvent, type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ImageIcon, LinkIcon } from "@phosphor-icons/react";
import { detectSlashQuery, matchSlashCommands, type SlashCommand, type SlashMatch } from "../../lib/slashQuery";
import { getTextareaCaretRect, placeNearCaret } from "../../lib/textareaCaret";

export type TextRange = { start: number; end: number };

type CaretPos = { top: number; left: number; height: number };

type LinkSession = {
  range: TextRange;
};

function sameCaret(a: CaretPos | null, b: CaretPos) {
  return a != null && a.top === b.top && a.left === b.left && a.height === b.height;
}

function eventInside(container: HTMLElement | null, event: Event) {
  if (!container) return false;
  const path = event.composedPath();
  if (path.some((node) => node instanceof Node && container.contains(node))) return true;
  const target = event.target;
  // 点菜单项会在同一次 mousedown 里被 React 卸掉，target 此时已不在 DOM 中
  if (target instanceof Node && !target.isConnected) return true;
  return target instanceof Node && container.contains(target);
}

function commandIcon(id: SlashCommand["id"]) {
  if (id === "image") return <ImageIcon size={16} className="shrink-0" />;
  return <LinkIcon size={16} className="shrink-0" />;
}

function stopInsidePanel(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

export function SlashMenu({
  textareaRef,
  value,
  paused = false,
  onPickImage,
  onInsertMarkdown,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  paused?: boolean;
  onPickImage: (file: File, range: TextRange) => void;
  onInsertMarkdown: (range: TextRange, markdown: string) => void;
}) {
  const [match, setMatch] = useState<SlashMatch | null>(null);
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [active, setActive] = useState(-1);
  const [caret, setCaret] = useState<CaretPos | null>(null);
  const [linkSession, setLinkSession] = useState<LinkSession | null>(null);
  const [linkText, setLinkText] = useState("");
  const [linkHref, setLinkHref] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pendingImageRange = useRef<TextRange | null>(null);
  const linkRangeRef = useRef<TextRange | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const matchRef = useRef(match);
  const commandsRef = useRef(commands);
  const activeRef = useRef(active);
  const linkRef = useRef(linkSession);
  const pausedRef = useRef(paused);

  matchRef.current = match;
  commandsRef.current = commands;
  activeRef.current = active;
  linkRef.current = linkSession;
  pausedRef.current = paused;

  const showMenu = !paused && !linkSession && match !== null && commands.length > 0;

  const closeAll = useCallback(() => {
    setMatch(null);
    setCommands([]);
    setLinkSession(null);
    linkRangeRef.current = null;
  }, []);

  const runCommand = useCallback((cmd: SlashCommand) => {
    const ta = textareaRef.current;
    const current = matchRef.current;
    if (!ta || !current) return;
    const range = { start: current.start, end: current.end };
    const caretPos = getTextareaCaretRect(ta, current.start);
    setMatch(null);
    setCommands([]);

    if (cmd.id === "image") {
      pendingImageRange.current = range;
      fileRef.current?.click();
      return;
    }

    linkRangeRef.current = range;
    setCaret(caretPos);
    setLinkText("");
    setLinkHref("");
    setLinkSession({ range });
  }, [textareaRef]);

  const syncFromTextarea = useCallback(() => {
    if (pausedRef.current || linkRef.current) return;
    const ta = textareaRef.current;
    if (!ta) {
      setMatch(null);
      setCommands([]);
      return;
    }
    const found = detectSlashQuery(ta.value, ta.selectionStart);
    const next = found ? matchSlashCommands(found.query) : [];
    if (!found || next.length === 0) {
      setMatch(null);
      setCommands([]);
      return;
    }
    const prev = matchRef.current;
    const queryChanged = !prev || prev.query !== found.query || prev.start !== found.start;
    setMatch(found);
    setCommands(next);
    if (queryChanged) setActive(found.query ? 0 : -1);
    else setActive((i) => (i < 0 ? -1 : Math.min(i, next.length - 1)));
    setCaret(getTextareaCaretRect(ta, found.start));
  }, [textareaRef]);

  useEffect(() => {
    if (paused) {
      setMatch(null);
      setCommands([]);
      return;
    }
    if (linkRef.current) return;
    syncFromTextarea();
  }, [paused, value, syncFromTextarea]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (linkRef.current) return;
      const list = commandsRef.current;
      if (!matchRef.current || list.length === 0 || pausedRef.current) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((i) => (i < 0 ? 0 : (i + 1) % list.length));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((i) => (i < 0 ? list.length - 1 : (i - 1 + list.length) % list.length));
      } else if (event.key === "Enter" || event.key === "Tab") {
        const cmd = list[activeRef.current];
        if (!cmd) return;
        event.preventDefault();
        runCommand(cmd);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setMatch(null);
        setCommands([]);
      }
    };

    ta.addEventListener("input", syncFromTextarea);
    ta.addEventListener("keyup", syncFromTextarea);
    ta.addEventListener("click", syncFromTextarea);
    ta.addEventListener("select", syncFromTextarea);
    ta.addEventListener("keydown", onKeyDown);
    return () => {
      ta.removeEventListener("input", syncFromTextarea);
      ta.removeEventListener("keyup", syncFromTextarea);
      ta.removeEventListener("click", syncFromTextarea);
      ta.removeEventListener("select", syncFromTextarea);
      ta.removeEventListener("keydown", onKeyDown);
    };
  }, [textareaRef, syncFromTextarea, runCommand]);

  const linkOpen = Boolean(linkSession);

  useLayoutEffect(() => {
    if (!showMenu && !linkOpen) return;
    const ta = textareaRef.current;
    if (!ta) return;

    function refresh() {
      const current = textareaRef.current;
      if (!current) return;
      const at = linkRef.current?.range.start ?? matchRef.current?.start;
      if (at == null) return;
      const next = getTextareaCaretRect(current, at);
      setCaret((prev) => (sameCaret(prev, next) ? prev : next));
    }

    refresh();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", refresh);
    vv?.addEventListener("scroll", refresh);
    window.addEventListener("resize", refresh);
    ta.addEventListener("scroll", refresh);
    return () => {
      vv?.removeEventListener("resize", refresh);
      vv?.removeEventListener("scroll", refresh);
      window.removeEventListener("resize", refresh);
      ta.removeEventListener("scroll", refresh);
    };
  }, [showMenu, linkOpen, textareaRef]);

  useEffect(() => {
    if (!showMenu && !linkOpen) return;
    const onOutsideDown = (event: Event) => {
      if (eventInside(panelRef.current, event)) return;
      if (eventInside(fileRef.current, event)) return;
      closeAll();
    };
    document.addEventListener("mousedown", onOutsideDown);
    document.addEventListener("touchstart", onOutsideDown);
    return () => {
      document.removeEventListener("mousedown", onOutsideDown);
      document.removeEventListener("touchstart", onOutsideDown);
    };
  }, [showMenu, linkOpen, closeAll]);

  useLayoutEffect(() => {
    if (!linkSession) return;
    textInputRef.current?.focus();
  }, [linkSession]);

  useEffect(() => {
    if (!linkSession) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAll();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [linkSession, closeAll]);

  function confirmLink(event?: FormEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    const range = linkRangeRef.current ?? linkSession?.range;
    const href = linkHref.trim();
    if (!range || !href) return;
    const label = linkText.trim() || href;
    onInsertMarkdown(range, `[${label}](${href})`);
    closeAll();
  }

  const anchor = caret;
  const panelWidth = linkSession ? 320 : 220;
  const panelHeight = linkSession ? 104 : Math.max(48, commands.length * 44 + 8);
  const pos = anchor ? placeNearCaret(anchor, { width: panelWidth, height: panelHeight }) : null;
  const width = Math.min(panelWidth, pos?.maxWidth ?? panelWidth);

  const overlay =
    (showMenu || linkSession) && pos ? (
      <div
        ref={panelRef}
        role={linkSession ? "dialog" : "listbox"}
        aria-label={linkSession ? "插入链接" : "斜杠命令"}
        className="fixed z-40 rounded-lg border border-border bg-background shadow-lg"
        style={{ top: pos.top, left: Number.isFinite(pos.left) ? pos.left : 8, width: Math.max(196, width) }}
        onMouseDown={stopInsidePanel}
        onTouchStart={stopInsidePanel}
        onClick={stopInsidePanel}
      >
        {linkSession ? (
          <div className="flex flex-col gap-2 p-2">
            <input
              ref={textInputRef}
              className="h-10 w-full rounded-md border border-border bg-transparent px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-foreground/40"
              placeholder="显示文本"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              autoComplete="off"
              enterKeyHint="next"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  const urlInput = e.currentTarget.parentElement?.querySelector<HTMLInputElement>("input[inputmode='url']");
                  urlInput?.focus();
                }
              }}
            />
            <div className="flex items-center gap-1.5">
              <input
                className="h-10 min-w-0 flex-1 rounded-md border border-border bg-transparent px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-foreground/40"
                placeholder="https://"
                value={linkHref}
                onChange={(e) => setLinkHref(e.target.value)}
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                enterKeyHint="done"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    confirmLink();
                  }
                }}
              />
              <button
                type="button"
                aria-label="插入链接"
                disabled={!linkHref.trim()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  confirmLink();
                }}
                className="btn-primary h-8 w-16 shrink-0 px-0"
              >
                确定
              </button>
            </div>
          </div>
        ) : (
          <ul className="p-1">
            {commands.map((cmd, index) => (
              <li key={cmd.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  className={`flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition-colors ${
                    index === active ? "bg-muted text-foreground" : "text-muted-foreground"
                  }`}
                  onMouseEnter={() => setActive(index)}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    runCommand(cmd);
                  }}
                >
                  {commandIcon(cmd.id)}
                  <span className="font-mono">/{cmd.name}</span>
                  <span className="ml-auto hidden text-xs text-muted-foreground/70 sm:inline">{cmd.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    ) : null;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          const range = pendingImageRange.current;
          event.target.value = "";
          pendingImageRange.current = null;
          if (file && range) onPickImage(file, range);
        }}
      />
      {overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}
