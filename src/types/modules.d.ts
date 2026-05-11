declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    getLunar(): Lunar;
  }

  export class Lunar {
    getYearInGanZhi(): string;
    getMonthInGanZhi(): string;
    getDayInGanZhi(): string;
    getYearShengXiao(): string;
  }
}

declare module 'jschardet' {
  interface DetectResult {
    encoding: string | null;
    confidence: number;
  }
  export function detect(str: string): DetectResult;
}
