import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { AdminPage } from "./pages/AdminPage";
import { ArchivePage } from "./pages/ArchivePage";
import { HomePage } from "./pages/HomePage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { PostPage } from "./pages/PostPage";
import { BlogLayout } from "./components/layouts/BlogLayout";
import { PostLayout } from "./components/layouts/PostLayout";
import { ScrollToTop } from "./components/ScrollToTop";
import { SessionWatcher } from "./components/SessionWatcher";
import { useTheme } from "./hooks/useTheme";
import "./tailwind.css";

function App() {
  useTheme();
  return (
    <BrowserRouter>
      <SessionWatcher />
      <ScrollToTop />
      <Routes>
        <Route element={<LandingPage />} path="/" />
        <Route element={<BlogLayout />}>
          <Route element={<HomePage />} path="/blog" />
          <Route element={<ArchivePage />} path="/archive" />
          <Route element={<LoginPage />} path="/login" />
        </Route>
        <Route element={<PostLayout />}>
          <Route element={<PostPage />} path="/posts/:slug" />
        </Route>
        <Route element={<AdminPage />} path="/admin" />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
