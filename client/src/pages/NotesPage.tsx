import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BlogNote, CurrentUser, NoteVisibility } from "@blogus/shared";
import { refreshSession, whoami } from "../lib/api";
import {
  archiveNote,
  createNote,
  deleteNote,
  listNotes,
  searchNotes,
  updateNote,
} from "../lib/notes";
import { ToastView, useToast } from "../lib/toast";
import { NoteCard } from "../components/notes/NoteCard";
import { NoteEditor } from "../components/notes/NoteEditor";
import { NoteSidebar } from "../components/notes/NoteSidebar";
import { SpinnerGap } from "@phosphor-icons/react";

const PAGE_SIZE = 15;

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "操作失败";
}

/**
 * 笔记页：公开 + 管理一体。登录显示编辑器与完整过滤，匿名只读公开笔记。
 */
export function NotesPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const [notes, setNotes] = useState<BlogNote[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [selectedTag, setSelectedTag] = useState<string | undefined>(undefined);
  const [showPublicOnly, setShowPublicOnly] = useState(false);
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);

  const { toasts, dismiss, notify } = useToast();
  const loadingRef = useRef(false);

  // 判定登录态：先 refreshSession 探明是否有有效会话，再 whoami 取用户信息。
  // 直接调 whoami() 在匿名时返回 401 会触发 session-expired 跳登录，需先探明。
  useEffect(() => {
    (async () => {
      const refreshed = await refreshSession();
      if (refreshed) {
        try {
          const { user } = await whoami();
          setCurrentUser(user);
          setIsAuthenticated(true);
        } catch {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
      setAuthReady(true);
    })();
  }, []);

  const visibility: NoteVisibility = showArchivedOnly
    ? "archived"
    : isAuthenticated
      ? "all"
      : "published";

  const loadNotes = useCallback(
    async (pageNum: number, append: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      try {
        let result;
        if (selectedDate) {
          result = await listNotes({ visibility, date: selectedDate, page: 1, pageSize: PAGE_SIZE });
        } else if (searchKeyword) {
          result = await searchNotes(searchKeyword, { page: pageNum, pageSize: PAGE_SIZE });
        } else {
          result = await listNotes({
            visibility,
            tag: selectedTag,
            isPublic: showPublicOnly ? true : undefined,
            page: pageNum,
            pageSize: PAGE_SIZE,
          });
        }
        setNotes((prev) => (append ? [...prev, ...result.notes] : result.notes));
        setTotal(result.total);
        setPage(pageNum);
      } catch (cause) {
        notify(errorMessage(cause), "error");
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [visibility, selectedTag, showPublicOnly, selectedDate, searchKeyword, notify],
  );

  // 过滤/搜索/翻页条件变化时重新加载
  useEffect(() => {
    if (!authReady) return;
    setNotes([]);
    setPage(1);
    void loadNotes(1, false);
  }, [authReady, loadNotes]);

  const hasMore = notes.length < total;

  const handleCreate = async (content: string, tags: string[], isPublic: boolean) => {
    setCreating(true);
    try {
      await createNote({ content, isPublic, tags });
      notify("笔记创建成功", "success");
      await loadNotes(1, false);
      return true;
    } catch (cause) {
      notify(errorMessage(cause), "error");
      return false;
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (
    id: string,
    updates: Partial<Pick<BlogNote, "content" | "isPublic" | "tags">>,
  ) => {
    try {
      await updateNote(id, updates);
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
      return true;
    } catch (cause) {
      notify(errorMessage(cause), "error");
      return false;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      return true;
    } catch (cause) {
      notify(errorMessage(cause), "error");
      return false;
    }
  };

  const handleArchive = async (id: string, isArchived: boolean) => {
    try {
      await archiveNote(id, isArchived);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      return true;
    } catch (cause) {
      notify(errorMessage(cause), "error");
      return false;
    }
  };

  const tagStats = useMemo(() => {
    const m: Record<string, number> = {};
    for (const n of notes) {
      for (const tag of n.tags) {
        m[tag] = (m[tag] ?? 0) + 1;
      }
    }
    return m;
  }, [notes]);

  const emptyHint = searchKeyword
    ? `没有找到包含「${searchKeyword}」的笔记`
    : selectedDate
      ? `${selectedDate} 当天没有笔记`
      : selectedTag
        ? "没有找到相关标签的笔记"
        : isAuthenticated
          ? "还没有笔记，开始写下第一条吧"
          : "还没有公开笔记可查看";

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* 主内容区 */}
      <div className="min-w-0 flex-1 space-y-3 xl:mx-auto xl:w-full xl:max-w-3xl">
        <header className="mb-4">
          <p className="font-mono text-sm uppercase tracking-[0.3em] text-muted-foreground">
            随手记 · Notes
          </p>
        </header>

        {isAuthenticated && (
          <NoteEditor onSubmit={handleCreate} loading={creating} />
        )}

        {!isAuthenticated && (
          <p className="border-l-2 border-foreground/15 px-4 py-3 text-lg text-muted-foreground">
            这里展示公开笔记。登录后可创建、编辑自己的笔记。
          </p>
        )}

        {loading && notes.length === 0 ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <span className="flex items-center gap-2.5 text-lg text-muted-foreground">
              <SpinnerGap className="h-5 w-5 animate-spin" />
              加载中...
            </span>
          </div>
        ) : notes.length === 0 ? (
          <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-foreground/15">
            <p className="text-lg text-muted-foreground">{emptyHint}</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  isOwner={Boolean(currentUser && currentUser.id === note.userId)}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onArchive={handleArchive}
                  notify={notify}
                />
              ))}
            </div>

            {hasMore && (
              <div className="pt-2 text-center">
                <button
                  onClick={() => void loadNotes(page + 1, true)}
                  disabled={loading}
                  className="px-6 py-3 text-lg text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  {loading ? "加载中..." : "加载更多"}
                </button>
              </div>
            )}
            {!hasMore && notes.length > 0 && (
              <div className="pt-2 text-center text-base text-muted-foreground/60">
                已显示全部 {total} 条笔记
              </div>
            )}
          </>
        )}
      </div>

      {/* 侧栏 */}
      <NoteSidebar
        isAuthenticated={isAuthenticated}
        selectedTag={selectedTag}
        onSelectTag={setSelectedTag}
        showPublicOnly={showPublicOnly}
        onTogglePublic={() => setShowPublicOnly((v) => !v)}
        showArchivedOnly={showArchivedOnly}
        onToggleArchived={() => setShowArchivedOnly((v) => !v)}
        searchKeyword={searchKeyword}
        onSearch={setSearchKeyword}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        tagStats={tagStats}
      />

      <ToastView toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
