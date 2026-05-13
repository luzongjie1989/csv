import type { ParsedCSV } from '@/types';

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

/** 解析后的日期 */
interface ParsedDate {
  year: number;
  month: number;
  day: number;
  weekday: number;
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

/** 解析日期字符串 */
function parseDate(dateStr: string): ParsedDate | null {
  const str = dateStr.trim();
  const iso = str.match(/(\d{4})[\-/](\d{1,2})[\-/](\d{1,2})/);
  if (iso) {
    const d = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    return { year: parseInt(iso[1]), month: parseInt(iso[2]), day: parseInt(iso[3]), weekday: d.getDay() };
  }
  const us = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) {
    const d = new Date(parseInt(us[3]), parseInt(us[1]) - 1, parseInt(us[2]));
    return { year: parseInt(us[3]), month: parseInt(us[1]), day: parseInt(us[2]), weekday: d.getDay() };
  }
  return null;
}

/** 分组 → 统计 */
function toStats(labels: string[], groups: Map<string, number[]>): SeasonalStat[] {
  return labels.map(label => {
    const vals = groups.get(label);
    if (!vals || vals.length === 0) {
      return { label, count: 0, upCount: 0, downCount: 0, avgReturn: 0, totalReturn: 0, hasData: false };
    }
    const upCount = vals.filter(v => v > 0).length;
    const downCount = vals.filter(v => v < 0).length;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    let total = 1;
    for (const v of vals) total *= (1 + v);
    total -= 1;
    return { label, count: vals.length, upCount, downCount, avgReturn: avg, totalReturn: total, hasData: true };
  });
}

/**
 * 找到连续段并按 key 分组，算首尾对数收益率
 */
function calcSegmentReturns(
  items: { date: ParsedDate; close: number }[],
  keyFn: (d: ParsedDate) => string
): Map<string, number[]> {
  const groups = new Map<string, { first: number; last: number }[]>();
  let currentKey: string | null = null;

  for (const item of items) {
    const key = keyFn(item.date);
    if (!groups.has(key)) groups.set(key, []);
    const segs = groups.get(key)!;
    if (key !== currentKey) {
      segs.push({ first: item.close, last: item.close });
      currentKey = key;
    } else {
      segs[segs.length - 1].last = item.close;
    }
  }

  const result = new Map<string, number[]>();
  groups.forEach((segs, key) => {
    result.set(key, segs.map(s => Math.log(s.last / s.first)));
  });
  return result;
}

/**
 * 提取有效收盘价和日期
 */
function extractItems(data: ParsedCSV): { date: ParsedDate; close: number }[] | null {
  if (!data.closeColumn || !data.dateColumn) return null;
  const items: { date: ParsedDate; close: number }[] = [];
  for (const row of data.rows) {
    const c = parseFloat(row[data.closeColumn!] || '');
    const d = parseDate(row[data.dateColumn!] || '');
    if (!isNaN(c) && c > 0 && d) {
      items.push({ date: d, close: c });
    }
  }
  if (items.length < 2) return null;
  return items;
}

// ==================== 全部数据 ====================

/** 月度效应 - 全部 */
export function calcMonthlyStats(data: ParsedCSV): SeasonalStat[] | null {
  const items = extractItems(data);
  if (!items) return null;
  const groups = calcSegmentReturns(items, d => `${d.month}月`);
  return toStats(['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'], groups);
}

/** 季度效应 - 全部 */
export function calcQuarterlyStats(data: ParsedCSV): SeasonalStat[] | null {
  const items = extractItems(data);
  if (!items) return null;
  const groups = calcSegmentReturns(items, d => `Q${Math.ceil(d.month / 3)}`);
  return toStats(['Q1','Q2','Q3','Q4'], groups);
}

/** 星期效应 - 全部 */
export function calcWeeklyStats(data: ParsedCSV): SeasonalStat[] | null {
  const items = extractItems(data);
  if (!items) return null;
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const groups = new Map<string, number[]>();
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const curr = items[i];
    if (curr.close <= 0 || prev.close <= 0) continue;
    const r = (curr.close - prev.close) / prev.close;
    const key = weekDays[curr.date.weekday];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  return toStats(['周一','周二','周三','周四','周五'], groups);
}

/** 年度尾数 - 全部（不分类） */
export function calcYearTailStats(data: ParsedCSV): SeasonalStat[] | null {
  const items = extractItems(data);
  if (!items) return null;
  const groups = calcSegmentReturns(items, d => `尾数${d.year % 10}`);
  return toStats(['尾数0','尾数1','尾数2','尾数3','尾数4','尾数5','尾数6','尾数7','尾数8','尾数9'], groups);
}

// ==================== 奇数年 ====================

/** 月度效应 - 奇数年 */
export function calcMonthlyStatsOdd(data: ParsedCSV): SeasonalStat[] | null {
  const items = extractItems(data);
  if (!items) return null;
  const oddItems = items.filter(item => item.date.year % 2 === 1);
  if (oddItems.length < 2) return null;
  const groups = calcSegmentReturns(oddItems, d => `${d.month}月`);
  return toStats(['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'], groups);
}

/** 季度效应 - 奇数年 */
export function calcQuarterlyStatsOdd(data: ParsedCSV): SeasonalStat[] | null {
  const items = extractItems(data);
  if (!items) return null;
  const oddItems = items.filter(item => item.date.year % 2 === 1);
  if (oddItems.length < 2) return null;
  const groups = calcSegmentReturns(oddItems, d => `Q${Math.ceil(d.month / 3)}`);
  return toStats(['Q1','Q2','Q3','Q4'], groups);
}

/** 星期效应 - 奇数年 */
export function calcWeeklyStatsOdd(data: ParsedCSV): SeasonalStat[] | null {
  const items = extractItems(data);
  if (!items) return null;
  const oddItems = items.filter(item => item.date.year % 2 === 1);
  if (oddItems.length < 2) return null;
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const groups = new Map<string, number[]>();
  for (let i = 1; i < oddItems.length; i++) {
    const prev = oddItems[i - 1];
    const curr = oddItems[i];
    if (curr.close <= 0 || prev.close <= 0) continue;
    const r = (curr.close - prev.close) / prev.close;
    const key = weekDays[curr.date.weekday];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  return toStats(['周一','周二','周三','周四','周五'], groups);
}

// ==================== 偶数年 ====================

/** 月度效应 - 偶数年 */
export function calcMonthlyStatsEven(data: ParsedCSV): SeasonalStat[] | null {
  const items = extractItems(data);
  if (!items) return null;
  const evenItems = items.filter(item => item.date.year % 2 === 0);
  if (evenItems.length < 2) return null;
  const groups = calcSegmentReturns(evenItems, d => `${d.month}月`);
  return toStats(['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'], groups);
}

/** 季度效应 - 偶数年 */
export function calcQuarterlyStatsEven(data: ParsedCSV): SeasonalStat[] | null {
  const items = extractItems(data);
  if (!items) return null;
  const evenItems = items.filter(item => item.date.year % 2 === 0);
  if (evenItems.length < 2) return null;
  const groups = calcSegmentReturns(evenItems, d => `Q${Math.ceil(d.month / 3)}`);
  return toStats(['Q1','Q2','Q3','Q4'], groups);
}

/** 星期效应 - 偶数年 */
export function calcWeeklyStatsEven(data: ParsedCSV): SeasonalStat[] | null {
  const items = extractItems(data);
  if (!items) return null;
  const evenItems = items.filter(item => item.date.year % 2 === 0);
  if (evenItems.length < 2) return null;
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const groups = new Map<string, number[]>();
  for (let i = 1; i < evenItems.length; i++) {
    const prev = evenItems[i - 1];
    const curr = evenItems[i];
    if (curr.close <= 0 || prev.close <= 0) continue;
    const r = (curr.close - prev.close) / prev.close;
    const key = weekDays[curr.date.weekday];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  return toStats(['周一','周二','周三','周四','周五'], groups);
}
