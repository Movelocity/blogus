import { Link, useNavigate } from "react-router";
import { type ReactNode, type SubmitEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BlogFolder, BlogPost, CurrentUser, PostStatus } from "@blogus/shared";
import { siteConfig } from "../config/site";
import {
  createFolder as createFolderApi,
  createPost,
  deleteFolder as deleteFolderApi,
  deletePost,
  listFolders,
  listPosts,
  logout,
  refreshSession,
  renameFolder as renameFolderApi,
  updatePost,
  uploadFile,
  whoami,
} from "../lib/api";
import { MarkdownView } from "../lib/markdown";
import { SlashMenu, type TextRange } from "../components/editor/SlashMenu";
import { ImagePrepareDialog } from "../components/editor/ImagePrepareDialog";
import {
  ListIcon,
  NotePencilIcon,
  SignOutIcon,
  SpinnerIcon,
  UploadIcon,
  EyeIcon,
  PencilSimpleIcon,
  CaretUpIcon,
  CaretDownIcon,
  CaretRightIcon,
  FolderIcon,
  FolderPlusIcon,
  DotsThreeIcon,
  ArrowSquareOutIcon,
  ArrowUUpLeftIcon,
  ArrowCounterClockwiseIcon,
  ArchiveIcon,
  TrashIcon,
  PaperPlaneTiltIcon,
  SunIcon,
  MoonIcon,
} from "@phosphor-icons/react";
import { useTheme } from "../hooks/useTheme";

type EditorMode = "edit" | "preview";
type MetaDialogKind = "excerpt" | "tags";

function MetaDialog({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/10 p-4 sm:items-center"
      // 用 mousedown 而非 click：避免在输入框里拖选文字、松手时鼠标已在遮罩上，
      // click 会在公共祖先（遮罩）上触发导致误关弹窗
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-background p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}

function splitTags(input: string) {
  return input.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12);
}

function statusLabel(s: PostStatus) {
  return s === "published" ? "已发布" : s === "archived" ? "已归档" : "草稿";
}

function statusDotClass(s: PostStatus) {
  return s === "published" ? "bg-emerald-500" : s === "archived" ? "bg-muted-foreground/30" : "bg-amber-500";
}

export function AdminPage() {
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("edit");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [folderMenuOpenId, setFolderMenuOpenId] = useState<string | null>(null);
  const [draftFolderId, setDraftFolderId] = useState<string | null>(null);
  const [metaDialog, setMetaDialog] = useState<MetaDialogKind | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [folders, setFolders] = useState<BlogFolder[]>([]);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderText, setNewFolderText] = useState("");
  const [draggingPostId, setDraggingPostId] = useState<string | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);
  const [rootDropActive, setRootDropActive] = useState(false);
  const [imageJob, setImageJob] = useState<{ file: File; range: TextRange } | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem("blogus-admin-folders") ?? "{}");
    } catch {
      return {};
    }
  });
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const folderMenuRef = useRef<HTMLDivElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const selectedPost = useMemo(() => posts.find((p) => p.id === selectedId) ?? null, [posts, selectedId]);
  const tags = splitTags(tagsText);
  const isDirty = useMemo(() => {
    const currentTags = splitTags(tagsText);
    if (!selectedPost) {
      return Boolean(title || content || excerpt || coverImageUrl || tagsText);
    }
    const tagsChanged =
      currentTags.length !== selectedPost.tags.length ||
      currentTags.some((tag, index) => tag !== selectedPost.tags[index]);
    return (
      title !== selectedPost.title ||
      content !== selectedPost.content ||
      excerpt !== (selectedPost.excerpt ?? "") ||
      coverImageUrl !== (selectedPost.coverImageUrl ?? "") ||
      tagsChanged
    );
  }, [selectedPost, title, content, excerpt, coverImageUrl, tagsText]);

  // 目录是独立实体（folders 表）：空目录也展示；folderId 指向他人目录的文章按未收录处理
  const groupedPosts = useMemo(() => {
    const byFolder = new Map<string, BlogPost[]>();
    const unfiled: BlogPost[] = [];
    const knownIds = new Set(folders.map((f) => f.id));
    for (const p of posts) {
      if (p.folderId && knownIds.has(p.folderId)) {
        const list = byFolder.get(p.folderId) ?? [];
        list.push(p);
        byFolder.set(p.folderId, list);
      } else {
        unfiled.push(p);
      }
    }
    const groups = folders.map((f) => ({ folder: f, posts: byFolder.get(f.id) ?? [] }));
    return { groups, unfiled };
  }, [posts, folders]);

  // 用户菜单打开时，点击菜单外部关闭。
  // 注意：真实鼠标事件在监听器之间会跑微任务，React 可能在同一次点击的
  // 冒泡途中就挂上了 document 监听，所以必须判断点击目标是否在菜单内部，
  // 不能用“任意点击都关闭”的写法（否则打开菜单的那次点击会立即把它关掉）。
  useEffect(() => {
    if (!userMenuOpen) return;
    const onDocumentClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!folderMenuOpenId) return;
    const onDocumentClick = (e: MouseEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) {
        setFolderMenuOpenId(null);
      }
    };
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [folderMenuOpenId]);

  useEffect(() => {
    if (!actionMenuOpen) return;
    const onDocumentClick = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuOpen(false);
      }
    };
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [actionMenuOpen]);

  function loadPost(post: BlogPost) {
    setSelectedId(post.id);
    setTitle(post.title);
    setContent(post.content);
    setExcerpt(post.excerpt ?? "");
    setCoverImageUrl(post.coverImageUrl ?? "");
    setTagsText(post.tags.join(", "));
    setDraftFolderId(null);
    setEditorMode("edit");
    setMessage(null);
    setError(null);
    setActionMenuOpen(false);
  }

  function startNewPost() {
    setSelectedId(null);
    setTitle("");
    setContent("");
    setExcerpt("");
    setCoverImageUrl("");
    setTagsText("");
    setDraftFolderId(null);
    setEditorMode("edit");
    setMessage(null);
    setError(null);
    setActionMenuOpen(false);
  }

  function startNewPostInFolder(folder: BlogFolder) {
    startNewPost();
    setDraftFolderId(folder.id);
  }

  async function refreshPosts(nextSelectedId = selectedId) {
    const result = await listPosts({ visibility: "all" });
    setPosts(result.posts);
    if (nextSelectedId) {
      const next = result.posts.find((p) => p.id === nextSelectedId);
      if (next) loadPost(next);
    }
  }

  async function refreshFolders() {
    const result = await listFolders();
    setFolders(result.folders);
  }

  useEffect(() => {
    (async () => {
      const refreshed = await refreshSession();
      if (!refreshed) {
        setAuthChecked(true);
        return;
      }
      Promise.all([whoami(), listPosts({ visibility: "all" }), listFolders()])
        .then(([cu, result, folderResult]) => {
          setUser(cu.user);
          setFolders(folderResult.folders);
          setPosts(result.posts);
          if (result.posts[0]) loadPost(result.posts[0]);
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : "加载失败"))
        .finally(() => setAuthChecked(true));
    })();
  }, []);

  async function handleLogout() {
    setError(null);
    try {
      await logout();
      setUser(null);
      setPosts([]);
      startNewPost();
      setMessage("已退出登录");
    } catch (e) {
      setError(e instanceof Error ? e.message : "退出失败");
    }
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    event.stopPropagation();
    await savePost();
  }

  // Ctrl/Cmd+S 快捷保存也会走这里；saving 期间重入直接忽略
  async function savePost() {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      if (selectedPost) {
        const r = await updatePost(selectedPost.id, { title, content, excerpt, coverImageUrl, tags });
        setMessage(`已保存：${r.post.title}`);
        await refreshPosts(r.post.id);
      } else {
        const r = await createPost({ title, content, excerpt, coverImageUrl, tags, folderId: draftFolderId, status: "draft" });
        setMessage(`草稿已创建：${r.post.title}`);
        await refreshPosts(r.post.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  // Ctrl/Cmd+S 保存：挂在 window 上，编辑器内任何焦点位置都生效。
  // 必须放在未登录 early return 之前，否则鉴权失败后 hook 数量会变少，页面白屏。
  const saveRef = useRef(savePost);
  saveRef.current = savePost;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useLayoutEffect(() => {
    const pos = pendingCaretRef.current;
    if (pos == null) return;
    pendingCaretRef.current = null;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(pos, pos);
  }, [content]);

  useEffect(() => {
    if (authChecked && !user) {
      navigate("/login", { replace: true });
    }
  }, [authChecked, user, navigate]);

  if (!authChecked || !user) {
    return null;
  }

  async function changeStatus(id: string, status: PostStatus) {
    const post = posts.find((p) => p.id === id);
    if (!post) return;
    const cm: Partial<Record<PostStatus, string>> = {
      archived: `确认将「${post.title}」归档？`,
      draft: post.status === "archived" ? `确认取消归档「${post.title}」？` : "",
    };
    if (cm[status] && !window.confirm(cm[status])) return;
    setError(null);
    try {
      const r = await updatePost(id, { status });
      const lm: Record<string, string> = {
        published: `已发布：${r.post.title}`,
        draft: post.status === "archived" ? `已取消归档：${r.post.title}` : `已撤回：${r.post.title}`,
        archived: `已归档：${r.post.title}`,
      };
      setMessage(lm[status] ?? `状态已更新：${r.post.title}`);
      await refreshPosts(r.post.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "状态更新失败");
    }
  }

  async function remove(id: string) {
    const post = posts.find((p) => p.id === id);
    setError(null);
    if (!window.confirm(`确认删除「${post?.title ?? "这篇文章"}」？`)) return;
    setActionMenuOpen(false);
    try {
      await deletePost(id);
      setMessage("文章已删除");
      startNewPost();
      await refreshPosts(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  }

  function discardChanges() {
    if (!selectedPost) return;
    loadPost(selectedPost);
    setMessage("已放弃未保存的修改");
  }

  function handleDiscardChanges() {
    if (!isDirty) return;
    if (!window.confirm("确定放弃未保存的修改？")) return;
    discardChanges();
  }

  function handleViewFrontend() {
    if (!selectedPost) return;
    if (isDirty && !window.confirm("有未保存的修改。放弃修改并查看前台？")) {
      return;
    }
    if (isDirty) discardChanges();
    setActionMenuOpen(false);
    navigate(`/posts/${selectedPost.slug}`);
  }

  function insertMarkdown(md: string, range: TextRange) {
    const pos = range.start + md.length;
    pendingCaretRef.current = pos;
    setContent((prev) => `${prev.slice(0, range.start)}${md}${prev.slice(range.end)}`);
  }

  async function handleCoverUpload(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const r = await uploadFile(file);
      setCoverImageUrl(r.file.url);
      setMessage("封面图已上传");
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    }
  }

  function persistCollapsed(next: Record<string, boolean>) {
    localStorage.setItem("blogus-admin-folders", JSON.stringify(next));
    return next;
  }

  function toggleFolder(id: string) {
    setCollapsedFolders((prev) => persistCollapsed({ ...prev, [id]: !prev[id] }));
  }

  async function submitNewFolder() {
    const name = newFolderText.trim();
    setCreatingFolder(false);
    setNewFolderText("");
    if (!name) return;
    setError(null);
    try {
      await createFolderApi(name);
      setMessage(`目录已创建：${name}`);
      await refreshFolders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建目录失败");
    }
  }

  async function submitRenameFolder(id: string) {
    const folder = folders.find((f) => f.id === id);
    const next = renameText.trim();
    setRenamingFolderId(null);
    if (!folder || !next || next === folder.name) return;
    setError(null);
    try {
      await renameFolderApi(id, next);
      setMessage(`目录已重命名为：${next}`);
      await refreshFolders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "重命名失败");
    }
  }

  async function removeFolder(folder: BlogFolder) {
    const count = posts.filter((p) => p.folderId === folder.id).length;
    const hint = count > 0 ? `，其中 ${count} 篇文章将移回根目录` : "";
    if (!window.confirm(`确认删除目录「${folder.name}」${hint}？`)) return;
    setError(null);
    try {
      await deleteFolderApi(folder.id);
      setMessage(`目录已删除：${folder.name}`);
      await Promise.all([refreshFolders(), refreshPosts()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除目录失败");
    }
  }

  // 拖拽收录：拖到目录行 = 移入该目录；拖到列表其他位置 = 移回根目录。
  // 用自定义 MIME 类型标识内部文章拖拽，避免和文本/文件拖拽互相干扰
  const POST_DRAG_TYPE = "application/x-blogus-post";

  function isPostDrag(e: React.DragEvent) {
    return e.dataTransfer.types.includes(POST_DRAG_TYPE);
  }

  async function movePostToFolder(postId: string, folderId: string | null) {
    const post = posts.find((p) => p.id === postId);
    if (!post || (post.folderId ?? null) === folderId) return;
    setError(null);
    try {
      await updatePost(postId, { folderId });
      const name = folderId ? folders.find((f) => f.id === folderId)?.name : null;
      setMessage(name ? `已移动到：${name}` : `已移回根目录：${post.title}`);
      await refreshPosts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "移动失败");
    }
  }

  function renderPostRow(post: BlogPost, indent = false) {
    return (
      <button
        key={post.id}
        onClick={() => { loadPost(post); setSidebarOpen(false); }}
        type="button"
        draggable
        title={post.title || "未命名文章"}
        onDragStart={(e) => {
          e.dataTransfer.setData(POST_DRAG_TYPE, post.id);
          e.dataTransfer.effectAllowed = "move";
          setDraggingPostId(post.id);
        }}
        onDragEnd={() => {
          setDraggingPostId(null);
          setDropTargetFolderId(null);
          setRootDropActive(false);
        }}
        className={`flex items-center gap-2 mb-1 rounded-md py-1.5 pr-2.5 text-left transition-colors ${indent ? "pl-7" : "pl-2.5"} ${
          draggingPostId === post.id ? "opacity-40" : ""
        } ${
          post.id === selectedId
            ? "bg-muted text-foreground"
            : "text-foreground/80 hover:bg-muted hover:text-foreground"
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-sm">{post.title || "未命名文章"}</span>
        <span
          className={`size-1.5 shrink-0 rounded-full ${statusDotClass(post.status)}`}
          title={statusLabel(post.status)}
        />
      </button>
    );
  }

  return (
    <div className="flex h-dvh overflow-x-hidden">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(true)}
        type="button"
        className="fixed left-4 top-2 z-30 rounded-md  bg-background px-3 py-2 lg:hidden"
        aria-label="打开文章列表"
      >
        <ListIcon size={18} />
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-30 flex h-dvh w-[280px] flex-col border-r border-border bg-sidebar transition-transform duration-300 ease-out max-lg:-translate-x-full ${sidebarOpen ? "max-lg:translate-x-0" : ""}`}
      >
        {/* Brand - 点击回首页 */}
        <Link
          to="/"
          className="mb-1.5 flex items-center rounded-md px-4 py-3 transition-colors w-fit"
          aria-label="回到首页"
        >
          <span className="font-display text-lg font-semibold tracking-tight text-foreground">{siteConfig.name}</span>
        </Link>

        {/* Nav */}
        <nav className="flex flex-col pb-2">
          <button
            onClick={() => { startNewPost(); setSidebarOpen(false); }}
            type="button"
            className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
          >
            <NotePencilIcon size={17} className="shrink-0" />
            新建文章
          </button>
        </nav>

        {/* Section label */}
        <div className="flex items-center justify-between px-3 pb-1.5 pt-2 group">
          <span className="text-sm text-muted-foreground">文章</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="新建目录"
              title="新建目录"
              onClick={() => { setCreatingFolder(true); setNewFolderText(""); }}
              className="rounded-sm p-0.5 text-muted-foreground/60 transition-colors hover:text-muted-foreground invisible group-hover:visible"
            >
              <FolderPlusIcon size={18} />
            </button>
            {/* <span className="font-mono text-xs text-muted-foreground/50">{posts.length}</span> */}
          </div>
        </div>

        {/* Post list - 按目录分组（空目录也展示），未收录的扁平排列在组后；拖到空白处移回根目录 */}
        <div
          className={`flex-1 overflow-y-auto transition-colors ${
            rootDropActive && draggingPostId ? "rounded-md bg-muted/30" : ""
          }`}
          onDragOver={(e) => {
            if (!isPostDrag(e)) return;
            e.preventDefault();
            setRootDropActive(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setRootDropActive(false);
          }}
          onDrop={(e) => {
            if (!isPostDrag(e)) return;
            e.preventDefault();
            const postId = e.dataTransfer.getData(POST_DRAG_TYPE);
            setRootDropActive(false);
            setDraggingPostId(null);
            void movePostToFolder(postId, null);
          }}
        >
          {creatingFolder ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground">
              <FolderPlusIcon size={14} className="shrink-0" />
              <input
                autoFocus
                className="min-w-0 flex-1 border-b border-foreground/40 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
                placeholder="目录名"
                value={newFolderText}
                onChange={(e) => setNewFolderText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitNewFolder();
                  if (e.key === "Escape") setCreatingFolder(false);
                }}
                onBlur={() => setCreatingFolder(false)}
              />
            </div>
          ) : null}
          {posts.length === 0 && folders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无文章</p>
          ) : (
            <div className="flex flex-col px-3">
              {groupedPosts.groups.map(({ folder, posts: groupPosts }) => (
                <div
                  key={folder.id}
                  className="flex flex-col"
                  onDragOver={(e) => {
                    if (!isPostDrag(e)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setDropTargetFolderId(folder.id);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDropTargetFolderId((cur) => (cur === folder.id ? null : cur));
                    }
                  }}
                  onDrop={(e) => {
                    if (!isPostDrag(e)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const postId = e.dataTransfer.getData(POST_DRAG_TYPE);
                    setDropTargetFolderId(null);
                    setDraggingPostId(null);
                    void movePostToFolder(postId, folder.id);
                  }}
                >
                  {renamingFolderId === folder.id ? (
                    <div className="flex w-full items-center gap-1.5 px-2 py-1.5 text-muted-foreground">
                      <FolderIcon size={14} className="shrink-0" />
                      <input
                        autoFocus
                        className="min-w-0 flex-1 border-b border-foreground/40 bg-transparent text-sm text-foreground outline-none"
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void submitRenameFolder(folder.id);
                          if (e.key === "Escape") setRenamingFolderId(null);
                        }}
                        onBlur={() => setRenamingFolderId(null)}
                      />
                    </div>
                  ) : (
                    <div
                      className={`group relative flex w-full items-center rounded-lg transition-colors hover:bg-muted mb-1 ${
                        dropTargetFolderId === folder.id ? "bg-muted ring-1 ring-inset ring-foreground/20" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleFolder(folder.id)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 pr-14 text-left text-foreground/80 transition-colors"
                      >
                        <FolderIcon size={15} className="shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-sm">{folder.name}</span>
                      </button>
                      <div
                        ref={folderMenuOpenId === folder.id ? folderMenuRef : undefined}
                        className={`absolute right-1 flex items-center gap-0.5 transition-opacity ${
                          folderMenuOpenId === folder.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        <div className="relative">
                          <button
                            type="button"
                            aria-label={`目录菜单 ${folder.name}`}
                            aria-expanded={folderMenuOpenId === folder.id}
                            onClick={() => setFolderMenuOpenId((id) => (id === folder.id ? null : folder.id))}
                            className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                          >
                            <DotsThreeIcon size={18} weight="bold" />
                          </button>
                          {folderMenuOpenId === folder.id ? (
                            <div className="absolute right-0 top-full z-50 mt-1 min-w-[10.5rem] rounded-lg border border-border bg-background p-1 shadow-lg">
                              <button
                                type="button"
                                onClick={() => {
                                  setFolderMenuOpenId(null);
                                  setRenamingFolderId(folder.id);
                                  setRenameText(folder.name);
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              >
                                <PencilSimpleIcon size={15} className="shrink-0" />
                                重命名
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setFolderMenuOpenId(null);
                                  void removeFolder(folder);
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              >
                                <TrashIcon size={15} className="shrink-0" />
                                删除
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          aria-label={`在 ${folder.name} 中新建文章`}
                          onClick={() => {
                            startNewPostInFolder(folder);
                            setSidebarOpen(false);
                          }}
                          className="rounded-sm p-1 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                        >
                          <NotePencilIcon size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                  {!collapsedFolders[folder.id] ? (
                    <div className="flex flex-col">{groupPosts.map((post) => renderPostRow(post, true))}</div>
                  ) : null}
                </div>
              ))}
              {groupedPosts.unfiled.map((post) => renderPostRow(post))}
            </div>
          )}
        </div>

        {/* User settings */}
        {user ? (
          <div ref={userMenuRef} className="relative border-t border-border">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-label="用户菜单"
              aria-expanded={userMenuOpen}
              className={`flex w-full items-center gap-2 px-4 py-3 text-left transition-colors ${
                userMenuOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs uppercase text-gray-50">
                {user.email.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{user.email}</span>
            </button>
            {userMenuOpen ? (
              <div className="absolute bottom-full left-0 z-50 mb-2 m-[5px] w-[calc(100%-10px)] rounded-xl border border-border bg-muted p-1.5 shadow-lg">
                <div className="flex items-center gap-2 border-b border-border px-2 pb-2 pt-1">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[10px] uppercase text-gray-50">
                    {user.email.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {theme === "dark" ? (
                    <SunIcon size={15} className="shrink-0" />
                  ) : (
                    <MoonIcon size={15} className="shrink-0" />
                  )}
                  {theme === "dark" ? "浅色模式" : "深色模式"}
                </button>
                <button
                  type="button"
                  onClick={() => { setUserMenuOpen(false); void handleLogout(); }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <SignOutIcon size={15} className="shrink-0" />
                  退出登录
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </aside>

      {/* Mobile backdrop */}
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-20 bg-black/10 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      {/* Editor area */}
      <div className="flex h-full min-w-0 flex-1 flex-col lg:ml-[280px]">
        <form className="flex h-full min-h-0 min-w-0 flex-col" onSubmit={handleSubmit}>
          {/* Toolbar - fixed at top while content scrolls */}
          <div className="z-20 flex shrink-0 min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border bg-background px-6 py-2.5 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5 ml-12 lg:ml-0">
              <span className="shrink-0 font-display text-base font-medium text-foreground">
                {selectedPost ? "编辑" : "新建"}
              </span>
              {selectedPost ? (
                <>
                  <span className="truncate font-mono text-muted-foreground">
                    {selectedPost.slug}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    <span className={`size-1.5 rounded-full ${statusDotClass(selectedPost.status)}`} />
                    {statusLabel(selectedPost.status)}
                  </span>
                </>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {message ? (
                <span className="max-w-[220px] truncate text-xs text-emerald-600" title={message}>{message}</span>
              ) : null}
              {selectedPost ? (
                <>
                  {selectedPost.status === "archived" ? (
                    <button
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => void changeStatus(selectedPost.id, "draft")}
                      type="button"
                    >
                      取消归档
                    </button>
                  ) : null}
                </>
              ) : null}
              <button
                type="button"
                onClick={() => setEditorMode(editorMode === "edit" ? "preview" : "edit")}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {editorMode === "edit" ? (
                  <><EyeIcon size={14} className="inline mr-1" />预览</>
                ) : (
                  <><PencilSimpleIcon size={14} className="inline mr-1" />编辑</>
                )}
              </button>
              {selectedPost ? (
                <div ref={actionMenuOpen ? actionMenuRef : undefined} className="relative">
                  <button
                    type="button"
                    aria-label="更多操作"
                    aria-expanded={actionMenuOpen}
                    onClick={() => setActionMenuOpen((open) => !open)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <DotsThreeIcon size={18} weight="bold" />
                  </button>
                  {actionMenuOpen ? (
                    <div className="absolute right-0 top-full z-50 mt-1 min-w-[10.5rem] rounded-lg border border-border bg-background p-1 shadow-lg">
                      {selectedPost.status !== "published" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActionMenuOpen(false);
                            void changeStatus(selectedPost.id, "published");
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <PaperPlaneTiltIcon size={15} className="shrink-0" />
                          发布
                        </button>
                      ) : null}
                      {selectedPost.status === "published" ? (
                        <>
                          <button
                            type="button"
                            onClick={handleViewFrontend}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <ArrowSquareOutIcon size={15} className="shrink-0" />
                            查看前台
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActionMenuOpen(false);
                              void changeStatus(selectedPost.id, "draft");
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <ArrowUUpLeftIcon size={15} className="shrink-0" />
                            撤回
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActionMenuOpen(false);
                              void changeStatus(selectedPost.id, "archived");
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <ArchiveIcon size={15} className="shrink-0" />
                            归档
                          </button>
                        </>
                      ) : null}
                      {isDirty ? (
                        <button
                          type="button"
                          onClick={handleDiscardChanges}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <ArrowCounterClockwiseIcon size={15} className="shrink-0" />
                          放弃修改
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void remove(selectedPost.id)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <TrashIcon size={15} className="shrink-0" />
                        删除
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <button
                className="btn-primary h-8 min-w-[72px]"
                disabled={saving}
                type="submit"
              >
                {saving ? <SpinnerIcon size={14} className="animate-spin" /> : selectedPost ? "保存 (⌘S)" : "创建草稿"}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className={`min-h-0 flex-1 min-w-0 w-full px-6 pt-5 lg:px-8 ${editorMode === "edit" ? "flex flex-col pb-5" : "overflow-y-auto pb-12 max-w-4xl mx-auto pb-24"}`}>
            {error ? (
              <div className="mb-4 shrink-0 rounded bg-destructive/5 px-3 py-2 font-mono text-sm text-destructive">{error}</div>
            ) : null}

            {editorMode === "edit" ? (
              <div className="flex min-h-0 flex-1 flex-col gap-4">
                {/* Title - bottom border only */}
                <input
                  className="w-full shrink-0 border-b border-border bg-transparent pb-3 font-display text-2xl font-semibold tracking-tight text-foreground outline-none transition-colors focus:border-foreground/40 placeholder:text-muted-foreground/30"
                  maxLength={240}
                  placeholder="标题"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />

                {/* Cover + meta - minimal row */}
                <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <label className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
                    <UploadIcon size={14} />
                    封面
                    <input accept="image/*" className="hidden" type="file" onChange={(e) => void handleCoverUpload(e.target.files?.[0])} />
                  </label>
                  <button
                    type="button"
                    onClick={() => setMetaDialog("excerpt")}
                    className={`flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground ${excerpt ? "text-foreground" : ""}`}
                  >
                    摘要
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetaDialog("tags")}
                    className={`flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground ${tags.length > 0 ? "text-foreground" : ""}`}
                  >
                    标签{tags.length > 0 ? ` (${tags.length})` : ""}
                  </button>
                  <input
                    className="ml-auto min-w-0 flex-1 border-b border-transparent bg-transparent text-right text-xs text-muted-foreground/40 outline-none transition-colors focus:border-border focus:text-muted-foreground"
                    placeholder="封面 URL"
                    value={coverImageUrl}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                  />
                </div>

                {/* Markdown body：flex-1 自动填满剩余屏幕高度，内容超长时内部滚动，仍保留右下角手动拖拽 */}
                <div className="relative flex min-h-[120px] w-full flex-1 flex-col">
                  <textarea
                    className="min-h-[120px] w-full flex-1 resize-y overflow-y-auto border-b border-border bg-transparent pb-2 font-mono text-base leading-relaxed text-foreground outline-none transition-colors focus:border-foreground/40"
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="正文 (Markdown)，输入 / 插入图片或链接"
                  />
                  <SlashMenu
                    textareaRef={textareaRef}
                    value={content}
                    paused={Boolean(imageJob)}
                    onInsertMarkdown={(range, markdown) => insertMarkdown(markdown, range)}
                    onPickImage={(file, range) => {
                      setError(null);
                      setImageJob({ file, range });
                    }}
                  />
                </div>
              </div>
            ) : (
              <article className="pb-12">
                {coverImageUrl ? (
                  <img alt="" className="mb-6 max-h-72 w-full rounded-md object-cover" src={coverImageUrl} />
                ) : null}
                <h1 className="mb-3 break-words font-display text-4xl font-semibold leading-tight tracking-tight text-foreground">
                  {title || "未命名文章"}
                </h1>
                {tags.length > 0 ? (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {tags.map((t) => (
                      <span key={t} className="text-sm text-muted-foreground/50">#{t}</span>
                    ))}
                  </div>
                ) : null}
                {excerpt ? <p className="mb-6 text-base leading-relaxed text-muted-foreground">{excerpt}</p> : null}
                <MarkdownView content={content} />
              </article>
            )}
          </div>
        </form>

        <MetaDialog
          open={metaDialog === "excerpt"}
          onClose={() => setMetaDialog(null)}
          label="编辑摘要"
        >
          <textarea
            autoFocus
            className="min-h-[120px] w-full resize-y border-b border-border bg-transparent pb-2 text-base text-foreground outline-none transition-colors focus:border-foreground/40 placeholder:text-muted-foreground/40"
            maxLength={1000}
            placeholder="摘要"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
          />
        </MetaDialog>

        {imageJob ? (
          <ImagePrepareDialog
            file={imageJob.file}
            onClose={() => setImageJob(null)}
            onInsert={async (output) => {
              const r = await uploadFile(output);
              insertMarkdown(`![${output.name}](${r.file.url})`, imageJob.range);
              setImageJob(null);
              setMessage("图片已上传并插入正文");
            }}
          />
        ) : null}

        <MetaDialog
          open={metaDialog === "tags"}
          onClose={() => setMetaDialog(null)}
          label="编辑标签"
        >
          <input
            autoFocus
            className="w-full border-b border-border bg-transparent pb-2 text-base text-foreground outline-none transition-colors focus:border-foreground/40 placeholder:text-muted-foreground/40"
            placeholder="标签，逗号分隔"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
          />
          {tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="text-xs text-muted-foreground/60">#{t}</span>
              ))}
            </div>
          ) : null}
        </MetaDialog>
      </div>
    </div>
  );
}
