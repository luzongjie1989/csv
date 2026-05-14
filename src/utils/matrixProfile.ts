/**
 * Matrix Profile 纯前端实现
 * 核心算法：z归一化 + 欧氏距离找最相似子序列
 */

/** 对子序列做 z-score 归一化（均值为0，标准差为1） */
function zNormalize(subseq: number[]): number[] {
  const n = subseq.length;
  const mean = subseq.reduce((a, b) => a + b, 0) / n;
  const variance = subseq.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  if (std === 0) return subseq.map(() => 0);
  return subseq.map(v => (v - mean) / std);
}

/** 计算两个 z归一化序列的欧氏距离 */
function euclideanDist(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum / a.length); // 归一化到每点平均距离
}

/** 提取时间序列的所有子序列 */
function extractSubsequences(series: number[], window: number): number[][] {
  const subs: number[][] = [];
  for (let i = 0; i <= series.length - window; i++) {
    subs.push(series.slice(i, i + window));
  }
  return subs;
}

/** Matrix Profile 结果 */
export interface MatrixProfileResult {
  /** 最相似的模式对列表 */
  motifs: MotifPair[];
  /** 异常点（最不相似的子序列） */
  discord: MotifItem | null;
  /** 当前最近 window 天的模式 */
  currentPattern: PatternInfo | null;
}

export interface MotifPair {
  idxA: number;
  idxB: number;
  dateA: string;
  dateB: string;
  /** 原始完整日期格式（用于走势图联动） */
  rawDateA: string;
  rawDateB: string;
  distance: number;
  similarity: number; // 相似度得分 (0~1)
}

export interface MotifItem {
  idx: number;
  date: string;
  distance: number;
}

export interface PatternInfo {
  prices: number[];
  startIdx: number;
  startDate: string;
  endDate: string;
}

export interface SimilarPattern {
  idx: number;
  startDate: string;
  endDate: string;
  distance: number;
  similarity: number;
  /** 相似段后续5天的收益率 */
  futureReturn: number;
  /** 相似段走势（归一化） */
  normalizedPattern: number[];
}

/**
 * 计算 Matrix Profile
 * @param prices 收盘价序列
 * @param dates 日期序列（显示用，如 "1/5"）
 * @param window 窗口大小（默认20）
 * @param maxN 最大处理数据量（默认500，防止浏览器卡死）
 * @param rawDates 原始日期序列（用于走势图联动，如 "2024-01-05"）
 */
export function calculateMatrixProfile(
  prices: number[],
  dates: string[],
  window: number = 20,
  maxN: number = 500,
  rawDates?: string[]
): MatrixProfileResult {
  // 截断数据
  let series = prices;
  let dateLabels = dates;
  let rawDateLabels = rawDates || dates;
  if (series.length > maxN) {
    series = series.slice(-maxN);
    dateLabels = dates.slice(-maxN);
    rawDateLabels = rawDateLabels.slice(-maxN);
  }

  if (series.length < window * 2) {
    return { motifs: [], discord: null, currentPattern: null };
  }

  const n = series.length;
  const subCount = n - window + 1;

  // 1. 提取所有子序列并 z归一化
  const subs = extractSubsequences(series, window);
  const zNorms = subs.map(s => zNormalize(s));

  // 2. 计算距离矩阵（只存最近邻距离，不存完整矩阵）
  const mp: number[] = new Array(subCount).fill(Infinity);
  const mpi: number[] = new Array(subCount).fill(-1); // 最近邻索引

  for (let i = 0; i < subCount; i++) {
    for (let j = 0; j < subCount; j++) {
      if (i === j) continue;
      // 排除相邻（避免平凡匹配）
      if (Math.abs(i - j) < window) continue;
      const dist = euclideanDist(zNorms[i], zNorms[j]);
      if (dist < mp[i]) {
        mp[i] = dist;
        mpi[i] = j;
      }
    }
  }

  // 3. 找 Motif（最小距离对）- 取前5个
  const motifs: MotifPair[] = [];
  const used = new Set<number>();
  const sortedIdx = mp
    .map((d, i) => ({ dist: d, idx: i }))
    .filter(item => item.dist !== Infinity)
    .sort((a, b) => a.dist - b.dist);

  for (const item of sortedIdx) {
    if (motifs.length >= 5) break;
    if (used.has(item.idx)) continue;
    const neighbor = mpi[item.idx];
    if (neighbor === -1) continue;
    if (used.has(neighbor)) continue;

    used.add(item.idx);
    used.add(neighbor);

    const maxDist = Math.max(...mp.filter(d => d !== Infinity)) || 1;
    const similarity = 1 - item.dist / maxDist;

    motifs.push({
      idxA: item.idx,
      idxB: neighbor,
      dateA: dateLabels[item.idx],
      dateB: dateLabels[neighbor],
      rawDateA: rawDateLabels[item.idx],
      rawDateB: rawDateLabels[neighbor],
      distance: item.dist,
      similarity,
    });
  }

  // 4. 找 Discord（最大距离 = 最异常）
  let maxDist = -1;
  let discordIdx = -1;
  for (let i = 0; i < subCount; i++) {
    if (mp[i] > maxDist && mp[i] !== Infinity) {
      maxDist = mp[i];
      discordIdx = i;
    }
  }

  const discord: MotifItem | null = discordIdx >= 0 ? {
    idx: discordIdx,
    date: dateLabels[discordIdx],
    distance: maxDist,
  } : null;

  // 5. 当前最近 window 天的模式
  const startIdx = Math.max(0, n - window);
  const currentPattern: PatternInfo = {
    prices: series.slice(startIdx),
    startIdx: startIdx,
    startDate: dateLabels[startIdx],
    endDate: dateLabels[n - 1],
  };

  return { motifs, discord, currentPattern };
}

/**
 * 找与当前模式最相似的 N 个历史片段
 */
export function findSimilarPatterns(
  prices: number[],
  dates: string[],
  window: number = 20,
  topN: number = 5,
  maxN: number = 500
): SimilarPattern[] {
  let series = prices;
  let dateLabels = dates;
  if (series.length > maxN) {
    series = series.slice(-maxN);
    dateLabels = dates.slice(-maxN);
  }

  if (series.length < window * 2) return [];

  const n = series.length;
  const subCount = n - window + 1;

  // 当前模式
  const currentSub = zNormalize(series.slice(-window));

  // 计算当前模式与所有历史模式的距离
  const distances: { idx: number; dist: number }[] = [];
  for (let i = 0; i < subCount - 1; i++) { // 排除自己
    const histSub = zNormalize(series.slice(i, i + window));
    const dist = euclideanDist(currentSub, histSub);
    distances.push({ idx: i, dist });
  }

  // 排序取前N
  distances.sort((a, b) => a.dist - b.dist);

  const maxDist = Math.max(...distances.map(d => d.dist)) || 1;
  const results: SimilarPattern[] = [];

  for (let k = 0; k < Math.min(topN, distances.length); k++) {
    const d = distances[k];
    const similarity = 1 - d.dist / maxDist;

    // 计算相似段后续5天的收益率
    const endIdx = d.idx + window;
    let futureReturn = 0;
    if (endIdx + 5 < n) {
      const futurePrice = series[endIdx + 5];
      const nowPrice = series[endIdx];
      futureReturn = (futurePrice / nowPrice) - 1;
    }

    // 归一化走势
    const pattern = series.slice(d.idx, d.idx + window);
    const first = pattern[0];
    const normalizedPattern = pattern.map(p => (p / first) * 100);

    results.push({
      idx: d.idx,
      startDate: dateLabels[d.idx],
      endDate: dateLabels[d.idx + window - 1],
      distance: d.dist,
      similarity,
      futureReturn,
      normalizedPattern,
    });
  }

  return results;
}
