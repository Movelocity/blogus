import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router";
import { ArrowLeft, ArrowRight, ArrowUpRight, X } from "@phosphor-icons/react";
import type { CalendarDay } from "../lib/calendar";
import { formatDateKey, generateMonthGrid } from "../lib/calendar";
import type { CalendarPostSummary } from "../lib/api";
import { getCalendarPosts } from "../lib/api";

const weekDays = ["日", "一", "二", "三", "四", "五", "六"];

interface MonthIndex {
  index: Record<string, CalendarPostSummary[]>;
}

/* ─────────────────── 主页面 ─────────────────── */

export function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [monthData, setMonthData] = useState<MonthIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  useEffect(() => {
    setLoading(true);
    setError(null);
    getCalendarPosts(year, month)
      .then((data) => {
        setMonthData(data);
        setError(null);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [year, month]);

  const grid = useMemo(() => generateMonthGrid(year, month), [year, month]);

  const selectedKey = selectedDate ? formatDateKey(selectedDate) : null;
  const selectedPosts = selectedKey ? monthData?.index[selectedKey] ?? [] : [];
  const selectedDay = selectedDate
    ? grid.find((day) => formatDateKey(day.date) === selectedKey)
    : null;

  // 本月写作统计：有文章的天数 + 总篇数
  const stats = useMemo(() => {
    if (!monthData) return { days: 0, posts: 0 };
    let days = 0;
    let posts = 0;
    for (const day of grid) {
      if (!day.isCurrentMonth) continue;
      const list = monthData.index[formatDateKey(day.date)];
      if (list && list.length > 0) {
        days += 1;
        posts += list.length;
      }
    }
    return { days, posts };
  }, [monthData, grid]);

  const goToPrevMonth = useCallback(() => {
    setDirection("left");
    setCurrentDate(new Date(year, month - 2, 1));
    setSelectedDate(null);
  }, [year, month]);

  const goToNextMonth = useCallback(() => {
    setDirection("right");
    setCurrentDate(new Date(year, month, 1));
    setSelectedDate(null);
  }, [year, month]);

  const goToToday = useCallback(() => {
    setDirection(null);
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
  }, []);

  // 键盘导航
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        goToPrevMonth();
      } else if (e.key === "ArrowRight" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        goToNextMonth();
      } else if (e.key === "Escape" && selectedDate) {
        setSelectedDate(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrevMonth, goToNextMonth, selectedDate]);

  const animClass =
    direction === "left"
      ? "animate-slide-in-right"
      : direction === "right"
        ? "animate-slide-in-left"
        : "";

  const monthNames = [
    "一月", "二月", "三月", "四月", "五月", "六月",
    "七月", "八月", "九月", "十月", "十一月", "十二月",
  ];

  return (
    <div className="mx-auto w-full max-w-[1080px]">
      {/* 头部：超大月份排版 */}
      <header className="relative mb-10">
        {/* 背景巨型数字 */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 right-0 select-none font-display text-[11rem] font-bold leading-none tracking-tighter text-foreground/[0.045] md:text-[15rem]"
        >
          {String(month).padStart(2, "0")}
        </span>

        <p className="relative font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          写作日历 · {year}
        </p>

        <div className="relative mt-3 flex flex-wrap items-end justify-between gap-6">
          <h2 className="font-display text-5xl leading-none tracking-tight text-foreground md:text-6xl">
            {monthNames[month - 1]}
          </h2>

          <div className="flex items-center gap-5 pb-1.5">
            <p className="hidden font-mono text-xs text-muted-foreground sm:block">
              {stats.posts > 0
                ? `本月写了 ${stats.posts} 篇 · ${stats.days} 天`
                : "本月还没动笔"}
            </p>
            <span className="hidden h-3 w-px bg-foreground/15 sm:block" />
            <button
              onClick={goToPrevMonth}
              className="group flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              aria-label="上个月"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              上月
            </button>
            <button
              onClick={goToToday}
              className="text-sm text-muted-foreground underline decoration-foreground/20 underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground/50"
            >
              今天
            </button>
            <button
              onClick={goToNextMonth}
              className="group flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              aria-label="下个月"
            >
              下月
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        <hr className="relative mt-6 border-foreground/15" />
      </header>

      {/* 错误提示 */}
      {!loading && error ? (
        <section className="border-l-2 border-destructive bg-destructive/5 px-5 py-4">
          <h3 className="m-0 font-display text-base text-destructive">日历加载失败</h3>
          <p className="mb-0 mt-1 text-sm leading-relaxed text-destructive/80">{error}</p>
        </section>
      ) : null}

      {/* 日历主体 */}
      {loading ? (
        <CalendarSkeleton />
      ) : !error ? (
        <div className={animClass} onAnimationEnd={() => setDirection(null)}>
          {/* 星期头：下划线式，无底色 */}
          <div className="grid grid-cols-7">
            {weekDays.map((day, i) => (
              <div
                key={day}
                className={`border-b border-foreground/15 pb-2 text-center font-mono text-[11px] tracking-widest ${
                  i === 0 || i === 6 ? "text-foreground/70" : "text-muted-foreground"
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 日期网格：细灰分隔线，无外框 */}
          <div className="grid grid-cols-7" role="grid" aria-label="日历">
            {grid.map((day) => {
              const key = formatDateKey(day.date);
              const posts = monthData?.index[key] ?? [];

              return (
                <CalendarCell
                  key={key}
                  day={day}
                  posts={posts}
                  isSelected={selectedKey === key}
                  onSelect={() => setSelectedDate(day.date)}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 日期详情面板 */}
      {selectedDate && selectedDay ? (
        <DateDetailPanel
          day={selectedDay}
          posts={selectedPosts}
          onClose={() => setSelectedDate(null)}
        />
      ) : null}
    </div>
  );
}

/* ─────────────────── 日期格子 ─────────────────── */

interface CalendarCellProps {
  day: CalendarDay;
  posts: CalendarPostSummary[];
  isSelected: boolean;
  onSelect: () => void;
}

function CalendarCell({ day, posts, isSelected, onSelect }: CalendarCellProps) {
  const isFaded = !day.isCurrentMonth;

  // 节假日：直接替换农历文字显示（像老黄历）
  // 法定假日用红色，传统节日/节气用强调色
  const legalHoliday = day.festivals.find((f) => !f.isWork);
  const traditional = day.festivals.find((f) => f.isWork);
  const subText = legalHoliday?.name ?? traditional?.name ?? day.lunar.term ?? day.lunar.display;
  const subTextClass = legalHoliday
    ? "text-accent"
    : traditional || day.lunar.term
      ? "text-accent/70"
      : "text-muted-foreground";

  // 文章展示：桌面端最多 2 条标题，其余折叠为计数
  const visiblePosts = posts.slice(0, 2);
  const extraCount = posts.length - visiblePosts.length;

  return (
    <button
      onClick={onSelect}
      className={`
        group relative flex min-h-[4.75rem] flex-col items-start gap-0.5 border-b border-r
        border-foreground/[0.07] p-2 text-left transition-colors duration-150
        md:min-h-[6.25rem] md:p-2.5
        ${day.isToday ? "bg-accent/[0.05]" : isFaded ? "bg-muted/40" : "hover:bg-muted/50"}
      `}
      role="gridcell"
      aria-label={`${day.month}月${day.day}日 ${subText}`}
      aria-selected={isSelected}
    >
      {/* 日期行：数字 + 休/班角标 + 文章数 */}
      <span className="flex w-full items-baseline justify-between gap-1">
        <span
          className={`font-display text-sm leading-none md:text-base ${
            day.isToday
              ? "font-bold text-accent"
              : isFaded
                ? "text-muted-foreground/40"
                : "text-foreground"
          }`}
        >
          {day.day}
        </span>

        <span className="flex items-baseline gap-1">
          {day.festivals.length > 0 && !isFaded ? (
            <span
              className={`font-mono text-[9px] leading-none ${
                legalHoliday ? "text-accent" : "text-muted-foreground/70"
              }`}
            >
              {legalHoliday ? "休" : "班"}
            </span>
          ) : null}
          {posts.length > 0 && !isFaded ? (
            <span className="font-mono text-[9px] leading-none text-muted-foreground/70 md:hidden">
              {posts.length}
            </span>
          ) : null}
        </span>
      </span>

      {/* 农历 / 节日 / 节气 */}
      <span
        className={`truncate text-[10px] leading-tight md:text-[11px] ${
          isFaded ? "text-muted-foreground/40" : subTextClass
        }`}
      >
        {subText}
      </span>

      {/* 文章标题预览（桌面端） */}
      {!isFaded && posts.length > 0 ? (
        <span className="mt-auto hidden w-full flex-col gap-px md:flex">
          {visiblePosts.map((post) => (
            <span
              key={post.id}
              className="flex items-baseline gap-1.5 text-[11px] leading-snug text-foreground/75 transition-colors group-hover:text-foreground"
            >
              <span className="h-px w-2 shrink-0 translate-y-[-3px] bg-foreground/30" />
              <span className="truncate">{post.title}</span>
            </span>
          ))}
          {extraCount > 0 ? (
            <span className="font-mono text-[10px] text-muted-foreground">
              +{extraCount} 篇
            </span>
          ) : null}
        </span>
      ) : null}

      {/* 选中 / hover 下划线 */}
      <span
        className={`absolute inset-x-0 bottom-0 h-0.5 bg-accent transition-transform duration-200 ${
          isSelected
            ? "scale-x-100"
            : "origin-left scale-x-0 group-hover:scale-x-100"
        }`}
      />
    </button>
  );
}

/* ─────────────────── 日期详情面板 ─────────────────── */

interface DateDetailPanelProps {
  day: CalendarDay;
  posts: CalendarPostSummary[];
  onClose: () => void;
}

function DateDetailPanel({ day, posts, onClose }: DateDetailPanelProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const weekdayText = new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(day.date);
  const lunarFull = `农历${day.lunar.monthInChinese}月${day.lunar.dayInChinese}`;
  const holidayNames = day.festivals.map((f) => f.name);
  const tags = [day.lunar.term, ...holidayNames].filter((t): t is string => Boolean(t));
  const metaItems = [
    { text: lunarFull, className: "" },
    ...tags.map((tag) => ({ text: tag, className: "text-accent" })),
    ...(day.isToday ? [{ text: "今天", className: "font-medium text-foreground" }] : []),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-[2px]" />

      {/* 面板 */}
      <div
        className="relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto border border-foreground/10 bg-background shadow-xl animate-panel-in sm:mx-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${day.month}月${day.day}日 详情`}
      >
        {/* 头部：巨型日期数字 + 竖排大字标签 */}
        <div className="relative overflow-hidden border-b border-foreground/10 p-6 pb-7">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-8 -right-2 select-none font-display text-[9rem] font-bold leading-none text-foreground/[0.05]"
          >
            {String(day.day).padStart(2, "0")}
          </span>

          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>

          <p className="relative font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            {day.year} 年 {day.month} 月
          </p>

          <div className="relative mt-3 flex items-start gap-5">
            <h3 className="font-display text-6xl leading-none tracking-tight text-foreground">
              {day.day}
              <span className="ml-2 align-middle text-xl font-normal text-muted-foreground">日</span>
            </h3>
            <span className="mt-0.5 border-l border-foreground/20 pl-3 font-display text-lg leading-tight text-foreground/80 [writing-mode:vertical-lr]">
              {weekdayText}
            </span>
          </div>

          <div className="relative mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {metaItems.map((item, i) => (
              <span key={item.text} className="flex items-center gap-3">
                {i > 0 ? <span className="h-2.5 w-px bg-foreground/15" /> : null}
                <span className={item.className}>{item.text}</span>
              </span>
            ))}
          </div>
        </div>

        {/* 文章列表 */}
        <div className="p-6 pt-4">
          <h4 className="mb-1 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            当日文章 · {posts.length}
          </h4>

          {posts.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              这一天没有发布文章——<Link to="/admin" onClick={onClose} className="underline decoration-foreground/20 underline-offset-4 hover:text-foreground">去写一篇？</Link>
            </p>
          ) : (
            <ul className="divide-y divide-foreground/[0.07]">
              {posts.map((post, i) => (
                <li key={post.id}>
                  <Link
                    to={`/posts/${post.slug}`}
                    className="group flex items-baseline gap-3 py-3"
                    onClick={onClose}
                  >
                    <span className="shrink-0 font-mono text-xs text-muted-foreground/60">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm text-foreground transition-colors group-hover:text-accent">
                        {post.title}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {new Intl.DateTimeFormat("zh-CN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(post.publishedAt))}{" "}
                        发布
                      </p>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground/40 transition-all group-hover:text-accent" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── 骨架屏 ─────────────────── */

function CalendarSkeleton() {
  return (
    <section aria-label="日历正在加载">
      <div className="grid grid-cols-7">
        {weekDays.map((day) => (
          <div
            key={day}
            className="border-b border-foreground/15 pb-2 text-center font-mono text-[11px] tracking-widest text-muted-foreground/40"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 42 }).map((_, i) => (
          <div
            key={i}
            className="flex min-h-[4.75rem] flex-col gap-1.5 border-b border-r border-foreground/[0.07] p-2 md:min-h-[6.25rem] md:p-2.5"
          >
            <div className="h-4 w-4 animate-pulse rounded-sm bg-muted" />
            <div className="h-2.5 w-8 animate-pulse rounded-sm bg-muted" />
          </div>
        ))}
      </div>
    </section>
  );
}
