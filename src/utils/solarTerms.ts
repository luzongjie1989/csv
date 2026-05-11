import { Solar } from 'lunar-javascript';

export interface SolarTermInfo {
  /** 节气名称，如 "立春" */
  name: string;
  /** 节气所在年份 */
  year: number;
  /** 节气所在月份 */
  month: number;
  /** 节气所在日期 */
  day: number;
  /** 完整日期字符串 YYYY-MM-DD */
  dateStr: string;
  /** 是否为节令（12节） */
  isJie: boolean;
  /** 是否为气令（12气） */
  isQi: boolean;
}

/** 24节气标准名称（按时间顺序，从冬至开始） */
export const SOLAR_TERM_NAMES = [
  '冬至', '小寒', '大寒',
  '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
  '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
  '立冬', '小雪', '大雪',
] as const;

export type SolarTermName = typeof SOLAR_TERM_NAMES[number];

// Internal markers to skip from lunar-javascript output
const INTERNAL_MARKERS = ['DA_XUE', 'DONG_ZHI', 'XIAO_HAN', 'DA_HAN', 'LI_CHUN', 'YU_SHUI', 'JING_ZHE'];

/** 12节令 */
const JIE_LIST = ['立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒'];
/** 12气令 */
const QI_LIST = ['雨水', '春分', '谷雨', '小满', '夏至', '大暑', '处暑', '秋分', '霜降', '小雪', '冬至', '大寒'];

/**
 * Get all 24 solar terms for a given year
 */
export function getYearSolarTerms(year: number): SolarTermInfo[] {
  const result: SolarTermInfo[] = [];

  try {
    const solar = Solar.fromYmd(year, 6, 1);
    const lunar = solar.getLunar();
    const jieQiTable = lunar.getJieQiTable() as Record<string, any>;
    const jieQiList = lunar.getJieQiList() as string[];

    for (const name of jieQiList) {
      if (INTERNAL_MARKERS.includes(name)) continue;

      const termSolar = jieQiTable[name];
      if (!termSolar) continue;

      const termYear = termSolar.getYear();
      if (termYear === year) {
        const month = termSolar.getMonth();
        const day = termSolar.getDay();
        result.push({
          name,
          year: termYear,
          month,
          day,
          dateStr: `${termYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          isJie: JIE_LIST.includes(name),
          isQi: QI_LIST.includes(name),
        });
      }
    }

    result.sort((a, b) => {
      if (a.month !== b.month) return a.month - b.month;
      return a.day - b.day;
    });
  } catch (e) {
    console.error('Failed to get solar terms for year', year, e);
  }

  return result;
}

/**
 * Parse date string to year/month/day parts
 */
function parseDateParts(dateStr: string): { year: number; month: number; day: number } | null {
  const str = dateStr.trim();

  const isoMatch = str.match(/(\d{4})[\-/](\d{1,2})[\-/](\d{1,2})/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10),
      day: parseInt(isoMatch[3], 10),
    };
  }

  const usMatch = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    return {
      year: parseInt(usMatch[3], 10),
      month: parseInt(usMatch[1], 10),
      day: parseInt(usMatch[2], 10),
    };
  }

  return null;
}

// Cache for year solar terms
const yearTermsCache = new Map<number, SolarTermInfo[]>();

function getCachedYearTerms(year: number): SolarTermInfo[] {
  if (!yearTermsCache.has(year)) {
    yearTermsCache.set(year, getYearSolarTerms(year));
  }
  return yearTermsCache.get(year)!;
}

/**
 * Find the solar term period that a given date falls into.
 * Returns the PREVIOUS solar term (the one that most recently passed).
 * 
 * Example: date=2024-02-10 (between 立春 02-04 and 雨水 02-19) returns "立春"
 */
export function getSolarTermForDate(dateStr: string): SolarTermInfo | null {
  const parts = parseDateParts(dateStr);
  if (!parts) return null;

  const { year, month, day } = parts;
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  try {
    const terms = getCachedYearTerms(year);

    let currentTerm: SolarTermInfo | null = null;
    for (const term of terms) {
      if (term.month < month || (term.month === month && term.day <= day)) {
        currentTerm = term;
      } else {
        break;
      }
    }

    // If date is before first term of year, use last term of previous year
    if (!currentTerm) {
      const prevYearTerms = getCachedYearTerms(year - 1);
      if (prevYearTerms.length > 0) {
        currentTerm = prevYearTerms[prevYearTerms.length - 1];
      }
    }

    return currentTerm;
  } catch {
    return null;
  }
}

/**
 * Batch process: get solar term for multiple dates
 * Returns a Map where key is the row index
 */
export function getSolarTermsForDates(
  dates: (string | undefined)[]
): Map<number, SolarTermInfo> {
  const result = new Map<number, SolarTermInfo>();

  dates.forEach((dateStr, idx) => {
    if (!dateStr) return;
    const parts = parseDateParts(dateStr);
    if (!parts) return;

    const term = getSolarTermForDate(dateStr);
    if (term) {
      result.set(idx, term);
    }
  });

  return result;
}

/** Get season-based color for a solar term */
export function getSolarTermColor(termName: string): { bg: string; text: string; border: string } {
  const spring = ['立春', '雨水', '惊蛰', '春分', '清明', '谷雨'];
  const summer = ['立夏', '小满', '芒种', '夏至', '小暑', '大暑'];
  const autumn = ['立秋', '处暑', '白露', '秋分', '寒露', '霜降'];
  const winter = ['立冬', '小雪', '大雪', '冬至', '小寒', '大寒'];

  if (spring.includes(termName)) return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' };
  if (summer.includes(termName)) return { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' };
  if (autumn.includes(termName)) return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' };
  if (winter.includes(termName)) return { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' };

  return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' };
}

/** Get season name for a solar term */
export function getSolarTermSeason(termName: string): string {
  const spring = ['立春', '雨水', '惊蛰', '春分', '清明', '谷雨'];
  const summer = ['立夏', '小满', '芒种', '夏至', '小暑', '大暑'];
  const autumn = ['立秋', '处暑', '白露', '秋分', '寒露', '霜降'];
  const winter = ['立冬', '小雪', '大雪', '冬至', '小寒', '大寒'];

  if (spring.includes(termName)) return '春';
  if (summer.includes(termName)) return '夏';
  if (autumn.includes(termName)) return '秋';
  if (winter.includes(termName)) return '冬';
  return '';
}
