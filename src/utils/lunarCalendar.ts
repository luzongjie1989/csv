import { Solar } from 'lunar-javascript';

export interface GanZhiResult {
  yearPillar: string;
  monthPillar: string;
  dayPillar: string;
  yearAnimal: string;
  fullGanZhi: string;
}

/**
 * Parse date string in various formats
 */
function parseDateParts(dateStr: string): { year: number; month: number; day: number } | null {
  const str = dateStr.trim();

  // YYYY-MM-DD or YYYY/MM/DD (Chinese/ISO)
  const isoMatch = str.match(/(\d{4})[\-/](\d{1,2})[\-/](\d{1,2})/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10),
      day: parseInt(isoMatch[3], 10),
    };
  }

  // MM/DD/YYYY (US format like 03/17/1980)
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

/**
 * Convert solar date string to Gan-Zhi (Chinese sexagenary cycle) calendar
 * @param dateStr Date string in various formats
 * @returns GanZhiResult or null if conversion fails
 */
export function solarToGanZhi(dateStr: string): GanZhiResult | null {
  try {
    const parts = parseDateParts(dateStr);
    if (!parts) return null;

    const { year, month, day } = parts;
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;

    const solar = Solar.fromYmd(year, month, day);
    const lunar = solar.getLunar();

    const yearPillar = lunar.getYearInGanZhi();
    const monthPillar = lunar.getMonthInGanZhi();
    const dayPillar = lunar.getDayInGanZhi();
    const yearAnimal = lunar.getYearShengXiao();

    return {
      yearPillar,
      monthPillar,
      dayPillar,
      yearAnimal,
      fullGanZhi: `${yearPillar}年 ${monthPillar}月 ${dayPillar}日`,
    };
  } catch {
    return null;
  }
}
