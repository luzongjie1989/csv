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
    getYearInGanZhi(): string;
    getMonthInGanZhi(): string;
    getDayInGanZhi(): string;
    getYearShengXiao(): string;
    /** Get solar term table: keys are term names, values are Solar objects */
    getJieQiTable(): Record<string, any>;
    /** Get ordered list of solar term names */
    getJieQiList(): string[];
    /** Get current solar term name for this day */
    getJieQi(): string;
    /** Get previous solar term */
    getPrevJieQi(wholeDay?: boolean): any;
    /** Get next solar term */
    getNextJieQi(wholeDay?: boolean): any;
    /** Get current solar term as JieQi object */
    getCurrentJieQi(): any | null;
  }
}

declare module 'jschardet' {
  interface DetectResult {
    encoding: string | null;
    confidence: number;
  }
  export function detect(str: string): DetectResult;
}
