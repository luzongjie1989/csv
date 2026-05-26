import { solarToGanZhi } from '@/utils/lunarCalendar';
import { getSolarTermForDate } from '@/utils/solarTerms';
import { parseDate } from '@/utils/seasonalStats';
import type { GanZhiInfo, SolarTermInfo } from '@/types';
import type { SeasonalItem } from '@/utils/seasonalStats';

/** 主线程发来的数据 */
interface PrecomputeInput {
  rows: Record<string, string>[];
  dateColumn: string;
  closeColumn: string;
}

/**
 * Web Worker：在后台线程执行干支/节气/季节性预计算
 * 完全不阻塞主线程 UI
 */
self.onmessage = (e: MessageEvent<PrecomputeInput>) => {
  const { rows, dateColumn, closeColumn } = e.data;

  const ganZhiMap = new Map<number, GanZhiInfo>();
  const solarTermMap = new Map<number, SolarTermInfo>();
  const seasonItems: SeasonalItem[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const dateValue = row[dateColumn];

    // 干支计算
    if (dateValue) {
      const gz = solarToGanZhi(dateValue);
      if (gz) ganZhiMap.set(i, gz);
      const st = getSolarTermForDate(dateValue);
      if (st) solarTermMap.set(i, st);
    }

    // 季节性时序数据（收盘价 + 解析日期）
    const c = parseFloat((row[closeColumn] || '').replace(/,/g, ''));
    const d = parseDate(dateValue || '');
    if (!isNaN(c) && c > 0 && d) {
      seasonItems.push({ date: d, close: c });
    }
  }

  // 把结果发回主线程
  self.postMessage({
    gzMaps: { ganZhiMap, solarTermMap },
    seasonItems,
  });
};
