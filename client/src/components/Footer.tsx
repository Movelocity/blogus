import { Link } from "react-router";
import { IcpLink } from "./IcpLink";

export function Footer() {
  return (
    <footer className="border-t border-foreground/10 bg-background text-muted-foreground">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="grid gap-12 py-16 md:grid-cols-3 lg:py-20">
          <div>
            <Link to="/" className="mb-6 inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-accent" />
              <span className="font-display text-2xl text-foreground">Blogus</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              自托管写作平台，面向长期阅读。
            </p>
          </div>
          <div>
            <h3 className="mb-6 text-sm font-medium text-foreground">导航</h3>
            <ul className="space-y-4">
              {[
                { name: "全部文章", to: "/blog" },
                { name: "时间线", to: "/archive" },
                { name: "日历", to: "/calendar" },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-6 text-sm font-medium text-foreground">管理</h3>
            <ul className="space-y-4">
              {[
                { name: "编辑文章", to: "/admin" },
                // { name: "登录", to: "/login" },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 border-t border-foreground/10 py-8 md:flex-row">
          <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} Blogus</p>
          <IcpLink />
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-accent" />
            Self-hosted
          </span>
        </div>
      </div>
    </footer>
  );
}
