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

/** 单个分组统计结果 */
export interface GroupStat {
  label: string;
  count: number;
  avgReturn: number;
}

/** 完整统计报告 */
export interface StatsReport {
  yearPillar: GroupStat[];
  monthPillar: GroupStat[];
  dayPillar: GroupStat[];
  solarTerm: GroupStat[];
}

/** 计算简单日度收益率: r = (P_t - P_{t-1}) / P_{t-1} */
function calcSimpleReturns(closes: number[]): (number | null)[] {
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

/** 对数组求平均 */
function avg(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * 从ParsedCSV生成统计报告
 * 按年柱/月柱/日柱/节气分组，计算每组收益率平均值
 */
export function generateStatsReport(data: ParsedCSV): StatsReport | null {
  if (!data.closeColumn) return null;

  // 提取有效收盘价和原始行索引
  const closes: number[] = [];
  const indices: number[] = [];
  data.rows.forEach((row, idx) => {
    const v = parseFloat(row[data.closeColumn!] || '');
    if (!isNaN(v) && v > 0) {
      closes.push(v);
      indices.push(idx);
    }
  });

  if (closes.length < 2) return null;

  // 日度简单收益率
  const returns = calcSimpleReturns(closes);

  // 按分组收集收益率
  const yMap = new Map<string, number[]>();
  const mMap = new Map<string, number[]>();
  const dMap = new Map<string, number[]>();
  const sMap = new Map<string, number[]>();

  indices.forEach((origIdx, i) => {
    const ret = returns[i];
    if (ret === null) return;

    const gz = data.ganZhiMap?.get(origIdx);
    const st = data.solarTermMap?.get(origIdx);

    if (gz?.yearPillar) {
      if (!yMap.has(gz.yearPillar)) yMap.set(gz.yearPillar, []);
      yMap.get(gz.yearPillar)!.push(ret);
    }
    if (gz?.monthPillar) {
      if (!mMap.has(gz.monthPillar)) mMap.set(gz.monthPillar, []);
      mMap.get(gz.monthPillar)!.push(ret);
    }
    if (gz?.dayPillar) {
      if (!dMap.has(gz.dayPillar)) dMap.set(gz.dayPillar, []);
      dMap.get(gz.dayPillar)!.push(ret);
    }
    if (st?.name) {
      if (!sMap.has(st.name)) sMap.set(st.name, []);
      sMap.get(st.name)!.push(ret);
    }
  });

  // 按固定顺序构建结果，无数据留空（avgReturn=0, count=0）
  const yearPillar = JIAZI_60.map(jz => {
    const vals = yMap.get(jz);
    return { label: jz, count: vals?.length || 0, avgReturn: vals ? avg(vals) : 0 };
  });

  const monthPillar = JIAZI_60.map(jz => {
    const vals = mMap.get(jz);
    return { label: jz, count: vals?.length || 0, avgReturn: vals ? avg(vals) : 0 };
  });

  const dayPillar = JIAZI_60.map(jz => {
    const vals = dMap.get(jz);
    return { label: jz, count: vals?.length || 0, avgReturn: vals ? avg(vals) : 0 };
  });

  const solarTerm = SOLAR_TERM_24.map(st => {
    const vals = sMap.get(st);
    return { label: st, count: vals?.length || 0, avgReturn: vals ? avg(vals) : 0 };
  });

  return { yearPillar, monthPillar, dayPillar, solarTerm };
}

/** 格式化为百分比 */
export function fmtPct(n: number): string {
  if (n === 0) return '-';
  return (n * 100).toFixed(4) + '%';
}
