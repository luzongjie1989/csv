declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    static fromDate(date: Date): Solar;
    static fromJulianDay(jd: number): Solar;
    getLunar(): Lunar;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    toYmd(): string;
    toYmdHms(): string;
  }

  export class Lunar {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getYearInGanZhi(): string;
    getMonthInGanZhi(): string;
    getDayInGanZhi(): string;
    getYearShengXiao(): string;
    getJieQiTable(): Record<string, any>;
    getJieQiList(): string[];
    getJieQi(): string;
    getPrevJieQi(wholeDay?: boolean): any;
    getNextJieQi(wholeDay?: boolean): any;
    getCurrentJieQi(): any | null;
  }

  export class LunarYear {
    static fromYear(year: number): LunarYear;
    getMonthsInYear(): LunarMonth[];
  }

  export class LunarMonth {
    getMonth(): number;
    getDayCount(): number;
    getFirstJulianDay(): number;
  }
}

declare module 'jschardet' {
  interface DetectResult {
    encoding: string | null;
    confidence: number;
  }
  export function detect(str: string): DetectResult;
}
