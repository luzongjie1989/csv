/**
 * 公历日期转甲子历法（干支历）工具
 * 基于 lunar-javascript 库
 */

import { Solar } from 'lunar-javascript';

export interface GanZhiResult {
  /** 年柱，如 "甲辰" */
  yearPillar: string;
  /** 月柱，如 "丙寅" */
  monthPillar: string;
  /** 日柱，如 "癸卯" */
  dayPillar: string;
  /** 年生肖，如 "龙" */
  yearAnimal: string;
  /** 完整甲子历法字符串 */
  fullGanZhi: string;
}

/**
 * 将公历日期字符串转换为甲子历法（干支历）
 * @param dateStr 日期字符串，支持多种格式：
 *   - "2024-01-15"
 *   - "2024/01/15"
 *   - "01/15/2024" (美式)
 *   - "1997/10/30" (中式)
 * @returns GanZhiResult | null 转换失败返回 null
 */
export function solarToGanZhi(dateStr: string): GanZhiResult | null {
  try {
    const { year, month, day } = parseDate(dateStr);
    if (!year || !month || !day) return null;

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

/**
 * 解析多种日期格式
 */
function parseDate(dateStr: string): { year: number; month: number; day: number } {
  const str = dateStr.trim();

  // 格式: YYYY-MM-DD 或 YYYY/MM/DD
  const isoMatch = str.match(/(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10),
      day: parseInt(isoMatch[3], 10),
    };
  }

  // 格式: MM/DD/YYYY (美式)
  const usMatch = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    return {
      year: parseInt(usMatch[3], 10),
      month: parseInt(usMatch[1], 10),
      day: parseInt(usMatch[2], 10),
    };
  }

  return { year: 0, month: 0, day: 0 };
}
