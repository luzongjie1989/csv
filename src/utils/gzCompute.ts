import { solarToGanZhi } from '@/utils/lunarCalendar';
import { getSolarTermForDate } from '@/utils/solarTerms';
import type { GanZhiInfo, SolarTermInfo, ParsedCSV } from '@/types';

export interface GanZhiMaps {
  ganZhiMap: Map<number, GanZhiInfo>;
  solarTermMap: Map<number, SolarTermInfo>;
}

/**
 * 延迟计算干支和节气映射表
 * 只在用户切换到古典历法标签时才调用
 *
 * 使用 setTimeout 分块处理，避免长时间阻塞主线程
 */
export function computeGanZhiMaps(
  data: ParsedCSV,
  onProgress?: (done: number, total: number) => void
): Promise<GanZhiMaps> {
  return new Promise((resolve) => {
    const { rows, dateColumn } = data;
    const ganZhiMap = new Map<number, GanZhiInfo>();
    const solarTermMap = new Map<number, SolarTermInfo>();

    if (!dateColumn) {
      resolve({ ganZhiMap, solarTermMap });
      return;
    }

    let index = 0;
    const total = rows.length;
    const CHUNK_SIZE = 100; // 每批处理100行

    function processChunk() {
      const end = Math.min(index + CHUNK_SIZE, total);
      for (let i = index; i < end; i++) {
        const dateValue = rows[i][dateColumn];
        if (dateValue) {
          const gz = solarToGanZhi(dateValue);
          if (gz) ganZhiMap.set(i, gz);

          const st = getSolarTermForDate(dateValue);
          if (st) solarTermMap.set(i, st);
        }
      }
      index = end;
      onProgress?.(index, total);

      if (index < total) {
        // 每批之间让出主线程，防止UI冻结
        setTimeout(processChunk, 0);
      } else {
        resolve({ ganZhiMap, solarTermMap });
      }
    }

    processChunk();
  });
}
