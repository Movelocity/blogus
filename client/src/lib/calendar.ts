import { HolidayUtil, Solar } from "lunar-javascript";

export interface LunarInfo {
  year: number;
  month: number;
  day: number;
  monthInChinese: string;
  dayInChinese: string;
  display: string;
  term: string | null;
}

export interface FestivalInfo {
  name: string;
  isWork: boolean;
}

export interface CalendarDay {
  date: Date;
  year: number;
  month: number;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  lunar: LunarInfo;
  festivals: FestivalInfo[];
}

export function getLunarInfo(date: Date): LunarInfo {
  const solar = Solar.fromDate(date);
  const lunar = solar.getLunar();
  const monthInChinese = lunar.getMonthInChinese();
  const dayInChinese = lunar.getDayInChinese();
  const term = lunar.getJieQi();

  return {
    year: lunar.getYear(),
    month: lunar.getMonth(),
    day: lunar.getDay(),
    monthInChinese,
    dayInChinese,
    display: dayInChinese === "初一" ? `${monthInChinese}月` : dayInChinese,
    term: term || null
  };
}

export function getFestivals(date: Date): FestivalInfo[] {
  const solar = Solar.fromDate(date);
  const holiday = HolidayUtil.getHoliday(solar.getYear(), solar.getMonth(), solar.getDay());
  const lunar = solar.getLunar();
  const festivals: FestivalInfo[] = [];
  const seen = new Set<string>();

  // 法定假日（调休/放假）
  if (holiday) {
    const name = holiday.getName();
    seen.add(name);
    festivals.push({ name, isWork: holiday.isWork() });
  }

  // 农历传统节日（春节、中秋、端午等）
  const lunarFestivals: string[] = lunar.getFestivals();
  for (const name of lunarFestivals) {
    if (!seen.has(name)) {
      seen.add(name);
      festivals.push({ name, isWork: false });
    }
  }

  // 其他农历节日（元宵、七夕、重阳等）
  const otherFestivals: string[] = lunar.getOtherFestivals();
  for (const name of otherFestivals) {
    if (!seen.has(name)) {
      seen.add(name);
      festivals.push({ name, isWork: false });
    }
  }

  // 节气已通过 LunarInfo.term 单独展示，不再加入 festivals 避免重复

  return festivals;
}

export function generateMonthGrid(year: number, month: number): CalendarDay[] {
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  const startDay = firstDayOfMonth.getDay();
  const gridDays: CalendarDay[] = [];

  // Previous month padding
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  for (let i = startDay - 1; i >= 0; i -= 1) {
    const day = prevMonthDays - i;
    const date = new Date(year, month - 2, day);
    gridDays.push(createCalendarDay(date, false));
  }

  // Current month
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month - 1, day);
    gridDays.push(createCalendarDay(date, true));
  }

  // Next month padding to fill 6 rows (42 cells)
  const remaining = 42 - gridDays.length;
  for (let day = 1; day <= remaining; day += 1) {
    const date = new Date(year, month, day);
    gridDays.push(createCalendarDay(date, false));
  }

  return gridDays;
}

function createCalendarDay(date: Date, isCurrentMonth: boolean): CalendarDay {
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const lunar = getLunarInfo(date);
  const festivals = getFestivals(date);

  return {
    date,
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    isCurrentMonth,
    isToday,
    lunar,
    festivals
  };
}

export function formatMonthTitle(year: number, month: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long"
  }).format(new Date(year, month - 1, 1));
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
