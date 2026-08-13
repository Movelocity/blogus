import { StrictMode, Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { BlogLayout } from "./components/layouts/BlogLayout";
import { PostLayout } from "./components/layouts/PostLayout";
import { ScrollToTop } from "./components/ScrollToTop";
import { SessionWatcher } from "./components/SessionWatcher";
import { useTheme } from "./hooks/useTheme";
import "./tailwind.css";

// 把每个页面拆成独立 chunk，访问时才下载。
const LandingPage = lazy(() =>
  import("./pages/LandingPage").then((m) => ({ default: m.LandingPage })),
);
const HomePage = lazy(() =>
  import("./pages/HomePage").then((m) => ({ default: m.HomePage })),
);
const ArchivePage = lazy(() =>
  import("./pages/ArchivePage").then((m) => ({ default: m.ArchivePage })),
);
const CalendarPage = lazy(() =>
  import("./pages/CalendarPage").then((m) => ({ default: m.CalendarPage })),
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const PostPage = lazy(() =>
  import("./pages/PostPage").then((m) => ({ default: m.PostPage })),
);
const AdminPage = lazy(() =>
  import("./pages/AdminPage").then((m) => ({ default: m.AdminPage })),
);

// 延迟显示加载提示：chunk 在 250ms 内就绪则不显示任何 fallback，
// 避免「加载中」一闪而过造成的视觉跳动（本地开发按需编译时尤其明显）。
// 超过阈值才出现。fallback 一旦卸载直接消失，不做最小停留——
// 需要它出现的场景（慢网络）本身加载就慢，再闪一次的概率很低。
function PageLoader() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 250);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-label="页面加载中"
      className="grid min-h-[60vh] place-items-center"
    >
      <div className="flex items-center gap-3 font-mono text-sm text-muted-foreground">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        加载中...
      </div>
    </div>
  );
}

function App() {
  useTheme();
  return (
    <BrowserRouter>
      <SessionWatcher />
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<LandingPage />} path="/" />
          <Route element={<BlogLayout />}>
            <Route element={<HomePage />} path="/blog" />
            <Route element={<ArchivePage />} path="/archive" />
            <Route element={<CalendarPage />} path="/calendar" />
            <Route element={<LoginPage />} path="/login" />
          </Route>
          <Route element={<PostLayout />}>
            <Route element={<PostPage />} path="/posts/:slug" />
          </Route>
          <Route element={<AdminPage />} path="/admin" />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
