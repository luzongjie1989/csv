import type { ParsedCSV } from '@/types';

/** 60甲子完整列表 */
export const JIAZI_60 = [
  '甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉',
  '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未',
  '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳',
  '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯',
  '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑',
  '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥',
] as const;

/** 24节气名称（按时间顺序） */
export const SOLAR_TERM_24 = [
  '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
  '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
  '立冬', '小雪', '大雪', '冬至', '小寒', '大寒',
] as const;

/** 单次出现统计 */
export interface GroupStat {
  label: string;
  count: number;
  avgLogReturn: number;
}

/** 完整统计报告 */
export interface StatsReport {
  yearPillar: GroupStat[];
  monthPillar: GroupStat[];
  dayPillar: GroupStat[];
  solarTerm: GroupStat[];
}

/** 对数组求平均 */
function avg(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * 从数据中提取有效收盘价和索引
 */
function extractCloses(data: ParsedCSV): { closes: number[]; indices: number[] } {
  const closes: number[] = [];
  const indices: number[] = [];
  data.rows.forEach((row, idx) => {
    const v = parseFloat(row[data.closeColumn!] || '');
    if (!isNaN(v) && v > 0) {
      closes.push(v);
      indices.push(idx);
    }
  });
  return { closes, indices };
}

/**
 * 找到连续段：按keyFn分组，连续的相同key为一组
 * 返回 Map<key, {firstClose, lastClose}[]>
 */
function findSegments(
  indices: number[],
  closes: number[],
  keyFn: (rowIdx: number) => string | undefined
): Map<string, { first: number; last: number }[]> {
  const groups = new Map<string, { first: number; last: number }[]>();

  let currentKey: string | undefined;

  indices.forEach((origIdx, i) => {
    const key = keyFn(origIdx);
    const close = closes[i];

    if (!key) return;

    if (key !== currentKey) {
      // 新段开始
      currentKey = key;
    }

    // 每行都更新last，遍历完后就是该段的最后一个
    if (!groups.has(key)) groups.set(key, []);
    const arr = groups.get(key)!;

    // 如果是该段的第一个元素，或者key变化了（上面已处理），创建新段
    if (arr.length === 0 || (i > 0 && keyFn(indices[i - 1]) !== key)) {
      arr.push({ first: close, last: close });
    } else {
      // 更新最后一段的last
      arr[arr.length - 1].last = close;
    }
  });

  return groups;
}

/**
 * 日柱统计：单日对数收益率
 * 对同一日柱的所有出现，计算 ln(P_t / P_{t-1}) 然后取平均
 */
function calcDayPillarStats(data: ParsedCSV, closes: number[], indices: number[]): Map<string, number[]> {
  const groups = new Map<string, number[]>();

  indices.forEach((origIdx, i) => {
    if (i === 0) return; // 第一行无前一日
    const gz = data.ganZhiMap?.get(origIdx);
    if (!gz?.dayPillar) return;
    if (closes[i] <= 0 || closes[i - 1] <= 0) return;

    const logReturn = Math.log(closes[i] / closes[i - 1]);
    if (!groups.has(gz.dayPillar)) groups.set(gz.dayPillar, []);
    groups.get(gz.dayPillar)!.push(logReturn);
  });

  return groups;
}

/**
 * 生成统计报告
 *
 * 核心逻辑：
 * - 年柱：找到每年柱的每次连续出现，算 ln(末日/首日)，多次出现取平均
 * - 月柱：找到每月柱的每次连续出现，算 ln(末日/首日)，多次出现取平均
 * - 日柱：每个日柱出现日的单日对数收益率 ln(P_t/P_{t-1})，取平均
 * - 节气：找到每个节气的每次连续出现，算 ln(末日/首日)，多次出现取平均
 */
export function generateStatsReport(data: ParsedCSV): StatsReport | null {
  if (!data.closeColumn) return null;

  const { closes, indices } = extractCloses(data);
  if (closes.length < 2) return null;

  // ===== 年柱：连续段首尾对数收益率 =====
  const yearSegments = findSegments(indices, closes, (idx) => data.ganZhiMap?.get(idx)?.yearPillar);
  const yearLogReturns = new Map<string, number[]>();
  yearSegments.forEach((segs, key) => {
    yearLogReturns.set(key, segs.map(s => Math.log(s.last / s.first)));
  });

  // ===== 月柱：连续段首尾对数收益率 =====
  const monthSegments = findSegments(indices, closes, (idx) => data.ganZhiMap?.get(idx)?.monthPillar);
  const monthLogReturns = new Map<string, number[]>();
  monthSegments.forEach((segs, key) => {
    monthLogReturns.set(key, segs.map(s => Math.log(s.last / s.first)));
  });

  // ===== 日柱：单日对数收益率 =====
  const dayLogReturns = calcDayPillarStats(data, closes, indices);

  // ===== 节气：连续段首尾对数收益率 =====
  const termSegments = findSegments(indices, closes, (idx) => data.solarTermMap?.get(idx)?.name);
  const termLogReturns = new Map<string, number[]>();
  termSegments.forEach((segs, key) => {
    termLogReturns.set(key, segs.map(s => Math.log(s.last / s.first)));
  });

  // 构建固定顺序的结果
  const yearPillar = JIAZI_60.map(jz => {
    const vals = yearLogReturns.get(jz);
    return {
      label: jz,
      count: vals?.length || 0,
      avgLogReturn: vals ? avg(vals) : 0,
    };
  });

  const monthPillar = JIAZI_60.map(jz => {
    const vals = monthLogReturns.get(jz);
    return {
      label: jz,
      count: vals?.length || 0,
      avgLogReturn: vals ? avg(vals) : 0,
    };
  });

  const dayPillar = JIAZI_60.map(jz => {
    const vals = dayLogReturns.get(jz);
    return {
      label: jz,
      count: vals?.length || 0,
      avgLogReturn: vals ? avg(vals) : 0,
    };
  });

  const solarTerm = SOLAR_TERM_24.map(st => {
    const vals = termLogReturns.get(st);
    return {
      label: st,
      count: vals?.length || 0,
      avgLogReturn: vals ? avg(vals) : 0,
    };
  });

  return { yearPillar, monthPillar, dayPillar, solarTerm };
}

/** 10天干 */
export const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;

/** 12地支 */
export const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

/** 提取天干（柱的第一个字符） */
function extractGan(pillar: string): string | undefined {
  if (pillar.length < 2) return undefined;
  return pillar[0];
}

/** 提取地支（柱的第二个字符） */
function extractZhi(pillar: string): string | undefined {
  if (pillar.length < 2) return undefined;
  return pillar[1];
}

/** 将60甲子的连续段统计按天干聚合 */
function aggregateByGan(
  pillarSegments: Map<string, { first: number; last: number }[]>
): Map<string, number[]> {
  const result = new Map<string, number[]>();
  pillarSegments.forEach((segs, pillar) => {
    const gan = extractGan(pillar);
    if (!gan) return;
    const logReturns = segs.map(s => Math.log(s.last / s.first));
    if (!result.has(gan)) result.set(gan, []);
    result.get(gan)!.push(...logReturns);
  });
  return result;
}

/** 将60甲子的连续段统计按地支聚合 */
function aggregateByZhi(
  pillarSegments: Map<string, { first: number; last: number }[]>
): Map<string, number[]> {
  const result = new Map<string, number[]>();
  pillarSegments.forEach((segs, pillar) => {
    const zhi = extractZhi(pillar);
    if (!zhi) return;
    const logReturns = segs.map(s => Math.log(s.last / s.first));
    if (!result.has(zhi)) result.set(zhi, []);
    result.get(zhi)!.push(...logReturns);
  });
  return result;
}

/** 将日柱单日收益率按天干聚合 */
function aggregateDayByGan(
  dayLogReturns: Map<string, number[]>
): Map<string, number[]> {
  const result = new Map<string, number[]>();
  dayLogReturns.forEach((returns, pillar) => {
    const gan = extractGan(pillar);
    if (!gan) return;
    if (!result.has(gan)) result.set(gan, []);
    result.get(gan)!.push(...returns);
  });
  return result;
}

/** 将日柱单日收益率按地支聚合 */
function aggregateDayByZhi(
  dayLogReturns: Map<string, number[]>
): Map<string, number[]> {
  const result = new Map<string, number[]>();
  dayLogReturns.forEach((returns, pillar) => {
    const zhi = extractZhi(pillar);
    if (!zhi) return;
    if (!result.has(zhi)) result.set(zhi, []);
    result.get(zhi)!.push(...returns);
  });
  return result;
}

/** 天干地支完整统计报告 */
export interface GanZhiStatsReport {
  ganYear: GroupStat[];
  ganMonth: GroupStat[];
  ganDay: GroupStat[];
  zhiYear: GroupStat[];
  zhiMonth: GroupStat[];
  zhiDay: GroupStat[];
}

/**
 * 生成天干地支统计报告
 */
export function generateGanZhiStatsReport(data: ParsedCSV): GanZhiStatsReport | null {
  if (!data.closeColumn) return null;

  const { closes, indices } = extractCloses(data);
  if (closes.length < 2) return null;

  // === 年柱连续段 ===
  const yearSegments = findSegments(indices, closes, (idx) => data.ganZhiMap?.get(idx)?.yearPillar);

  // === 月柱连续段 ===
  const monthSegments = findSegments(indices, closes, (idx) => data.ganZhiMap?.get(idx)?.monthPillar);

  // === 日柱单日收益率 ===
  const dayLogReturns = calcDayPillarStats(data, closes, indices);

  // 按天干聚合（年/月用连续段，日用单日收益率）
  const ganYearMap = aggregateByGan(yearSegments);
  const ganMonthMap = aggregateByGan(monthSegments);
  const ganDayMap = aggregateDayByGan(dayLogReturns);

  // 按地支聚合（年/月用连续段，日用单日收益率）
  const zhiYearMap = aggregateByZhi(yearSegments);
  const zhiMonthMap = aggregateByZhi(monthSegments);
  const zhiDayMap = aggregateDayByZhi(dayLogReturns);

  // 构建固定顺序结果
  const buildStats = (keys: readonly string[], map: Map<string, number[]>): GroupStat[] =>
    keys.map(k => ({
      label: k,
      count: map.get(k)?.length || 0,
      avgLogReturn: map.get(k) ? avg(map.get(k)!) : 0,
    }));

  return {
    ganYear: buildStats(TIAN_GAN, ganYearMap),
    ganMonth: buildStats(TIAN_GAN, ganMonthMap),
    ganDay: buildStats(TIAN_GAN, ganDayMap),
    zhiYear: buildStats(DI_ZHI, zhiYearMap),
    zhiMonth: buildStats(DI_ZHI, zhiMonthMap),
    zhiDay: buildStats(DI_ZHI, zhiDayMap),
  };
}

/** 格式化为百分比 */
export function fmtPct(n: number): string {
  if (n === 0) return '-';
  return (n * 100).toFixed(4) + '%';
}
