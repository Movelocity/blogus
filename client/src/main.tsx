import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router";
import { AdminPage } from "./pages/AdminPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import "./styles.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="topbar">
          <Link className="brand" to="/">
            Blogus
          </Link>
          <nav>
            <Link to="/">文章</Link>
            <Link to="/admin">管理</Link>
            <Link to="/login">登录</Link>
          </nav>
        </header>
        <main>
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
