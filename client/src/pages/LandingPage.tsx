import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

const words = ["沉淀", "书写", "归档", "思考"];

function BlurWord({ word, trigger }: { word: string; trigger: number }) {
  const chars = [...word];
  const STAGGER = 80;
  const DURATION = 500;
  const GRADIENT_HOLD = STAGGER * chars.length + DURATION + 200;

  const [states, setStates] = useState<{ opacity: number; blur: number }[]>(
    chars.map(() => ({ opacity: 0, blur: 20 }))
  );
  const [showGradient, setShowGradient] = useState(true);
  const framesRef = useRef<number[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    framesRef.current.forEach(cancelAnimationFrame);
    timersRef.current.forEach(clearTimeout);
    framesRef.current = [];
    timersRef.current = [];

    setStates(chars.map(() => ({ opacity: 0, blur: 20 })));
    setShowGradient(true);

    chars.forEach((_, i) => {
      const t = setTimeout(() => {
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / DURATION, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setStates((prev) => {
            const next = [...prev];
            next[i] = { opacity: eased, blur: 20 * (1 - eased) };
            return next;
          });
          if (progress < 1) {
            framesRef.current.push(requestAnimationFrame(tick));
          }
        };
        framesRef.current.push(requestAnimationFrame(tick));
      }, i * STAGGER);
      timersRef.current.push(t);
    });

    timersRef.current.push(setTimeout(() => setShowGradient(false), GRADIENT_HOLD));

    return () => {
      framesRef.current.forEach(cancelAnimationFrame);
      timersRef.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  const gradientColors = ["#eca8d6", "#a78bfa", "#67e8f9", "#fbbf24", "#eca8d6"];

  return (
    <>
      {chars.map((char, i) => {
        const colorIndex = (i / Math.max(chars.length - 1, 1)) * (gradientColors.length - 1);
        const lo = Math.floor(colorIndex);
        const hi = Math.min(lo + 1, gradientColors.length - 1);
        const t = colorIndex - lo;
        const hex2rgb = (hex: string) => [
          parseInt(hex.slice(1, 3), 16),
          parseInt(hex.slice(3, 5), 16),
          parseInt(hex.slice(5, 7), 16),
        ];
        const [r1, g1, b1] = hex2rgb(gradientColors[lo]);
        const [r2, g2, b2] = hex2rgb(gradientColors[hi]);
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: states[i]?.opacity ?? 0,
              filter: `blur(${states[i]?.blur ?? 20}px)`,
              color: showGradient ? `rgb(${r},${g},${b})` : "var(--foreground)",
              transition: "color 0.4s ease",
            }}
          >
            {char}
          </span>
        );
      })}
    </>
  );
}

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

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

export function LandingPage() {
  const [heroReady, setHeroReady] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const navHidden = useScrollHide();
  const philosophy = useInView();
  const quote = useInView();
  const cta = useInView();

  useEffect(() => {
    setHeroReady(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % words.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-background text-foreground">
      {/* ── Nav (scroll-hide) ── */}
      <header
        className="fixed inset-x-0 top-0 z-50 border-b border-foreground/6 bg-background/88 backdrop-blur-xl backdrop-saturate-[1.8] transition-transform duration-500"
        style={{
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          transform: navHidden ? "translateY(-100%)" : "translateY(0)",
        }}
      >
        <nav className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-6 lg:px-8">
          <span className="text-base font-bold tracking-tight text-foreground">Blogus</span>
          <div className="flex items-center gap-8">
            <Link
              to="/blog"
              className="text-[0.85rem] text-muted-foreground transition-colors hover:text-foreground"
            >
              文章
            </Link>
            <Link
              to="/archive"
              className="hidden text-[0.85rem] text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              归档
            </Link>
            <Link
              to="/blog"
              className="bg-foreground px-5 py-2 text-[0.82rem] font-medium tracking-wide text-primary-foreground transition hover:opacity-85"
            >
              开始阅读
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="relative flex min-h-dvh flex-col items-start justify-center overflow-hidden pt-[72px]">
        {/* Grid lines */}
        <div className="pointer-events-none absolute inset-0 z-2 overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div
              key={`h-${i}`}
              className="absolute h-px bg-foreground/6"
              style={{ top: `${12.5 * (i + 1)}%`, left: 0, right: 0 }}
            />
          ))}
          {[...Array(12)].map((_, i) => (
            <div
              key={`v-${i}`}
              className="absolute w-px bg-foreground/6"
              style={{ left: `${8.33 * (i + 1)}%`, top: 0, bottom: 0 }}
            />
          ))}
        </div>

        <div className="relative z-10 mx-auto w-full max-w-[1400px] px-6 py-32 lg:px-12 lg:py-40">
          <div className="lg:max-w-[65%]">
            {/* Eyebrow */}
            <div
              className={`mb-8 transition-all duration-700 ${
                heroReady ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
            >
              <span className="inline-flex items-center gap-3 font-mono text-sm text-muted-foreground">
                <span className="h-px w-8 bg-foreground/30" />
                Self-hosted writing platform
              </span>
            </div>

            {/* Headline */}
            <div className="mb-12">
              <h1
                className={`text-left font-display leading-[0.92] tracking-tight text-foreground transition-all duration-1000 text-[clamp(2.5rem,7vw,7rem)] ${
                  heroReady ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
                }`}
              >
                <span className="block">面向长期阅读，</span>
                <span className="block">
                  用于
                  <span className="relative inline-block">
                    <BlurWord word={words[wordIndex]} trigger={wordIndex} />
                  </span>
                  。
                </span>
              </h1>
            </div>

            {/* Sub */}
            <p
              className={`max-w-xl text-lg leading-relaxed text-muted-foreground transition-all delay-300 duration-700 md:text-xl ${
                heroReady ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
            >
              一个自托管的写作平台。没有算法、没有推荐流，只有文字和阅读本身。
            </p>
          </div>
        </div>

        {/* Bottom stats */}
        <div
          className={`absolute bottom-12 left-0 right-0 px-6 transition-all delay-500 duration-700 lg:px-12 ${
            heroReady ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="mx-auto flex max-w-[1400px] items-start gap-10 lg:gap-20">
            {[
              { value: "Markdown", label: "原生写作格式" },
              { value: "100%", label: "数据自主可控" },
              { value: "0", label: "第三方追踪" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col gap-2">
                <span className="font-display text-3xl text-foreground lg:text-4xl">{stat.value}</span>
                <span className="text-xs leading-tight text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll hint */}
        <div
          className={`absolute bottom-12 right-6 transition-all delay-700 duration-700 lg:right-12 ${
            heroReady ? "opacity-60" : "opacity-0"
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Scroll</span>
            <div className="h-8 w-px animate-pulse bg-foreground/30" />
          </div>
        </div>
      </section>

      {/* ── Philosophy ── */}
      <section
        ref={philosophy.ref}
        className="relative border-t border-foreground/10 py-24 lg:py-32"
      >
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-4">
              <span
                className={`inline-flex items-center gap-3 font-mono text-sm text-muted-foreground transition-all duration-700 ${
                  philosophy.visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
              >
                <span className="h-px w-12 bg-foreground/30" />
                Philosophy
              </span>
            </div>
            <div className="lg:col-span-8">
              <h2
                className={`mb-8 font-display text-5xl leading-[1.05] tracking-tight text-foreground transition-all duration-1000 md:text-6xl lg:text-7xl ${
                  philosophy.visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
                }`}
              >
                写作不需要平台，
                <br />
                <span className="text-muted-foreground">只需要一个安静的地方。</span>
              </h2>
              <div className="grid gap-8 md:grid-cols-2">
                {[
                  {
                    number: "01",
                    title: "自托管",
                    desc: "部署在你自己的服务器上。数据、内容、读者关系，全部由你掌控。不依赖任何第三方服务。",
                  },
                  {
                    number: "02",
                    title: "Markdown 原生",
                    desc: "以 Markdown 写作，以 Markdown 存储。无锁定格式，随时导出，永远可读。",
                  },
                  {
                    number: "03",
                    title: "极简前台",
                    desc: "没有侧边栏、没有弹窗、没有推荐算法。读者看到的只有文字本身。",
                  },
                  {
                    number: "04",
                    title: "面向长期",
                    desc: "不追求流量峰值，追求内容的持久价值。设计每一个细节都是为了十年后依然好用。",
                  },
                ].map((item, i) => (
                  <div
                    key={item.number}
                    className={`border border-foreground/10 bg-card p-8 transition-all duration-700 ${
                      philosophy.visible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
                    }`}
                    style={{ transitionDelay: philosophy.visible ? `${(i + 1) * 100}ms` : "0ms" }}
                  >
                    <span className="font-mono text-sm text-muted-foreground">{item.number}</span>
                    <h3 className="mb-3 mt-4 font-display text-2xl tracking-tight text-foreground">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pull Quote ── */}
      <section ref={quote.ref} className="border-t border-foreground/10 py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-12">
          <blockquote
            className={`mb-6 font-display text-4xl leading-[1.2] tracking-tight text-foreground transition-all duration-1000 md:text-5xl lg:text-6xl ${
              quote.visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
            }`}
          >
            好的写作工具不会让你注意到它的存在。
          </blockquote>
          <cite
            className={`font-mono text-sm not-italic text-muted-foreground transition-all delay-200 duration-700 ${
              quote.visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
          >
            Blogus Design Principle
          </cite>
        </div>
      </section>

      {/* ── CTA ── */}
      <section ref={cta.ref} className="border-t border-foreground/10 py-24 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div
            className={`relative border border-foreground transition-all duration-1000 ${
              cta.visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
            }`}
          >
            <div className="absolute right-0 top-0 h-32 w-32 border-b border-l border-foreground/10" />
            <div className="absolute bottom-0 left-0 h-32 w-32 border-r border-t border-foreground/10" />
            <div className="relative z-10 px-8 py-16 lg:px-16 lg:py-24">
              <div className="grid items-center gap-12 lg:grid-cols-[1fr_auto]">
                <div>
                  <h2 className="mb-6 font-display text-5xl tracking-tight text-foreground md:text-6xl lg:text-7xl lg:leading-[0.95]">
                    开始阅读，
                    <br />
                    或开始写作。
                  </h2>
                  <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
                    浏览已发布的文章，或登录后台开始你的写作。
                  </p>
                </div>
                <div className="flex flex-col gap-4 sm:flex-row lg:flex-col">
                  <Link
                    to="/blog"
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-8 py-4 text-base font-medium text-primary-foreground transition hover:bg-foreground/90"
                  >
                    浏览文章
                    <svg
                      className="h-4 w-4 transition-transform group-hover:translate-x-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                  <Link
                    to="/admin"
                    className="inline-flex items-center justify-center rounded-full border border-foreground/20 px-8 py-4 text-base font-medium text-foreground transition hover:bg-foreground/5"
                  >
                    写作后台
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-foreground text-primary-foreground">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div className="flex flex-col items-center justify-between gap-6 py-12 md:flex-row">
            <div className="flex items-center gap-3">
              <span className="font-display text-xl text-primary-foreground">Blogus</span>
              <span className="font-mono text-xs text-primary-foreground/40">Self-hosted</span>
            </div>
            <div className="flex items-center gap-8">
              <Link to="/blog" className="text-sm text-primary-foreground/40 transition-colors hover:text-primary-foreground">
                文章
              </Link>
              <Link to="/archive" className="text-sm text-primary-foreground/40 transition-colors hover:text-primary-foreground">
                归档
              </Link>
              <Link to="/admin" className="text-sm text-primary-foreground/40 transition-colors hover:text-primary-foreground">
                管理
              </Link>
            </div>
            <p className="text-sm text-primary-foreground/30">&copy; {new Date().getFullYear()} Blogus</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
