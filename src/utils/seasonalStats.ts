import type { ParsedCSV } from '@/types';

/** 日度简单收益率 */
export function calcSimpleReturns(closes: number[]): (number | null)[] {
  const result: (number | null)[] = [];
  result.push(null);
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > 0 && closes[i - 1] > 0) {
      result.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    } else {
      result.push(null);
    }
  }
  return result;
}

/** 解析日期字符串 */
export function parseDate(dateStr: string): { year: number; month: number; day: number; weekday: number } | null {
  const str = dateStr.trim();
  // YYYY-MM-DD or YYYY/MM/DD
  const iso = str.match(/(\d{4})[\-/](\d{1,2})[\-/](\d{1,2})/);
  if (iso) {
    const d = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    return { year: parseInt(iso[1]), month: parseInt(iso[2]), day: parseInt(iso[3]), weekday: d.getDay() };
  }
  // MM/DD/YYYY
  const us = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) {
    const d = new Date(parseInt(us[3]), parseInt(us[1]) - 1, parseInt(us[2]));
    return { year: parseInt(us[3]), month: parseInt(us[1]), day: parseInt(us[2]), weekday: d.getDay() };
  }
  return null;
}

/** 统计结果 */
export interface SeasonalStat {
  label: string;
  count: number;
  upCount: number;
  downCount: number;
  avgReturn: number;
  totalReturn: number;
  hasData: boolean;
}

/** 分组求统计 */
function groupStats(
  labels: string[],
  groups: Map<string, number[]>
): SeasonalStat[] {
  return labels.map(label => {
    const values = groups.get(label);
    if (!values || values.length === 0) {
      return { label, count: 0, upCount: 0, downCount: 0, avgReturn: 0, totalReturn: 0, hasData: false };
    }
    const upCount = values.filter(v => v > 0).length;
    const downCount = values.filter(v => v < 0).length;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    // 累计收益率 = 连乘 (1+r) - 1
    let total = 1;
    for (const v of values) total *= (1 + v);
    total -= 1;
    return { label, count: values.length, upCount, downCount, avgReturn: avg, totalReturn: total, hasData: true };
  });
}

/** 月度统计 */
export function calcMonthlyStats(data: ParsedCSV): SeasonalStat[] | null {
  if (!data.closeColumn || !data.dateColumn) return null;
  const closes: number[] = [];
  const dates: string[] = [];
  data.rows.forEach(row => {
    const c = parseFloat(row[data.closeColumn!] || '');
    if (!isNaN(c) && c > 0) { closes.push(c); dates.push(row[data.dateColumn!]); }
  });
  if (closes.length < 2) return null;
  const returns = calcSimpleReturns(closes);
  const groups = new Map<string, number[]>();
  for (let i = 1; i < returns.length; i++) {
    const r = returns[i];
    if (r === null) continue;
    const d = parseDate(dates[i]);
    if (!d) continue;
    const key = `${d.month}月`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const monthLabels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  return groupStats(monthLabels, groups);
}

/** 星期统计 (0=周日, 1=周一...) */
export function calcWeeklyStats(data: ParsedCSV): SeasonalStat[] | null {
  if (!data.closeColumn || !data.dateColumn) return null;
  const closes: number[] = [];
  const dates: string[] = [];
  data.rows.forEach(row => {
    const c = parseFloat(row[data.closeColumn!] || '');
    if (!isNaN(c) && c > 0) { closes.push(c); dates.push(row[data.dateColumn!]); }
  });
  if (closes.length < 2) return null;
  const returns = calcSimpleReturns(closes);
  const groups = new Map<string, number[]>();
  for (let i = 1; i < returns.length; i++) {
    const r = returns[i];
    if (r === null) continue;
    const d = parseDate(dates[i]);
    if (!d) continue;
    const weekDays = ['周日','周一','周二','周三','周四','周五','周六'];
    const key = weekDays[d.weekday];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const weekLabels = ['周一','周二','周三','周四','周五'];
  return groupStats(weekLabels, groups);
}

/** 季度统计 */
export function calcQuarterlyStats(data: ParsedCSV): SeasonalStat[] | null {
  if (!data.closeColumn || !data.dateColumn) return null;
  const closes: number[] = [];
  const dates: string[] = [];
  data.rows.forEach(row => {
    const c = parseFloat(row[data.closeColumn!] || '');
    if (!isNaN(c) && c > 0) { closes.push(c); dates.push(row[data.dateColumn!]); }
  });
  if (closes.length < 2) return null;
  const returns = calcSimpleReturns(closes);
  const groups = new Map<string, number[]>();
  for (let i = 1; i < returns.length; i++) {
    const r = returns[i];
    if (r === null) continue;
    const d = parseDate(dates[i]);
    if (!d) continue;
    const q = Math.ceil(d.month / 3);
    const key = `Q${q}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  return groupStats(['Q1','Q2','Q3','Q4'], groups);
}

/** 年度尾数统计 (0-9) */
export function calcYearTailStats(data: ParsedCSV): SeasonalStat[] | null {
  if (!data.closeColumn || !data.dateColumn) return null;
  const closes: number[] = [];
  const dates: string[] = [];
  data.rows.forEach(row => {
    const c = parseFloat(row[data.closeColumn!] || '');
    if (!isNaN(c) && c > 0) { closes.push(c); dates.push(row[data.dateColumn!]); }
  });
  if (closes.length < 2) return null;
  const returns = calcSimpleReturns(closes);
  const groups = new Map<string, number[]>();
  for (let i = 1; i < returns.length; i++) {
    const r = returns[i];
    if (r === null) continue;
    const d = parseDate(dates[i]);
    if (!d) continue;
    const tail = d.year % 10;
    const key = `尾数${tail}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const tailLabels = ['尾数0','尾数1','尾数2','尾数3','尾数4','尾数5','尾数6','尾数7','尾数8','尾数9'];
  return groupStats(tailLabels, groups);
}

/** 格式化百分比 */
export function fmtPct(n: number): string {
  if (n === 0) return '-';
  return (n * 100).toFixed(4) + '%';
}

/** 格式化胜率 */
export function fmtWinRate(up: number, total: number): string {
  if (total === 0) return '-';
  return ((up / total) * 100).toFixed(1) + '%';
}
