import { parseDate } from './seasonalStats';
import type { ParsedCSV } from '@/types';

export interface YearLineData {
  year: number;
  isCurrent: boolean;
  label: string;
  /** 归一化后的价格序列（起点=100） */
  prices: number[];
  /** 对应的交易日标签（第N天） */
  labels: string[];
  /** 最终累计收益率 */
  finalReturn: number;
}

/**
 * 提取指定年份从1月1日到endMonth/endDay的收盘价数据，归一化到起点=100
 */
export function extractYearLine(
  data: ParsedCSV,
  targetYear: number,
  endMonth: number,
  endDay: number,
  isCurrent: boolean
): YearLineData | null {
  if (!data.closeColumn || !data.dateColumn) return null;

  // 收集所有交易日
  const items: { date: { year: number; month: number; day: number }; close: number }[] = [];
  for (const row of data.rows) {
    const c = parseFloat(row[data.closeColumn!] || '');
    const d = parseDate(row[data.dateColumn!] || '');
    if (!isNaN(c) && c > 0 && d) {
      items.push({ date: d, close: c });
    }
  }
  if (items.length < 2) return null;

  // 筛选目标年份，且不超过 endMonth/endDay
  const filtered = items.filter(item => {
    if (item.date.year !== targetYear) return false;
    if (item.date.month > endMonth) return false;
    if (item.date.month === endMonth && item.date.day > endDay) return false;
    return true;
  });

  if (filtered.length < 2) return null;

  // 按日期排序
  filtered.sort((a, b) => {
    if (a.date.month !== b.date.month) return a.date.month - b.date.month;
    return a.date.day - b.date.day;
  });

  // 去重：同一天取最后一个收盘价
  const deduped: typeof filtered = [];
  for (const item of filtered) {
    if (deduped.length > 0) {
      const last = deduped[deduped.length - 1];
      if (last.date.month === item.date.month && last.date.day === item.date.day) {
        deduped[deduped.length - 1] = item; // 替换为后面的
        continue;
      }
    }
    deduped.push(item);
  }

  // 归一化：起点 = 100
  const firstClose = deduped[0].close;
  const prices = deduped.map(item => (item.close / firstClose) * 100);
  const labels = deduped.map(item => `${item.date.month}/${item.date.day}`);
  const finalReturn = (deduped[deduped.length - 1].close / firstClose) - 1;

  return {
    year: targetYear,
    isCurrent,
    label: isCurrent ? `${targetYear}年(当前)` : `${targetYear}年`,
    prices,
    labels,
    finalReturn,
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
  // 找到最大长度
  const maxLen = Math.max(...lines.map(l => l.prices.length), 0);
  if (maxLen === 0) return { chartData: [], maxLen: 0 };

  const chartData: any[] = [];
  for (let i = 0; i < maxLen; i++) {
    const point: any = { day: i + 1 };
    for (const line of lines) {
      point[line.label] = i < line.prices.length ? line.prices[i] : null;
    }
    chartData.push(point);
  }

  return { chartData, maxLen };
}
