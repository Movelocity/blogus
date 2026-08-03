import { Link } from "react-router";
// import { useState } from "react";
import { useTheme } from "../hooks/useTheme";

// const marqueeItems = ["个人博客", "产品开发", "工具实践", "长期记录", "读书笔记", "复盘"];

const bentoItems = [
  {
    className: "bg-[#264653] text-white md:col-span-6",
    label: "Tab1",
    title: "1",
    description: "1111",
  },
  {
    className: "bg-accent text-accent-foreground md:col-span-6",
    label: "Tab2",
    title: "22",
    description: "22222",
  },
  {
    className: "bg-[#e9c46a] text-[#1a1408] md:col-span-4",
    label: "Tab3",
    title: "333",
    description: "3333333",
  },
  {
    className: "bg-card text-card-foreground md:col-span-4",
    label: "Tab4",
    title: "4444",
    description: "4444444444",
  },
  {
    className: "bg-[#2a9d8f] text-white md:col-span-4",
    label: "Tab5",
    title: "55555",
    description: "5555555555555",
  },
];

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
  const { theme, toggle } = useTheme();
  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 bg-background/90 backdrop-blur-xl">
        <nav className="flex h-16 items-center justify-between px-6 border-b border-border">
          <Link className="flex items-center gap-2 text-lg font-bold text-foreground" to="/">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            Blogus
          </Link>
          <div className="items-center gap-7 text-sm font-medium flex">
            {/* <Link className="text-muted-foreground transition-colors hover:text-foreground" to="/blog">
              文章
            </Link> */}
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
            {/* <Link className="rounded-full bg-accent px-5 py-2.5 text-accent-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]" to="/blog">
              开始阅读
            </Link> */}
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col justify-center px-6 py-20 lg:px-10">
          <h1 className="m-0 max-w-5xl font-display text-[clamp(3.5rem,5vw,6rem)] font-bold leading-[0.92] text-foreground">
            Keep it simple,
            <br />
            keep it 
            <span className="landing-highlight relative inline-block text-accent ml-6"> runnable</span>
            .
          </h1>
          <div className="mt-10 flex flex-wrap items-end justify-between gap-8">
            <p className="m-0 max-w-md text-lg leading-8 text-muted-foreground">
              记录产品开发、工具实践、阅读和生活里的具体记录。
            </p>
            <Link
              className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-sm font-bold text-primary-foreground shadow-[0_16px_44px_rgba(26,20,8,0.18)] transition-transform hover:-translate-y-1 hover:bg-primary/90 active:scale-[0.98]"
              to="/blog"
            >
              开始阅读
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20 lg:px-10">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
            <h2 className="m-0 max-w-xl font-display text-[clamp(2.2rem,5vw,4rem)] font-bold leading-none text-foreground">
              Collections
            </h2>
            <span className="rounded-full border border-foreground/10 px-4 py-2 text-sm font-semibold text-muted-foreground">
              personal operating log
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            {bentoItems.map((item) => (
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

        {/* <section className="mx-auto max-w-6xl px-6 pb-20 lg:px-10">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
            <h2 className="m-0 font-display text-[clamp(2.2rem,5vw,4rem)] font-bold leading-none text-foreground">
              Ready to read?
            </h2>
            <Link className="text-sm font-bold text-accent transition-opacity hover:opacity-75" to="/archive">
              查看全部 →
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {noteCards.map((card) => (
              <Link
                className="group overflow-hidden rounded-[8px] bg-card text-card-foreground transition-transform duration-300 hover:-translate-y-1"
                key={card.title}
                to={card.to}
              >
                <div className="grid aspect-[16/8] place-items-center bg-secondary">
                  <span className="font-display text-[clamp(4rem,12vw,8rem)] font-bold leading-none text-foreground/10 transition-transform duration-500 group-hover:scale-105">
                    {card.title.slice(0, 2)}
                  </span>
                </div>
                <div className="p-7">
                  <div className="mb-4 flex flex-wrap gap-2">
                    {card.tags.map((tag) => (
                      <span className="rounded-full bg-background px-3 py-1 text-xs font-bold uppercase text-muted-foreground" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h3 className="m-0 font-display text-2xl font-bold text-foreground">{card.title}</h3>
                  <p className="m-0 mt-2 text-sm leading-7 text-muted-foreground">{card.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section> */}

      </main>

      <footer className="border-t border-foreground/10 px-6 py-10 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            Blogus
          </div>
          <span>&copy; {new Date().getFullYear()} 自托管写作站</span>
          <div className="flex gap-6">
            <Link className="transition-colors hover:text-foreground" to="/blog">
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
