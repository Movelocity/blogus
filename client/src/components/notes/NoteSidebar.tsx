import { useEffect, useState } from "react";
import {
  ArchiveIcon,
  CalendarBlankIcon,
  CaretLeftIcon,
  CaretRightIcon,
  FunnelSimpleIcon,
  HashIcon,
  MagnifyingGlassIcon,
  XIcon,
} from "@phosphor-icons/react";
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

function densityClass(count: number): string {
  if (count <= 0) return "";
  if (count === 1) return "bg-accent/20 text-accent";
  if (count <= 3) return "bg-accent/40 text-accent-foreground";
  return "bg-accent text-accent-foreground";
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
          className={`grid grid-cols-7 transition-opacity duration-200 ${
            calendarLoading ? "pointer-events-none opacity-50" : ""
          }`}
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
                className={`m-0.5 relative flex aspect-square items-center justify-center rounded text-sm transition-colors disabled:cursor-default 
                  ${isSelected ? "ring-1 ring-inset ring-foreground/30": ""} 
                  ${cell?.isToday ? "bg-muted/60" : densityClass(cell?.count ?? 0)}
                  ${hasNotes ? "cursor-pointer hover:brightness-95" : "text-muted-foreground/50"}`}
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
        <section className="space-y-2.5 rounded-lg border border-foreground/10 p-3">
          <div className="flex items-center gap-1.5 text-base text-foreground">
            <FunnelSimpleIcon className="h-4 w-4 text-muted-foreground" />
            过滤
          </div>

          <FilterButton active={showPublicOnly} onClick={onTogglePublic}>
            仅显示公开笔记
          </FilterButton>
          <FilterButton active={showArchivedOnly} onClick={onToggleArchived} icon>
            <ArchiveIcon className="h-3.5 w-3.5" />
            查看已归档
          </FilterButton>

          <div className="flex items-center gap-1.5">
            <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground focus-within:ring-1 focus-within:ring-ring">
              <MagnifyingGlassIcon className="h-3.5 w-3.5 shrink-0" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearchSubmit();
                }}
                placeholder="搜索笔记..."
                className="w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/60"
              />
            </label>
            <button
              onClick={handleSearchSubmit}
              className="flex h-8 items-center gap-1 rounded-md bg-foreground px-3 text-sm font-medium text-background transition-colors hover:bg-accent"
            >
              搜索
            </button>
          </div>

          {(searchKeyword || selectedDate) && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {searchKeyword && (
                <Chip onClick={() => onSearch("")} label={`搜索: ${searchKeyword}`} />
              )}
              {selectedDate && <Chip onClick={() => onSelectDate(undefined)} label={`日期: ${selectedDate}`} />}
            </div>
          )}

          {/* 标签 */}
          <div className="pt-1">
            <div className="mb-1.5 text-base text-foreground">标签</div>
            {sortedTags.length === 0 ? (
              <div className="py-2 text-center text-sm text-muted-foreground">还没有标签</div>
            ) : (
              <div className="max-h-48 space-y-0.5 overflow-y-auto">
                <TagRow
                  label="全部"
                  count={totalNotes}
                  active={!selectedTag}
                  onClick={() => onSelectTag(undefined)}
                />
                {sortedTags.map(([tag, count]) => (
                  <TagRow
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
  icon = false,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-accent/15 text-accent"
          : "bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      {active && <span className="mr-0.5">✓</span>}
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

function TagRow({
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
      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
        active
          ? "bg-accent/15 text-accent"
          : "bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <HashIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <span className="ml-1.5 font-mono text-xs opacity-75">{count}</span>
    </button>
  );
}
