import { Link } from "react-router";
import { IcpLink } from "../components/IcpLink";
import { Navigation } from "../components/Navigation";
import { siteConfig } from "../config/site";

// const marqueeItems = ["技术记录", "产品开发", "工具实践", "长期记录", "读书笔记", "复盘"];

const noteCards = [
  {
    title: "最近文章",
    tags: ["Blog", "Notes"],
    description: "从最新发布开始读。",
    to: "/blog",
  },
  {
    title: "时间线",
    tags: ["Archive", "History"],
    description: "按月份回看所有公开文章。",
    to: "/archive",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <Navigation />

      <main>
        <section className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col justify-center px-6 py-20 lg:px-10">
          <h1 className="m-0 max-w-5xl font-display text-[clamp(3.5rem,5vw,6rem)] font-bold text-foreground">
            {siteConfig.hero.title[0]}
            <br />
            <span className="relative inline-block text-accent">
              {siteConfig.hero.title[1]}
            </span>
          </h1>
          <div className="mt-10 flex flex-wrap items-end justify-between gap-8">
            <p className="m-0 max-w-md text-lg leading-8 text-muted-foreground">
              {siteConfig.hero.tagline}
            </p>
            <Link
              className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-sm font-bold text-primary-foreground shadow-[0_16px_44px_rgba(26,20,8,0.18)] transition-transform hover:-translate-y-1 hover:bg-primary/90 active:scale-[0.98]"
              to={siteConfig.cta.to}
            >
              {siteConfig.cta.label}
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20 lg:px-10">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
            <h2 className="m-0 max-w-xl font-display text-[clamp(2.2rem,5vw,3rem)] font-bold leading-none text-foreground">
              {siteConfig.collections.title}
            </h2>
            <span className="rounded-full border border-foreground/10 px-4 py-2 text-sm font-semibold text-muted-foreground">
              {siteConfig.collections.subtitle}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            {siteConfig.bentoItems.map((item) => (
              <article
                className={`group flex min-h-60 flex-col justify-between rounded-[8px] p-7 transition-transform duration-300 hover:-translate-y-1 ${item.className}`}
                key={item.title}
              >
                <span className="text-xs font-bold uppercase opacity-70">{item.label}</span>
                <div className="mt-10">
                  <h3 className="m-0 font-display text-2xl font-bold leading-tight">{item.title}</h3>
                  <p className="m-0 mt-3 text-sm leading-7 opacity-80">{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-foreground/10 px-6 py-10 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span>&copy; {new Date().getFullYear()} {siteConfig.footer.copyright}</span>
          <IcpLink />
          <div className="flex gap-6">
            <Link className="transition-colors hover:text-foreground" to="/posts">
              文章
            </Link>
            <Link className="transition-colors hover:text-foreground" to="/admin">
              管理
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
