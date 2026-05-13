import { parseDate } from './seasonalStats';
import type { ParsedCSV } from '@/types';

export interface YearLineData {
  year: number;
  isCurrent: boolean;
  label: string;
  /** 归一化后的价格序列（起点=100） */
  prices: number[];
  /** 对应的具体日期标签 ["1/5", "1/8"...] */
  dateLabels: string[];
  /** 最终累计收益率 */
  finalReturn: number;
  /** 交易日数量 */
  tradeDays: number;
}

/**
 * 提取指定年份的收盘价数据
 * - 当前年：从1月1日到endMonth/endDay
 * - 往年：从1月1日到12月31日（完整年份）
 */
export function extractYearLine(
  data: ParsedCSV,
  targetYear: number,
  isCurrent: boolean
): YearLineData | null {
  if (!data.closeColumn || !data.dateColumn) return null;

  // 收集所有交易日
  const items: { month: number; day: number; close: number }[] = [];
  for (const row of data.rows) {
    const c = parseFloat(row[data.closeColumn!] || '');
    const d = parseDate(row[data.dateColumn!] || '');
    if (!isNaN(c) && c > 0 && d && d.year === targetYear) {
      items.push({ month: d.month, day: d.day, close: c });
    }
  }
  if (items.length < 2) return null;

  // 按日期排序
  items.sort((a, b) => {
    if (a.month !== b.month) return a.month - b.month;
    return a.day - b.day;
  });

  // 去重：同一天取最后一个收盘价
  const deduped: typeof items = [];
  for (const item of items) {
    if (deduped.length > 0) {
      const last = deduped[deduped.length - 1];
      if (last.month === item.month && last.day === item.day) {
        deduped[deduped.length - 1] = item;
        continue;
      }
    }
    deduped.push(item);
  }

  // 归一化：起点 = 100
  const firstClose = deduped[0].close;
  const prices = deduped.map(item => (item.close / firstClose) * 100);
  const dateLabels = deduped.map(item => `${item.month}/${item.day}`);
  const finalReturn = (deduped[deduped.length - 1].close / firstClose) - 1;

  return {
    year: targetYear,
    isCurrent,
    label: isCurrent ? `${targetYear}年(当前)` : `${targetYear}年`,
    prices,
    dateLabels,
    finalReturn,
    tradeDays: deduped.length,
  };
}

/** 从CSV最新数据获取当前年份和截至日期 */
export function getCurrentYearAndEndDate(data: ParsedCSV): { year: number; month: number; day: number } | null {
  if (!data.dateColumn || data.rows.length === 0) return null;
  let latest: { year: number; month: number; day: number } | null = null;
  for (const row of data.rows) {
    const d = parseDate(row[data.dateColumn!] || '');
    if (!d) continue;
    if (!latest || d.year > latest.year ||
      (d.year === latest.year && d.month > latest.month) ||
      (d.year === latest.year && d.month === latest.month && d.day > latest.day)) {
      latest = d;
    }
  }
  return latest;
}

/** 获取CSV中所有可用的年份 */
export function getAvailableYears(data: ParsedCSV): number[] {
  if (!data.dateColumn) return [];
  const years = new Set<number>();
  for (const row of data.rows) {
    const d = parseDate(row[data.dateColumn!] || '');
    if (d) years.add(d.year);
  }
  return Array.from(years).sort((a, b) => a - b);
}

/** 将多条不同长度的线对齐为统一的数据格式（用于Recharts） */
export function alignLinesForChart(lines: YearLineData[]): { chartData: any[]; maxLen: number } {
  const maxLen = Math.max(...lines.map(l => l.prices.length), 0);
  if (maxLen === 0) return { chartData: [], maxLen: 0 };

  const chartData: any[] = [];
  for (let i = 0; i < maxLen; i++) {
    const point: any = { day: i + 1 };
    for (const line of lines) {
      point[line.label] = i < line.prices.length ? line.prices[i] : null;
      // 存日期标签用于tooltip
      point[`${line.label}_date`] = i < line.dateLabels.length ? line.dateLabels[i] : null;
    }
    chartData.push(point);
  }

  return { chartData, maxLen };
}
