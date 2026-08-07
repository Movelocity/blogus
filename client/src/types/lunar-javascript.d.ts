declare module "lunar-javascript" {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    static fromDate(date: Date): Solar;
    getLunar(): Lunar;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    toFullString(): string;
  }

  export class Lunar {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getMonthInChinese(): string;
    getDayInChinese(): string;
    getJieQi(): string;
    getFestivals(): string[];
    getOtherFestivals(): string[];
    toString(): string;
    toFullString(): string;
  }

  export class HolidayUtil {
    static getHoliday(year: number, month: number, day: number): Holiday | null;
    static getHolidays(year: number): Holiday[];
  }

  export interface Holiday {
    getName(): string;
    isWork(): boolean;
  }
}
