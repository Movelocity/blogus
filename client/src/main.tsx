import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes } from "react-router";
import { AdminPage } from "./pages/AdminPage";
import { ArchivePage } from "./pages/ArchivePage";
import { HomePage } from "./pages/HomePage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { PostPage } from "./pages/PostPage";
import "./tailwind.css";

function useScrollHide(threshold = 80) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  const onScroll = useCallback(() => {
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      setHidden(y > threshold && y > lastY.current);
      lastY.current = y;
      ticking.current = false;
    });
  }, [threshold]);

  useEffect(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  return hidden;
}

function Navigation() {
  const hidden = useScrollHide();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 border-b border-foreground/6 bg-background/88 backdrop-blur-xl backdrop-saturate-[1.8] transition-transform duration-500"
      style={{
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        transform: hidden && !isMobileMenuOpen ? "translateY(-100%)" : "translateY(0)",
      }}
    >
      <nav className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-6 lg:px-8">
        <NavLink to="/" className="flex items-center gap-2">
          <span className="text-base font-bold tracking-tight text-foreground">Blogus</span>
        </NavLink>

        <div className="hidden items-center gap-10 md:flex">
          {[
            { name: "文章", to: "/blog" },
            { name: "归档", to: "/archive" },
          ].map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `group relative text-[0.85rem] transition-colors duration-300 ${
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {link.name}
                  <span
                    className={`absolute -bottom-1 left-1/2 h-[2px] -translate-x-1/2 rounded-full bg-foreground transition-all duration-400 ${
                      isActive ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                    style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                  />
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <NavLink
            to="/admin"
            className="text-[0.85rem] text-muted-foreground transition-colors hover:text-foreground"
          >
            管理
          </NavLink>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-foreground transition-colors md:hidden"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </nav>

      <div
        className={`fixed inset-0 z-40 bg-background transition-all duration-500 md:hidden ${
          isMobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex h-full flex-col px-8 pb-8 pt-28">
          <div className="flex flex-1 flex-col justify-center gap-8">
            {[
              { name: "文章", to: "/blog" },
              { name: "归档", to: "/archive" },
              { name: "管理", to: "/admin" },
            ].map((link, i) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`font-display text-5xl text-foreground transition-all duration-500 hover:text-muted-foreground ${
                  isMobileMenuOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
                style={{ transitionDelay: isMobileMenuOpen ? `${i * 75}ms` : "0ms" }}
              >
                {link.name}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-foreground text-primary-foreground">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="grid gap-12 py-16 md:grid-cols-3 lg:py-20">
          <div>
            <Link to="/" className="mb-6 inline-flex items-center gap-2">
              <span className="font-display text-2xl text-primary-foreground">Blogus</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-primary-foreground/50">
              自托管写作平台，面向长期阅读。
            </p>
          </div>
          <div>
            <h3 className="mb-6 text-sm font-medium text-primary-foreground">导航</h3>
            <ul className="space-y-4">
              {[
                { name: "全部文章", to: "/blog" },
                { name: "文章归档", to: "/archive" },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-primary-foreground/40 transition-colors hover:text-primary-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-6 text-sm font-medium text-primary-foreground">管理</h3>
            <ul className="space-y-4">
              {[
                { name: "写作后台", to: "/admin" },
                { name: "登录", to: "/login" },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-primary-foreground/40 transition-colors hover:text-primary-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 border-t border-primary-foreground/10 py-8 md:flex-row">
          <p className="text-sm text-primary-foreground/30">&copy; {new Date().getFullYear()} Blogus</p>
          <span className="flex items-center gap-2 text-sm text-primary-foreground/30">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Self-hosted
          </span>
        </div>
      </div>
    </footer>
  );
}

function BlogLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <Navigation />
      <main className="mx-auto w-full min-w-0 max-w-[1400px] flex-1 px-6 pb-20 pt-28 lg:px-12">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<LandingPage />} path="/" />
        <Route element={<BlogLayout />}>
          <Route element={<HomePage />} path="/blog" />
          <Route element={<ArchivePage />} path="/archive" />
          <Route element={<PostPage />} path="/posts/:slug" />
          <Route element={<AdminPage />} path="/admin" />
          <Route element={<LoginPage />} path="/login" />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
