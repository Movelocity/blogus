import { StrictMode, Suspense, lazy } from "react";
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

function PageLoader() {
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
