import type { ParsedCSV } from '@/types';

/** 60个甲子完整列表 */
export const JIAZI_60 = [
  '甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉',
  '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未',
  '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳',
  '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯',
  '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑',
  '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥',
] as const;

/** 24节气名称列表 */
export const SOLAR_TERM_24 = [
  '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
  '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
  '立冬', '小雪', '大雪', '冬至', '小寒', '大寒',
] as const;

/** 统计结果接口 */
export interface StatsResult {
  label: string;
  count: number;
  mean: number;
  std: number;
  min: number;
  max: number;
  sum: number;
  /** 是否该分组有数据 */
  hasData: boolean;
}

/** 完整统计报告 */
export interface StatsReport {
  yearPillarStats: StatsResult[];
  monthPillarStats: StatsResult[];
  dayPillarStats: StatsResult[];
  solarTermStats: StatsResult[];
}

/**
 * 计算日度对数收益率
 * r_t = ln(P_t / P_{t-1})
 */
export function calculateDailyLogReturns(closes: number[]): (number | null)[] {
  const returns: (number | null)[] = [];
  returns.push(null); // 第一天没有前一天的收盘价
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > 0 && closes[i - 1] > 0) {
      returns.push(Math.log(closes[i] / closes[i - 1]));
    } else {
      returns.push(null);
    }
  }
  return returns;
}

/** 计算一组数值的统计量 */
function calcStats(values: number[]): StatsResult {
  const n = values.length;
  if (n === 0) {
    return { label: '', count: 0, mean: 0, std: 0, min: 0, max: 0, sum: 0, hasData: false };
  }
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  return { label: '', count: n, mean, std, min, max, sum, hasData: true };
}

/**
 * 从ParsedCSV数据生成完整的统计报告
 */
export function generateStatsReport(data: ParsedCSV): StatsReport | null {
  if (!data.closeColumn) return null;

  // Extract close prices as numbers
  const closes: number[] = [];
  const validIndices: number[] = [];
  data.rows.forEach((row, idx) => {
    const closeVal = row[data.closeColumn!];
    const closeNum = closeVal ? parseFloat(closeVal) : NaN;
    if (!isNaN(closeNum) && closeNum > 0) {
      closes.push(closeNum);
      validIndices.push(idx);
    }
  });

  if (closes.length < 2) return null;

  // Calculate daily log returns
  const logReturns = calculateDailyLogReturns(closes);

  // ===== 年柱统计 =====
  const yearPillarGroups = new Map<string, number[]>();
  validIndices.forEach((origIdx, i) => {
    const ret = logReturns[i];
    if (ret === null) return;
    const gz = data.ganZhiMap?.get(origIdx);
    if (!gz) return;
    const pillar = gz.yearPillar;
    if (!yearPillarGroups.has(pillar)) yearPillarGroups.set(pillar, []);
    yearPillarGroups.get(pillar)!.push(ret);
  });

  // ===== 月柱统计 =====
  const monthPillarGroups = new Map<string, number[]>();
  validIndices.forEach((origIdx, i) => {
    const ret = logReturns[i];
    if (ret === null) return;
    const gz = data.ganZhiMap?.get(origIdx);
    if (!gz) return;
    const pillar = gz.monthPillar;
    if (!monthPillarGroups.has(pillar)) monthPillarGroups.set(pillar, []);
    monthPillarGroups.get(pillar)!.push(ret);
  });

  // ===== 日柱统计 =====
  const dayPillarGroups = new Map<string, number[]>();
  validIndices.forEach((origIdx, i) => {
    const ret = logReturns[i];
    if (ret === null) return;
    const gz = data.ganZhiMap?.get(origIdx);
    if (!gz) return;
    const pillar = gz.dayPillar;
    if (!dayPillarGroups.has(pillar)) dayPillarGroups.set(pillar, []);
    dayPillarGroups.get(pillar)!.push(ret);
  });

  // ===== 节气统计 =====
  const solarTermGroups = new Map<string, number[]>();
  validIndices.forEach((origIdx, i) => {
    const ret = logReturns[i];
    if (ret === null) return;
    const st = data.solarTermMap?.get(origIdx);
    if (!st) return;
    const termName = st.name;
    if (!solarTermGroups.has(termName)) solarTermGroups.set(termName, []);
    solarTermGroups.get(termName)!.push(ret);
  });

  // Build results in fixed order
  const yearPillarStats = JIAZI_60.map(pillar => {
    const vals = yearPillarGroups.get(pillar) || [];
    const stats = calcStats(vals);
    stats.label = pillar;
    return stats;
  });

  const monthPillarStats = JIAZI_60.map(pillar => {
    const vals = monthPillarGroups.get(pillar) || [];
    const stats = calcStats(vals);
    stats.label = pillar;
    return stats;
  });

  const dayPillarStats = JIAZI_60.map(pillar => {
    const vals = dayPillarGroups.get(pillar) || [];
    const stats = calcStats(vals);
    stats.label = pillar;
    return stats;
  });

  const solarTermStats = SOLAR_TERM_24.map(term => {
    const vals = solarTermGroups.get(term) || [];
    const stats = calcStats(vals);
    stats.label = term;
    return stats;
  });

  return { yearPillarStats, monthPillarStats, dayPillarStats, solarTermStats };
}

/** 格式化百分比数值 */
export function fmtPct(n: number): string {
  return (n * 100).toFixed(4) + '%';
}

/** 格式化小数 */
export function fmtNum(n: number): string {
  return n.toFixed(6);
}
