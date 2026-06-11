import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router";
import { AdminPage } from "./pages/AdminPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import "./tailwind.css";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#f6f7f9] text-slate-800">
        <header className="flex min-h-16 items-center justify-between border-b border-slate-200 bg-white px-8 max-sm:flex-col max-sm:items-start max-sm:gap-2 max-sm:px-5 max-sm:py-4">
          <Link className="text-xl font-bold text-slate-900" to="/">
            Blogus
          </Link>
          <nav className="flex gap-5 max-sm:flex-wrap">
            <Link className="text-slate-700 transition hover:text-teal-700" to="/">
              文章
            </Link>
            <Link className="text-slate-700 transition hover:text-teal-700" to="/admin">
              管理
            </Link>
            <Link className="text-slate-700 transition hover:text-teal-700" to="/login">
              登录
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10 max-sm:px-4 max-sm:py-7">
          <Routes>
            <Route element={<HomePage />} path="/" />
            <Route element={<AdminPage />} path="/admin" />
            <Route element={<LoginPage />} path="/login" />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
