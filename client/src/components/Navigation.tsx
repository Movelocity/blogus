import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router";
import { useTheme } from "../hooks/useTheme";

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

export function Navigation() {
  const hidden = useScrollHide();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, toggle } = useTheme();

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 border-b border-foreground/6 bg-background/88 backdrop-blur-xl backdrop-saturate-[1.8] transition-transform duration-500"
      style={{
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        transform: hidden && !isMobileMenuOpen ? "translateY(-100%)" : "translateY(0)",
      }}
    >
      <nav className="mx-auto flex h-[64px] max-w-[1400px] items-center justify-between px-6 lg:px-8">
        <Link className="flex items-center gap-2 text-lg font-bold text-foreground" to="/">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          Blogus
        </Link>

        <div className="hidden items-center gap-10 md:flex">
          {[
            { name: "文章", to: "/blog" },
            { name: "时间线", to: "/archive" },
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
          <button
            onClick={toggle}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"}
          >
            {theme === "dark" ? (
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="5" />
                <path strokeLinecap="round" d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
              </svg>
            )}
          </button>
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
              { name: "时间线", to: "/archive" },
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
            <button
              onClick={toggle}
              className={`self-start font-display text-5xl text-foreground transition-all duration-500 hover:text-muted-foreground ${
                isMobileMenuOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
              style={{ transitionDelay: isMobileMenuOpen ? `${3 * 75}ms` : "0ms" }}
              aria-label={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"}
            >
              {theme === "dark" ? "浅色" : "深色"}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
