import { Link } from "react-router";

export function Footer() {
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
                { name: "时间线", to: "/archive" },
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
