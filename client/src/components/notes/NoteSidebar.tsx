import { useEffect, useState } from "react";
import {
  ArchiveIcon,
  CalendarBlankIcon,
  CaretLeftIcon,
  CaretRightIcon,
  HashIcon,
  MagnifyingGlassIcon,
  XIcon,
} from "@phosphor-icons/react";
import { cn } from "../../lib/cn";
import { getNotesCalendar } from "../../lib/notes";

const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
const monthNames = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月",
];

interface NoteSidebarProps {
  isAuthenticated: boolean;
  selectedTag?: string;
  onSelectTag: (tag: string | undefined) => void;
  showPublicOnly: boolean;
  onTogglePublic: () => void;
  showArchivedOnly: boolean;
  onToggleArchived: () => void;
  searchKeyword: string;
  onSearch: (keyword: string) => void;
  selectedDate?: string;
  onSelectDate: (date: string | undefined) => void;
  tagStats: Record<string, number>;
}

interface DayCell {
  day: number;
  date: string;
  count: number;
  isToday: boolean;
}

function densityClass(count: number, isToday: boolean): string {
  if (isToday) {
    if (count <= 0) return "bg-red-500/15 text-red-600 dark:bg-red-500/15 dark:text-red-400";
    return "bg-red-500/25 text-red-700 dark:bg-red-500/25 dark:text-red-300";
  }
  if (count <= 0) return "";
  if (count === 1) return "bg-gray-300/20 text-gray-700 dark:bg-gray-500/20  dark:text-gray-400";
  if (count <= 3) return "bg-gray-300/40 text-gray-700 dark:bg-gray-500/40  dark:text-gray-400";
  if (count <= 6) return "bg-gray-300/60 text-gray-700 dark:bg-gray-500/60  dark:text-gray-400";
  return "bg-gray-300/80 text-gray-700 dark:bg-gray-600/80  dark:text-gray-400";
}

/**
 * 笔记侧栏：轻量日历（按密度着色）+ 过滤 + 搜索 + 标签统计。
 */
export function NoteSidebar({
  isAuthenticated,
  selectedTag,
  onSelectTag,
  showPublicOnly,
  onTogglePublic,
  showArchivedOnly,
  onToggleArchived,
  searchKeyword,
  onSearch,
  selectedDate,
  onSelectDate,
  tagStats,
}: NoteSidebarProps) {
  const [index, setIndex] = useState<Record<string, number>>({});
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [keyword, setKeyword] = useState(searchKeyword);
  const [calendarLoading, setCalendarLoading] = useState(true);

  useEffect(() => {
    setCalendarLoading(true);
    getNotesCalendar(year, month)
      .then((data) => setIndex(data.index))
      .catch(() => setIndex({}))
      .finally(() => setCalendarLoading(false));
  }, [year, month]);

  useEffect(() => {
    setKeyword(searchKeyword);
  }, [searchKeyword]);

  const cells = buildMonthGrid(year, month, index);

  const goPrev = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const goNext = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  const goToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  };

  const handleDateClick = (cell: DayCell | null) => {
    if (!cell || cell.count === 0 || calendarLoading) return;
    if (selectedDate === cell.date) onSelectDate(undefined);
    else onSelectDate(cell.date);
  };

  const handleSearchSubmit = () => onSearch(keyword.trim());

  const sortedTags = Object.entries(tagStats).sort((a, b) => b[1] - a[1]);
  const totalNotes = Object.values(tagStats).reduce((s, n) => s + n, 0);

  return (
    <aside className="w-full space-y-3 lg:sticky lg:top-28 lg:max-h-[calc(100vh-9rem)] lg:w-64 lg:shrink-0 lg:self-start lg:overflow-y-auto lg:overscroll-contain">
      {/* 日历 */}
      <section className="rounded-lg border border-foreground/10 p-2">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-base text-foreground">
            <CalendarBlankIcon className="h-4 w-4 text-muted-foreground" />
            <span>
              {year}年{monthNames[month - 1]}
            </span>
          </div>
          <div className="flex items-center">
            <button
              onClick={goPrev}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              aria-label="上个月"
            >
              <CaretLeftIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={goToday}
              className="px-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              title="返回今天"
            >
              今
            </button>
            <button
              onClick={goNext}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              aria-label="下个月"
            >
              <CaretRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div
          className={cn(
            "grid grid-cols-7 transition-opacity duration-200",
            calendarLoading && "pointer-events-none opacity-50",
          )}
        >
          {weekDays.map((d) => (
            <div
              key={d}
              className="pb-1 text-center font-mono text-[10px] tracking-widest text-muted-foreground"
            >
              {d}
            </div>
          ))}
          {cells.map((cell, i) => {
            const isSelected = cell && selectedDate === cell.date;
            const hasNotes = (cell?.count ?? 0) > 0;
            return (
              <button
                key={i}
                disabled={!cell || !hasNotes || calendarLoading}
                onClick={() => handleDateClick(cell)}
                className={cn(
                  "relative m-[1px] flex aspect-square items-center justify-center rounded text-sm transition-colors disabled:cursor-default",
                  cell && densityClass(cell.count, cell.isToday),
                  isSelected && "ring-1 ring-inset ring-foreground/30",
                )}
                title={cell ? `${cell.date}: ${cell.count} 条笔记` : ""}
              >
                {cell ? cell.day : ""}
              </button>
            );
          })}
        </div>
      </section>

      {/* 过滤 + 搜索（仅登录） */}
      {isAuthenticated && (
        <section className="space-y-3 rounded-lg border border-foreground/10 p-2.5">
          <div className="flex items-center gap-1.5">
            <label className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md bg-muted/50 px-2.5 text-sm text-muted-foreground focus-within:ring-1 focus-within:ring-ring">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearchSubmit();
                }}
                placeholder="搜索笔记"
                className="w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/60"
              />
            </label>
            <button
              onClick={handleSearchSubmit}
              title="搜索"
              aria-label="搜索"
              className="btn-secondary h-8 w-8 px-0"
            >
              <MagnifyingGlassIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <FilterButton active={showPublicOnly} onClick={onTogglePublic}>
              公开
            </FilterButton>
            <FilterButton active={showArchivedOnly} onClick={onToggleArchived}>
              <ArchiveIcon className="h-3.5 w-3.5" />
              归档
            </FilterButton>
          </div>

          {(searchKeyword || selectedDate) && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {searchKeyword && (
                <Chip onClick={() => onSearch("")} label={searchKeyword} />
              )}
              {selectedDate && <Chip onClick={() => onSelectDate(undefined)} label={selectedDate} />}
            </div>
          )}

          <div>
            {sortedTags.length === 0 ? (
              <div className="py-2 text-center text-sm text-muted-foreground">还没有标签</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <TagChip
                  label="全部"
                  count={totalNotes}
                  active={!selectedTag}
                  onClick={() => onSelectTag(undefined)}
                />
                {sortedTags.map(([tag, count]) => (
                  <TagChip
                    key={tag}
                    label={tag}
                    count={count}
                    active={selectedTag === tag}
                    onClick={() => onSelectTag(tag)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </aside>
  );
}

function buildMonthGrid(year: number, month: number, index: Record<string, number>): (DayCell | null)[] {
  const now = new Date();
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startPadding = firstDay.getDay();
  const cells: (DayCell | null)[] = [];

  for (let i = 0; i < startPadding; i++) cells.push(null);

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({
      day,
      date,
      count: index[date] ?? 0,
      isToday:
        day === now.getDate() &&
        month === now.getMonth() + 1 &&
        year === now.getFullYear(),
    });
  }

  // 补齐到完整周，便于 7 列对齐
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 transition-colors hover:text-foreground"
    >
      {label}
      <XIcon className="h-3 w-3" />
    </button>
  );
}

function TagChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-sm transition-colors ${
        active
          ? "bg-primary/80 text-primary-foreground"
          : "bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      <HashIcon className="h-3 w-3 shrink-0 opacity-70" />
      <span className="truncate">{label}</span>
      <span className="font-mono text-[11px] opacity-70">{count}</span>
    </button>
  );
}
