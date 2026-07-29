import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import type { CalendarDay } from "../lib/calendar";
import { formatDateKey, formatMonthTitle, generateMonthGrid } from "../lib/calendar";
import type { CalendarPostSummary } from "../lib/api";
import { getCalendarPosts } from "../lib/api";
import { SectionHeader } from "../components/shared/SectionHeader";

const weekDays = ["日", "一", "二", "三", "四", "五", "六"];

interface MonthIndex {
  index: Record<string, CalendarPostSummary[]>;
}

export function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [monthData, setMonthData] = useState<MonthIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  function goToPrevMonth() {
    setCurrentDate(new Date(year, month - 2, 1));
    setSelectedDate(null);
  }

  function goToNextMonth() {
    setCurrentDate(new Date(year, month, 1));
    setSelectedDate(null);
  }

  function goToToday() {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
  }

  return (
    <div className="grid gap-12">
      <SectionHeader
        eyebrow="按日期浏览"
        title="日历"
        description="在日历中查看农历、节日与文章发布日期。"
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={goToPrevMonth}
            className="flex h-10 w-10 items-center justify-center border border-foreground/10 bg-card text-foreground transition-colors hover:bg-muted"
            aria-label="上个月"
          >
            <CaretLeft className="h-5 w-5" />
          </button>
          <h2 className="min-w-[10rem] text-center font-display text-2xl text-foreground">
            {formatMonthTitle(year, month)}
          </h2>
          <button
            onClick={goToNextMonth}
            className="flex h-10 w-10 items-center justify-center border border-foreground/10 bg-card text-foreground transition-colors hover:bg-muted"
            aria-label="下个月"
          >
            <CaretRight className="h-5 w-5" />
          </button>
        </div>
        <button
          onClick={goToToday}
          className="border border-foreground/10 bg-card px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
        >
          今天
        </button>
      </div>

      {loading ? <CalendarSkeleton /> : null}

      {!loading && error ? (
        <section className="border border-destructive/30 bg-destructive/5 p-8 text-destructive">
          <h2 className="m-0 font-display text-xl">日历加载失败</h2>
          <p className="mb-0 mt-2 leading-relaxed">{error}</p>
        </section>
      ) : null}

      {!loading && !error ? (
        <>
          <div className="grid grid-cols-7 border-b border-foreground/10 pb-3">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center font-mono text-sm font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px border border-foreground/10 bg-border">
            {grid.map((day) => {
              const key = formatDateKey(day.date);
              const posts = monthData?.index[key] ?? [];
              const hasPosts = posts.length > 0;
              const isSelected = selectedKey === key;

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(day.date)}
                  className={`relative flex min-h-[6rem] flex-col items-start gap-1 bg-card p-2 text-left transition-colors hover:bg-muted md:min-h-[7rem] md:p-3 ${
                    day.isCurrentMonth ? "text-foreground" : "text-muted-foreground/60"
                  } ${day.isToday ? "ring-1 ring-inset ring-accent" : ""} ${
                    isSelected ? "bg-muted" : ""
                  }`}
                >
                  <span
                    className={`font-display text-lg leading-none ${
                      day.isToday ? "font-bold text-accent" : ""
                    }`}
                  >
                    {day.day}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {day.lunar.display}
                  </span>
                  <div className="mt-auto flex w-full flex-col gap-1">
                    {day.festivals.slice(0, 2).map((festival) => (
                      <span
                        key={festival.name}
                        className="truncate rounded-sm bg-accent/10 px-1 py-0.5 text-[10px] font-medium text-accent"
                      >
                        {festival.name}
                      </span>
                    ))}
                    {hasPosts ? (
                      <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        {posts.length} 篇
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : null}

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

interface DateDetailPanelProps {
  day: CalendarDay;
  posts: CalendarPostSummary[];
  onClose: () => void;
}

function DateDetailPanel({ day, posts, onClose }: DateDetailPanelProps) {
  const dateText = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(day.date);

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="fixed bottom-0 right-0 top-0 w-full border-l border-foreground/10 bg-card p-6 shadow-xl md:w-[28rem] md:p-8"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="m-0 font-mono text-sm text-muted-foreground">{dateText}</p>
            <h3 className="mt-2 font-display text-3xl text-foreground">
              {day.day}
              <span className="ml-3 text-base font-normal text-muted-foreground">
                {day.lunar.display}
              </span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {day.festivals.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {day.festivals.map((festival) => (
              <span
                key={festival.name}
                className="rounded-sm bg-accent/10 px-2.5 py-1 text-sm font-medium text-accent"
              >
                {festival.name}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-8">
          <h4 className="mb-4 font-mono text-sm uppercase tracking-wide text-muted-foreground">
            文章
          </h4>
          {posts.length === 0 ? (
            <p className="text-muted-foreground">这一天没有发布文章。</p>
          ) : (
            <ul className="grid gap-3">
              {posts.map((post) => (
                <li key={post.id}>
                  <Link
                    to={`/posts/${post.slug}`}
                    className="block border border-foreground/10 bg-background p-4 transition-colors hover:bg-muted"
                    onClick={onClose}
                  >
                    <p className="m-0 font-display text-lg text-foreground">{post.title}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("zh-CN", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      }).format(new Date(post.publishedAt))}
                    </p>
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

function CalendarSkeleton() {
  return (
    <section className="grid gap-4" aria-label="日历正在加载">
      <div className="grid grid-cols-7 gap-px border border-foreground/10 bg-border">
        {Array.from({ length: 42 }).map((_, i) => (
          <div
            key={i}
            className="flex min-h-[6rem] flex-col gap-2 bg-card p-3 md:min-h-[7rem]"
          >
            <div className="h-6 w-6 animate-pulse rounded bg-muted" />
            <div className="h-3 w-10 animate-pulse rounded bg-muted" />
            <div className="mt-auto h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </section>
  );
}
