import { Link } from "react-router";
import { IcpLink } from "./IcpLink";
import { siteConfig } from "../config/site";

export function Footer({ compact = false }: { compact?: boolean }) {
  if (compact) return (
    <footer className="border-t border-foreground/10 px-6 py-10 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <span>&copy; {new Date().getFullYear()} {siteConfig.footer.copyright}</span>
        <IcpLink />
        <div className="flex flex-wrap gap-6"><Link className="hover:text-foreground" to="/posts">文章</Link><Link className="hover:text-foreground" to="/tools/image-editor">图片编辑器</Link><Link className="hover:text-foreground" to="/admin">管理</Link></div>
      </div>
    </footer>
  );
  return (
    <footer className="border-t border-foreground/10 bg-background text-muted-foreground">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="grid gap-12 py-16 md:grid-cols-3 lg:py-20">
          <div>
            <Link to="/" className="mb-6 inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-accent" />
              <span className="font-display text-2xl text-foreground">{siteConfig.name}</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {siteConfig.footer.blurb}
            </p>
          </div>
          <div>
            <h3 className="mb-6 text-sm font-medium text-foreground">导航</h3>
            <ul className="space-y-4">
              {[
                { name: "全部文章", to: "/posts" },
                { name: "时间线", to: "/timeline" },
                { name: "随手记", to: "/notes" },
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
            <h3 className="mb-6 text-sm font-medium text-foreground">工具与管理</h3>
            <ul className="space-y-4">
              {[
                { name: "图片编辑器", to: "/tools/image-editor" },
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
          <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} {siteConfig.name}</p>
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
