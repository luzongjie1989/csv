import { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fmtPct } from '@/utils/statistics';
import { getSolarTermColor } from '@/utils/solarTerms';
import { Solar } from 'lunar-javascript';
import type { ParsedCSV } from '@/types';

interface Props { data: ParsedCSV; }

function predictPillar(
  data: ParsedCSV,
  keyFn: (idx: number) => string | undefined,
  target: string
): { count: number; avgReturn: number } | null {
  if (!data.closeColumn) return null;
  const closes: number[] = [];
  const indices: number[] = [];
  data.rows.forEach((row, idx) => {
    const v = parseFloat(row[data.closeColumn!] || '');
    if (!isNaN(v) && v > 0) { closes.push(v); indices.push(idx); }
  });
  if (closes.length < 2) return null;

  // 找到target的所有连续段
  const segs: { first: number; last: number }[] = [];
  let inSeg = false;
  indices.forEach((origIdx, i) => {
    const key = keyFn(origIdx);
    if (key === target) {
      if (!inSeg) { segs.push({ first: closes[i], last: closes[i] }); inSeg = true; }
      else { segs[segs.length - 1].last = closes[i]; }
    } else { inSeg = false; }
  });
  if (segs.length === 0) return null;
  const rets = segs.map(s => Math.log(s.last / s.first));
  return { count: segs.length, avgReturn: rets.reduce((a, b) => a + b, 0) / rets.length };
}

function getYearGanZhi(year: number) {
  try { const s = Solar.fromYmd(year, 6, 1).getLunar(); const p = s.getYearInGanZhi(); return { yearPillar: p, gan: p[0], zhi: p[1] }; }
  catch { return null; }
}

function getMonthPillar(year: number, month: number) {
  try { return Solar.fromYmd(year, month, 15).getLunar().getMonthInGanZhi(); }
  catch { return null; }
}

function getYearSolarTerms(year: number) {
  try {
    const table = Solar.fromYmd(year, 6, 1).getLunar().getJieQiTable() as Record<string, any>;
    const list = Solar.fromYmd(year, 6, 1).getLunar().getJieQiList() as string[];
    const skip = new Set(['DA_XUE','DONG_ZHI','XIAO_HAN','DA_HAN','LI_CHUN','YU_SHUI','JING_ZHE']);
    const res: { name: string; month: number; day: number }[] = [];
    for (const n of list) {
      if (skip.has(n)) continue;
      const s = table[n]; if (!s) continue;
      if (s.getYear() === year) res.push({ name: n, month: s.getMonth(), day: s.getDay() });
    }
    return res.sort((a, b) => a.month !== b.month ? a.month - b.month : a.day - b.day);
  } catch { return []; }
}

export default function PredictionPanel({ data }: Props) {
  const yearInfo = useMemo(() => getYearGanZhi(2026), []);

  // 月柱预测
  const monthChartData = useMemo(() => {
    const items: { name: string; value: number; count: number; hasData: boolean; pillar: string }[] = [];
    for (let m = 1; m <= 12; m++) {
      const pillar = getMonthPillar(2026, m);
      if (!pillar) continue;
      const pred = pillar ? predictPillar(data, idx => data.ganZhiMap?.get(idx)?.monthPillar, pillar) : null;
      items.push({
        name: `${m}月`, value: pred?.avgReturn ?? 0, count: pred?.count ?? 0,
        hasData: !!pred, pillar,
      });
    }
    return items;
  }, [data]);

  // 节气预测
  const termChartData = useMemo(() => {
    const terms = getYearSolarTerms(2026);
    return terms.map(t => {
      const pred = predictPillar(data, idx => data.solarTermMap?.get(idx)?.name, t.name);
      return {
        name: t.name, value: pred?.avgReturn ?? 0, count: pred?.count ?? 0,
        hasData: !!pred,
      };
    });
  }, [data]);

  // 年柱预测
  const yearPred = useMemo(() => {
    if (!yearInfo) return null;
    return predictPillar(data, idx => data.ganZhiMap?.get(idx)?.yearPillar, yearInfo.yearPillar);
  }, [data, yearInfo]);

  const monthHas = monthChartData.filter(d => d.hasData).length;
  const termHas = termChartData.filter(d => d.hasData).length;

  if (!yearInfo) return <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400 text-sm">无法获取2026年干支信息</div>;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-medium text-sm">走势预测</h3>
          <span className="text-slate-500 text-xs">基于历史同干支/节气统计</span>
        </div>
        <span className="text-xs text-slate-400">目标年: 2026 ({yearInfo.yearPillar}年)</span>
      </div>

      {/* 年柱 */}
      <div className="px-4 py-4 flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${yearPred ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-700/30 text-slate-500'}`}>
            {yearInfo.yearPillar}
          </div>
          <div>
            <p className="text-slate-400 text-xs">年柱预测</p>
            {yearPred ? (
              <div className="flex items-center gap-1.5">
                {yearPred.avgReturn >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-rose-400" />}
                <span className={`text-lg font-bold ${yearPred.avgReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtPct(yearPred.avgReturn)}</span>
              </div>
            ) : <span className="text-slate-500 text-sm">无历史数据</span>}
          </div>
        </div>
        {yearPred && <span className="text-xs text-slate-500">历史出现 {yearPred.count} 次</span>}
      </div>

      {/* 月柱走势图 */}
      {monthHas > 0 && (
        <div className="border-t border-slate-700 px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-xs">月柱预测</p>
            <span className="text-slate-500 text-[10px]">有数据 {monthHas}/12</span>
          </div>
          <div className="w-full" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#475569' }} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#475569' }} tickLine={false} tickFormatter={(v: number) => (v * 100).toFixed(0) + '%'} />
                <Tooltip content={<MonthTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="value" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* 月柱数值 */}
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
            {monthChartData.map(d => (
              <div key={d.name} className={`text-center p-2 rounded-lg ${d.hasData ? 'bg-slate-700/30' : 'bg-slate-700/10 opacity-30'}`}>
                <p className="text-[10px] text-slate-500">{d.name}</p>
                <p className="text-xs font-medium text-amber-300">{d.pillar}</p>
                <p className={`text-xs font-semibold mt-0.5 ${d.hasData ? (d.value >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}`}>
                  {d.hasData ? fmtPct(d.value) : '-'}
                </p>
                {d.hasData && <p className="text-[9px] text-slate-500">n={d.count}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 节气走势图 */}
      {termHas > 0 && (
        <div className="border-t border-slate-700 px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-xs">节气预测</p>
            <span className="text-slate-500 text-[10px]">有数据 {termHas}/24</span>
          </div>
          <div className="w-full" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={termChartData} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={{ stroke: '#475569' }} tickLine={false} interval={0} angle={-45} textAnchor="end" height={50} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#475569' }} tickLine={false} tickFormatter={(v: number) => (v * 100).toFixed(0) + '%'} />
                <Tooltip content={<TermTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="value" fill="#0ea5e9" radius={[2, 2, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* 节气数值 */}
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
            {termChartData.map(d => {
              const c = getSolarTermColor(d.name);
              return (
                <div key={d.name} className={`text-center p-2 rounded-lg ${d.hasData ? 'bg-slate-700/30' : 'bg-slate-700/10 opacity-30'}`}>
                  <p className={`text-xs font-medium ${c.text}`}>{d.name}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${d.hasData ? (d.value >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}`}>
                    {d.hasData ? fmtPct(d.value) : '-'}
                  </p>
                  {d.hasData && <p className="text-[9px] text-slate-500">n={d.count}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** 月柱Tooltip */
function MonthTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d.hasData) return null;
  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-white text-sm font-medium">{d.name} ({d.pillar})</p>
      <p className={`text-xs font-semibold ${d.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtPct(d.value)}</p>
      <p className="text-slate-500 text-xs">n={d.count}</p>
    </div>
  );
}

/** 节气Tooltip */
function TermTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d.hasData) return null;
  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-white text-sm font-medium">{d.name}</p>
      <p className={`text-xs font-semibold ${d.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtPct(d.value)}</p>
      <p className="text-slate-500 text-xs">n={d.count}</p>
    </div>
  );
}
