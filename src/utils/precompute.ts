import { solarToGanZhi } from '@/utils/lunarCalendar';
import { getSolarTermForDate } from '@/utils/solarTerms';
import { parseDate } from '@/utils/seasonalStats';
import type { GanZhiInfo, SolarTermInfo, ParsedCSV } from '@/types';
import type { SeasonalItem } from '@/utils/seasonalStats';

/** 干支/节气映射表 */
export interface GanZhiMaps {
  ganZhiMap: Map<number, GanZhiInfo>;
  solarTermMap: Map<number, SolarTermInfo>;
}

/** CSV上传后预计算的全部缓存数据 */
export interface PrecomputedData {
  gzMaps: GanZhiMaps;
  seasonItems: SeasonalItem[];
}

/**
 * CSV上传后立即调用——同步计算干支映射 + 季节性时间序列
 * 包在 Promise 里走微任务队列，不阻塞 UI
 */
export function precomputeAll(data: ParsedCSV): Promise<PrecomputedData> {
  return Promise.resolve().then(() => {
    const { rows, dateColumn, closeColumn } = data;

    const ganZhiMap = new Map<number, GanZhiInfo>();
    const solarTermMap = new Map<number, SolarTermInfo>();
    const seasonItems: SeasonalItem[] = [];

    if (!dateColumn || !closeColumn) {
      return { gzMaps: { ganZhiMap, solarTermMap }, seasonItems };
    }

    const dc: string = dateColumn;
    const cc: string = closeColumn;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const dateValue = row[dc];

      // 干支
      if (dateValue) {
        const gz = solarToGanZhi(dateValue);
        if (gz) ganZhiMap.set(i, gz);
        const st = getSolarTermForDate(dateValue);
        if (st) solarTermMap.set(i, st);
      }

      // 季节性：收盘价 + 解析日期
      const c = parseFloat((row[cc] || '').replace(/,/g, ''));
      const d = parseDate(dateValue || '');
      if (!isNaN(c) && c > 0 && d) {
        seasonItems.push({ date: d, close: c });
      }
    }

    return { gzMaps: { ganZhiMap, solarTermMap }, seasonItems };
  });
}
