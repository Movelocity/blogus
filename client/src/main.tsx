import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, NavLink, Route, Routes } from "react-router";
import { AdminPage } from "./pages/AdminPage";
import { ArchivePage } from "./pages/ArchivePage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { PostPage } from "./pages/PostPage";
import "./tailwind.css";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-[100dvh] bg-[#f6f7f9] text-slate-800">
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-6 max-sm:px-4">
            <NavLink className="text-xl font-bold text-slate-950" to="/">
              Blogus
            </NavLink>
            <nav className="flex items-center gap-1 text-sm font-medium" aria-label="公开导航">
              <NavLink className={navLinkClass} to="/">
                文章
              </NavLink>
              <NavLink className={navLinkClass} to="/archive">
                归档
              </NavLink>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10 max-sm:px-4 max-sm:py-7">
          <Routes>
            <Route element={<HomePage />} path="/" />
            <Route element={<ArchivePage />} path="/archive" />
            <Route element={<PostPage />} path="/posts/:slug" />
            <Route element={<AdminPage />} path="/admin" />
            <Route element={<LoginPage />} path="/login" />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `rounded-lg px-3 py-2 transition active:translate-y-px ${
    isActive ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-100 hover:text-teal-700"
  }`;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
