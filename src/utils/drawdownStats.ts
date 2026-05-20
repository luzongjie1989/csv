import type { ParsedCSV } from '@/types';

/** 单次回撤记录 */
export interface DrawdownRecord {
  /** 峰值日期（原始字符串） */
  peakDate: string;
  /** 谷值日期 */
  troughDate: string;
  /** 峰值价格 */
  peakPrice: number;
  /** 谷值价格 */
  troughPrice: number;
  /** 跌幅百分比（负值，如 -25.3） */
  drawdownPct: number;
  /** 持续天数（峰→谷的交易日数） */
  durationDays: number;
  /** 下跌点数（peakPrice - troughPrice） */
  declinePoints: number;
  /** 恢复日期（如已恢复） */
  recoveryDate?: string;
  /** 恢复天数（峰→恢复的交易日数） */
  recoveryDays?: number;
  /** 是否已恢复到前高 */
  isRecovered: boolean;
}

/** 跌幅分类区间 */
export interface DrawdownCategory {
  /** 区间标签 */
  label: string;
  /** 下限（含，负值） */
  min: number;
  /** 上限（不含，负值） */
  max: number;
  /** 区间颜色 */
  color: string;
  /** 背景色（透明度低） */
  bgColor: string;
  /** 该区间内的回撤记录 */
  records: DrawdownRecord[];
  /** 发生次数 */
  count: number;
  /** 平均持续天数 */
  avgDuration: number;
  /** 平均跌幅 */
  avgDrawdown: number;
  /** 最大跌幅 */
  maxDrawdown: number;
  /** 恢复概率 */
  recoveryRate: number;
  /** 平均恢复天数 */
  avgRecoveryDays: number;
}

/** 水下曲线数据点 */
export interface UnderwaterPoint {
  date: string;
  drawdownPct: number;
}

/** 跌幅区间定义 */
const CATEGORIES: { label: string; min: number; max: number; color: string; bgColor: string }[] = [
  { label: '微调', min: 0, max: -5, color: '#10b981', bgColor: 'rgba(16,185,129,0.15)' },
  { label: '小幅', min: -5, max: -10, color: '#3b82f6', bgColor: 'rgba(59,130,246,0.15)' },
  { label: '中幅', min: -10, max: -20, color: '#f59e0b', bgColor: 'rgba(245,158,11,0.15)' },
  { label: '大幅', min: -20, max: -30, color: '#f97316', bgColor: 'rgba(249,115,22,0.15)' },
  { label: '暴跌', min: -30, max: -50, color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)' },
  { label: '崩盘', min: -50, max: -Infinity, color: '#991b1b', bgColor: 'rgba(153,27,27,0.15)' },
];

/** 解析日期字符串，兼容 MM/DD/YYYY 和 YYYY/MM/DD 格式 */
export function parseDate(dateStr: string): Date | null {
  const str = dateStr.trim();
  // YYYY/MM/DD 或 YYYY-MM-DD
  const iso = str.match(/(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
  if (iso) {
    return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
  }
  // MM/DD/YYYY
  const us = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) {
    return new Date(parseInt(us[3]), parseInt(us[1]) - 1, parseInt(us[2]));
  }
  return null;
}

/** 判断跌幅属于哪个区间 */
function getCategoryIndex(drawdownPct: number): number {
  const pct = drawdownPct; // 负值
  for (let i = CATEGORIES.length - 1; i >= 0; i--) {
    if (pct <= CATEGORIES[i].min) return i;
  }
  return 0;
}

/**
 * 核心算法：识别所有回撤段
 *
 * 逻辑：遍历收盘价序列，维护 runningPeak。
 * 当价格创新高时，如果之前存在回撤（即有过峰→谷的过程），
 * 则记录该段回撤。回撤的谷底是 runningPeak 之后到创新高之前的最低点。
 */
export function identifyDrawdowns(data: ParsedCSV): DrawdownRecord[] {
  const { dateColumn, closeColumn, rows } = data;
  if (!dateColumn || !closeColumn) return [];

  // 先提取有效数据点
  const points: { date: string; close: number; idx: number }[] = [];
  rows.forEach((row, idx) => {
    const dateValue = row[dateColumn];
    const closeValue = parseFloat(row[closeColumn]?.replace(/,/g, ''));
    if (dateValue && !isNaN(closeValue) && closeValue > 0) {
      points.push({ date: dateValue, close: closeValue, idx });
    }
  });

  if (points.length < 2) return [];

  const drawdowns: DrawdownRecord[] = [];

  let runningPeak = points[0].close;  // 历史最高价
  let peakDate = points[0].date;      // 峰值日期
  let peakIdx = 0;                     // 峰值在 points 中的索引
  let troughPrice = points[0].close;  // 谷值
  let troughDate = points[0].date;    // 谷值日期
  let troughIdx = 0;
  let inDrawdown = false;              // 是否处于回撤中

  for (let i = 1; i < points.length; i++) {
    const { close, date } = points[i];

    if (close >= runningPeak) {
      // 价格创新高或回到前高
      if (inDrawdown) {
        // 结束当前回撤段，记录
        const drawdownPct = ((troughPrice - runningPeak) / runningPeak) * 100;
        drawdowns.push({
          peakDate,
          troughDate,
          peakPrice: runningPeak,
          troughPrice,
          drawdownPct: Math.round(drawdownPct * 100) / 100,
          durationDays: troughIdx - peakIdx + 1,
          declinePoints: Math.round((runningPeak - troughPrice) * 100) / 100,
          recoveryDate: date,
          recoveryDays: i - peakIdx + 1,
          isRecovered: true,
        });
        inDrawdown = false;
      }
      // 更新运行峰值
      runningPeak = close;
      peakDate = date;
      peakIdx = i;
      troughPrice = close;
      troughDate = date;
      troughIdx = i;
    } else {
      // 价格低于历史最高
      if (close < troughPrice) {
        troughPrice = close;
        troughDate = date;
        troughIdx = i;
      }
      if (close < runningPeak) {
        inDrawdown = true;
      }
    }
  }

  // 数据结束时仍在回撤中
  if (inDrawdown) {
    const drawdownPct = ((troughPrice - runningPeak) / runningPeak) * 100;
    drawdowns.push({
      peakDate,
      troughDate,
      peakPrice: runningPeak,
      troughPrice,
      drawdownPct: Math.round(drawdownPct * 100) / 100,
      durationDays: troughIdx - peakIdx + 1,
      declinePoints: Math.round((runningPeak - troughPrice) * 100) / 100,
      isRecovered: false,
    });
  }

  return drawdowns;
}

/**
 * 生成水下曲线数据（每个交易日的回撤百分比）
 */
export function calcUnderwaterCurve(data: ParsedCSV): UnderwaterPoint[] {
  const { dateColumn, closeColumn, rows } = data;
  if (!dateColumn || !closeColumn) return [];

  const result: UnderwaterPoint[] = [];
  let runningPeak = 0;

  rows.forEach((row) => {
    const dateValue = row[dateColumn];
    const closeValue = parseFloat(row[closeColumn]?.replace(/,/g, ''));
    if (!dateValue || isNaN(closeValue) || closeValue <= 0) return;

    if (closeValue > runningPeak) runningPeak = closeValue;
    const drawdownPct = runningPeak > 0 ? ((closeValue - runningPeak) / runningPeak) * 100 : 0;
    result.push({
      date: dateValue,
      drawdownPct: Math.round(drawdownPct * 100) / 100,
    });
  });

  return result;
}

/**
 * 按跌幅区间分类统计
 */
export function classifyDrawdowns(drawdowns: DrawdownRecord[]): DrawdownCategory[] {
  return CATEGORIES.map((cat) => {
    const records = drawdowns.filter((d) => {
      if (cat.max === -Infinity) return d.drawdownPct <= cat.min;
      return d.drawdownPct <= cat.min && d.drawdownPct > cat.max;
    });

    const count = records.length;
    const avgDuration = count > 0 ? records.reduce((s, r) => s + r.durationDays, 0) / count : 0;
    const avgDrawdown = count > 0 ? records.reduce((s, r) => s + r.drawdownPct, 0) / count : 0;
    const maxDrawdown = count > 0 ? Math.min(...records.map((r) => r.drawdownPct)) : 0;
    const recoveredCount = records.filter((r) => r.isRecovered).length;
    const recoveryRate = count > 0 ? (recoveredCount / count) * 100 : 0;
    const avgRecoveryDays =
      recoveredCount > 0
        ? records.filter((r) => r.isRecovered).reduce((s, r) => s + (r.recoveryDays || 0), 0) / recoveredCount
        : 0;

    return {
      ...cat,
      records,
      count,
      avgDuration: Math.round(avgDuration * 10) / 10,
      avgDrawdown: Math.round(avgDrawdown * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      recoveryRate: Math.round(recoveryRate * 10) / 10,
      avgRecoveryDays: Math.round(avgRecoveryDays * 10) / 10,
    };
  });
}

/**
 * 获取最大回撤
 */
export function getMaxDrawdown(drawdowns: DrawdownRecord[]): DrawdownRecord | null {
  if (drawdowns.length === 0) return null;
  return drawdowns.reduce((max, d) => (d.drawdownPct < max.drawdownPct ? d : max), drawdowns[0]);
}

/**
 * 获取当前回撤（最近的未恢复回撤）
 */
export function getCurrentDrawdown(drawdowns: DrawdownRecord[]): DrawdownRecord | null {
  const current = drawdowns.filter((d) => !d.isRecovered);
  return current.length > 0 ? current[current.length - 1] : null;
}

/**
 * 格式化百分比
 */
export function fmtDrawdownPct(pct: number): string {
  return pct.toFixed(2) + '%';
}
