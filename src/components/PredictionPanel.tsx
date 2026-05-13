import { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { fmtPct } from '@/utils/statistics';
import { getSolarTermColor } from '@/utils/solarTerms';
import { Solar } from 'lunar-javascript';
import type { ParsedCSV } from '@/types';

interface Props {
  data: ParsedCSV;
}

/** 连续段 */
interface Segment {
  first: number;
  last: number;
}

/** 找到指定key的所有连续段 */
function findSegmentsForKey(
  indices: number[],
  closes: number[],
  keyFn: (rowIdx: number) => string | undefined,
  targetKey: string
): Segment[] {
  const segs: Segment[] = [];
  let inSegment = false;

  indices.forEach((origIdx, i) => {
    const key = keyFn(origIdx);
    const close = closes[i];

    if (key === targetKey) {
      if (!inSegment) {
        segs.push({ first: close, last: close });
        inSegment = true;
      } else {
        segs[segs.length - 1].last = close;
      }
    } else {
      inSegment = false;
    }
  });

  return segs;
}

/** 计算预测值：找到历史同柱的所有连续段，算ln(末日/首日)取平均 */
function predictPillar(
  data: ParsedCSV,
  pillarFn: (idx: number) => string | undefined,
  targetPillar: string
): { count: number; avgReturn: number } | null {
  if (!data.closeColumn) return null;

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

  const segs = findSegmentsForKey(indices, closes, pillarFn, targetPillar);
  if (segs.length === 0) return null;

  const returns = segs.map(s => Math.log(s.last / s.first));
  const avg = returns.reduce((a, b) => a + b, 0) / returns.length;

  return { count: segs.length, avgReturn: avg };
}

/** 获取指定年份的干支信息 */
function getYearGanZhi(year: number): { yearPillar: string; gan: string; zhi: string } | null {
  try {
    const solar = Solar.fromYmd(year, 6, 1);
    const lunar = solar.getLunar();
    const pillar = lunar.getYearInGanZhi();
    return { yearPillar: pillar, gan: pillar[0], zhi: pillar[1] };
  } catch {
    return null;
  }
}

/** 获取指定年月月柱 */
function getMonthGanZhi(year: number, month: number): string | null {
  try {
    const solar = Solar.fromYmd(year, month, 15);
    const lunar = solar.getLunar();
    return lunar.getMonthInGanZhi();
  } catch {
    return null;
  }
}

/** 2026年月柱列表 */
function get2026Months(): { month: number; pillar: string }[] {
  const months: { month: number; pillar: string }[] = [];
  for (let m = 1; m <= 12; m++) {
    const p = getMonthGanZhi(2026, m);
    if (p) months.push({ month: m, pillar: p });
  }
  return months;
}

/** 2026年节气列表 */
function get2026SolarTerms(): { name: string; dateStr: string }[] {
  try {
    const solar = Solar.fromYmd(2026, 6, 1);
    const lunar = solar.getLunar();
    const table = lunar.getJieQiTable() as Record<string, any>;
    const list = lunar.getJieQiList() as string[];

    const result: { name: string; dateStr: string }[] = [];
    const skipSet = new Set(['DA_XUE', 'DONG_ZHI', 'XIAO_HAN', 'DA_HAN', 'LI_CHUN', 'YU_SHUI', 'JING_ZHE']);

    for (const name of list) {
      if (skipSet.has(name)) continue;
      const s = table[name];
      if (!s) continue;
      if (s.getYear() === 2026) {
        result.push({
          name,
          dateStr: `${s.getYear()}-${String(s.getMonth()).padStart(2, '0')}-${String(s.getDay()).padStart(2, '0')}`,
        });
      }
    }

    result.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    return result;
  } catch {
    return [];
  }
}

export default function PredictionPanel({ data }: Props) {
  const yearInfo = useMemo(() => getYearGanZhi(2026), []);

  // 年柱预测
  const yearPred = useMemo(() => {
    if (!yearInfo) return null;
    return predictPillar(data, idx => data.ganZhiMap?.get(idx)?.yearPillar, yearInfo.yearPillar);
  }, [data, yearInfo]);

  // 月柱预测
  const monthPreds = useMemo(() => {
    const months = get2026Months();
    return months.map(m => ({
      month: m.month,
      pillar: m.pillar,
      pred: predictPillar(data, idx => data.ganZhiMap?.get(idx)?.monthPillar, m.pillar),
    }));
  }, [data]);

  // 节气预测
  const termPreds = useMemo(() => {
    const terms = get2026SolarTerms();
    return terms.map(t => ({
      name: t.name,
      dateStr: t.dateStr,
      pred: predictPillar(data, idx => data.solarTermMap?.get(idx)?.name, t.name),
    }));
  }, [data]);

  if (!yearInfo) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400 text-sm">
        无法获取2026年干支信息
      </div>
    );
  }

  const monthHasData = monthPreds.filter(m => m.pred).length;
  const termHasData = termPreds.filter(t => t.pred).length;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden space-y-px">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-medium text-sm">走势预测</h3>
          <span className="text-slate-500 text-xs">基于历史同干支/节气统计</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span>目标年: 2026 ({yearInfo.yearPillar}年)</span>
        </div>
      </div>

      {/* 年柱预测 */}
      <div className="px-4 py-4 flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
            yearPred ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-700/30 text-slate-500'
          }`}>
            {yearInfo.yearPillar}
          </div>
          <div>
            <p className="text-slate-400 text-xs">年柱预测</p>
            {yearPred ? (
              <div className="flex items-center gap-1.5">
                {yearPred.avgReturn >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                )}
                <span className={`text-lg font-bold ${yearPred.avgReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {fmtPct(yearPred.avgReturn)}
                </span>
              </div>
            ) : (
              <span className="text-slate-500 text-sm">无历史数据</span>
            )}
          </div>
        </div>
        {yearPred && (
          <div className="text-xs text-slate-500">
            历史出现 {yearPred.count} 次
          </div>
        )}
      </div>

      {/* 月柱预测 */}
      {monthHasData > 0 && (
        <div className="border-t border-slate-700 px-4 py-3">
          <p className="text-slate-400 text-xs mb-2">月柱预测 (2026年各月)</p>
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
            {monthPreds.map(m => (
              <div key={m.month} className={`text-center p-2 rounded-lg ${
                m.pred ? 'bg-slate-700/30' : 'bg-slate-700/10 opacity-30'
              }`}>
                <p className="text-[10px] text-slate-500">{m.month}月</p>
                <p className="text-xs font-medium text-amber-300">{m.pillar}</p>
                <p className={`text-xs font-semibold mt-0.5 ${
                  m.pred ? (m.pred.avgReturn >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'
                }`}>
                  {m.pred ? fmtPct(m.pred.avgReturn) : '-'}
                </p>
                {m.pred && (
                  <p className="text-[9px] text-slate-500">n={m.pred.count}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 节气预测 */}
      {termHasData > 0 && (
        <div className="border-t border-slate-700 px-4 py-3">
          <p className="text-slate-400 text-xs mb-2">节气预测 (2026年各节气区间)</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
            {termPreds.map(t => {
              const colors = getSolarTermColor(t.name);
              return (
                <div key={t.name} className={`text-center p-2 rounded-lg ${
                  t.pred ? 'bg-slate-700/30' : 'bg-slate-700/10 opacity-30'
                }`}>
                  <p className={`text-xs font-medium ${colors.text}`}>{t.name}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${
                    t.pred ? (t.pred.avgReturn >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'
                  }`}>
                    {t.pred ? fmtPct(t.pred.avgReturn) : '-'}
                  </p>
                  {t.pred && (
                    <p className="text-[9px] text-slate-500">n={t.pred.count}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
