import { useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router";
import { useScrollHide } from "../hooks/useScrollHide";
import { useTheme } from "../hooks/useTheme";
import { siteConfig } from "../config/site";

const navLinks = [
  { name: "文章", to: "/posts" },
  { name: "时间线", to: "/timeline" },
  { name: "笔记", to: "/notes" },
  { name: "管理", to: "/admin" },
] as const;

function HeaderIconButton({
  label,
  onClick,
  className = "",
  children,
}: {
  label: string;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border-none bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${className}`}
    >
      {children}
    </button>
  );
}

function ThemeIcon({ theme }: { theme: "light" | "dark" }) {
  if (theme === "dark") {
    return (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="4" />
        <path strokeLinecap="round" d="M12 2v2m0 18v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2m18 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }

  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function Navigation() {
  const { hidden } = useScrollHide();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, toggle } = useTheme();

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 h-14 border-b border-border bg-background transition-transform duration-500"
      style={{
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        transform: hidden && !isMobileMenuOpen ? "translateY(-100%)" : "translateY(0)",
      }}
    >
      <div className="relative mx-auto flex h-full max-w-[1180px] items-center px-6">
        <Link className="flex shrink-0 items-center text-[17px] font-medium text-foreground gap-2" to="/">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          {siteConfig.name}
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 min-[900px]:flex">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-lg px-3.5 py-2 text-[15px] font-normal transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {link.name}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <HeaderIconButton
            label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
            onClick={toggle}
          >
            <ThemeIcon theme={theme} />
          </HeaderIconButton>

          <HeaderIconButton
            label={isMobileMenuOpen ? "关闭菜单" : "打开菜单"}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            className="min-[900px]:hidden"
          >
            {isMobileMenuOpen ? (
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </HeaderIconButton>
        </div>
      </div>

      <div
        className={`fixed inset-x-0 top-14 bottom-0 z-40 border-t border-border bg-background transition-opacity min-[900px]:hidden ${
          isMobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <nav className="flex flex-col gap-1 px-4 py-3 bg-background">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `rounded-lg px-3.5 py-3 text-[15px] transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`
              }
            >
              {link.name}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
