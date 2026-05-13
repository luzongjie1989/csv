import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fmtPct } from '@/utils/statistics';
import { getSolarTermColor } from '@/utils/solarTerms';
import { Solar } from 'lunar-javascript';
import type { ParsedCSV } from '@/types';

interface Props { data: ParsedCSV; }

/** 从CSV数据提取最新日期，返回{year, month} */
function getLatestDateFromCSV(data: ParsedCSV): { year: number; month: number } | null {
  if (!data.dateColumn || data.rows.length === 0) return null;
  const parseDate = (str: string): Date | null => {
    str = str.trim();
    // YYYY-MM-DD or YYYY/MM/DD
    const iso = str.match(/(\d{4})[\-/](\d{1,2})[\-/](\d{1,2})/);
    if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    // MM/DD/YYYY
    const us = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (us) return new Date(parseInt(us[3]), parseInt(us[1]) - 1, parseInt(us[2]));
    return null;
  };
  let latest: Date | null = null;
  for (const row of data.rows) {
    const d = parseDate(row[data.dateColumn!] || '');
    if (d && (!latest || d > latest)) latest = d;
  }
  if (!latest) return null;
  return { year: latest.getFullYear(), month: latest.getMonth() + 1 };
}

/** 确定预测范围 */
function getPredictionRange(data: ParsedCSV): {
  predictYear: number;
  months: { year: number; month: number; label: string }[];
} {
  const latest = getLatestDateFromCSV(data);
  if (!latest) {
    // 默认当年1-12月
    const y = new Date().getFullYear();
    return {
      predictYear: y,
      months: Array.from({ length: 12 }, (_, i) => ({ year: y, month: i + 1, label: `${i + 1}月` })),
    };
  }
  const { year, month } = latest;
  if (month > 6) {
    // 延长到次年6个月：当年剩余月份 + 次年前6个月
    const months: { year: number; month: number; label: string }[] = [];
    for (let m = month + 1; m <= 12; m++) {
      months.push({ year, month: m, label: `${m}月` });
    }
    for (let m = 1; m <= 6; m++) {
      months.push({ year: year + 1, month: m, label: `${year + 1}年${m}月` });
    }
    return { predictYear: year, months };
  } else {
    // 当年1-12月
    return {
      predictYear: year,
      months: Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1, label: `${i + 1}月` })),
    };
  }
}

/** 当前北京时间 */
function getNowBeijing(): Date {
  return new Date();
}

/** 当前甲子历 */
function getCurrentGanZhi() {
  const now = getNowBeijing();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  try {
    const lunar = Solar.fromYmd(y, m, d).getLunar();
    return {
      dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      yearPillar: lunar.getYearInGanZhi(),
      monthPillar: lunar.getMonthInGanZhi(),
      dayPillar: lunar.getDayInGanZhi(),
      year: y, month: m, day: d,
    };
  } catch { return null; }
}

/** 获取指定年月月柱 */
function getMonthPillar(year: number, month: number) {
  try { return Solar.fromYmd(year, month, 15).getLunar().getMonthInGanZhi(); }
  catch { return null; }
}

/** 获取指定年份的完整节气列表（含日期） */
function getSolarTermsWithDates(year: number): { name: string; month: number; day: number; dateStr: string }[] {
  try {
    const solar = Solar.fromYmd(year, 6, 1);
    const lunar = solar.getLunar();
    const table = lunar.getJieQiTable() as Record<string, any>;
    const list = lunar.getJieQiList() as string[];
    const skip = new Set(['DA_XUE', 'DONG_ZHI', 'XIAO_HAN', 'DA_HAN', 'LI_CHUN', 'YU_SHUI', 'JING_ZHE']);
    const res: { name: string; month: number; day: number; dateStr: string }[] = [];
    for (const n of list) {
      if (skip.has(n)) continue;
      const s = table[n]; if (!s) continue;
      if (s.getYear() === year) {
        res.push({
          name: n, month: s.getMonth(), day: s.getDay(),
          dateStr: `${s.getYear()}-${String(s.getMonth()).padStart(2, '0')}-${String(s.getDay()).padStart(2, '0')}`,
        });
      }
    }
    return res.sort((a, b) => a.month !== b.month ? a.month - b.month : a.day - b.day);
  } catch { return []; }
}

/** 获取每个节气的日期范围 {start, end} */
function getTermRanges(year: number): Map<string, { start: string; end: string }> {
  const terms = getSolarTermsWithDates(year);
  const map = new Map<string, { start: string; end: string }>();
  for (let i = 0; i < terms.length; i++) {
    const start = terms[i].dateStr;
    const end = i < terms.length - 1 ? terms[i + 1].dateStr : `${year}-12-31`;
    const endDate = new Date(end);
    endDate.setDate(endDate.getDate() - 1);
    const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    map.set(terms[i].name, { start, end: endStr });
  }
  return map;
}

/** 判断指定日期处于哪个节气 */
function getTermAtDate(year: number, month: number, day: number): string | null {
  const terms = getSolarTermsWithDates(year);
  const target = new Date(year, month - 1, day);
  let result: string | null = null;
  for (const t of terms) {
    if (new Date(year, t.month - 1, t.day) <= target) result = t.name;
    else break;
  }
  return result;
}

/** 预测核心 */
function predictPillar(data: ParsedCSV, keyFn: (idx: number) => string | undefined, target: string) {
  if (!data.closeColumn) return null;
  const closes: number[] = []; const indices: number[] = [];
  data.rows.forEach((row, idx) => {
    const v = parseFloat(row[data.closeColumn!] || '');
    if (!isNaN(v) && v > 0) { closes.push(v); indices.push(idx); }
  });
  if (closes.length < 2) return null;
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
  try { const p = Solar.fromYmd(year, 6, 1).getLunar().getYearInGanZhi(); return { yearPillar: p, gan: p[0], zhi: p[1] }; }
  catch { return null; }
}

export default function PredictionPanel({ data }: Props) {
  const current = useMemo(() => getCurrentGanZhi(), []);

  // 动态预测范围（基于CSV最新数据）
  const { predictYear, months: predictMonths } = useMemo(() => getPredictionRange(data), [data]);
  const yearInfo = useMemo(() => getYearGanZhi(predictYear), [predictYear]);

  // 节气范围
  const termRanges = useMemo(() => getTermRanges(predictYear), [predictYear]);
  const currentTerm = useMemo(() => {
    if (!current) return null;
    return getTermAtDate(current.year, current.month, current.day);
  }, [current]);

  // 月柱数据
  const monthData = useMemo(() => {
    return predictMonths.map(({ year, month, label }) => {
      const pillar = getMonthPillar(year, month);
      const pred = pillar ? predictPillar(data, idx => data.ganZhiMap?.get(idx)?.monthPillar, pillar) : null;
      const isCurrent = current?.monthPillar === pillar && current?.month === month && current?.year === year;
      return {
        name: label, value: pred?.avgReturn ?? 0, count: pred?.count ?? 0,
        hasData: !!pred, pillar: pillar || '-', isCurrent, year, month,
      };
    });
  }, [data, predictMonths, current]);

  // 节气数据
  const termData = useMemo(() => {
    const terms = getSolarTermsWithDates(predictYear);
    return terms.map(t => {
      const pred = predictPillar(data, idx => data.solarTermMap?.get(idx)?.name, t.name);
      const range = termRanges.get(t.name);
      const isCurrent = currentTerm === t.name;
      return {
        name: t.name, value: pred?.avgReturn ?? 0, count: pred?.count ?? 0,
        hasData: !!pred, dateStr: t.dateStr, range, isCurrent,
      };
    });
  }, [data, predictYear, termRanges, currentTerm]);

  // 年柱预测
  const yearPred = useMemo(() => {
    if (!yearInfo) return null;
    return predictPillar(data, idx => data.ganZhiMap?.get(idx)?.yearPillar, yearInfo.yearPillar);
  }, [data, yearInfo]);

  const monthHas = monthData.filter(d => d.hasData).length;
  const termHas = termData.filter(d => d.hasData).length;

  if (!yearInfo || !current) {
    return <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400 text-sm">无法获取干支信息</div>;
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header + 当前甲子历 + CSV最新数据信息 */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-medium text-sm">走势预测</h3>
            <span className="text-slate-500 text-xs">基于历史同干支/节气统计</span>
          </div>
          <span className="text-xs text-slate-400">预测年: {predictYear} ({yearInfo.yearPillar}年) {predictMonths.length > 12 && <span className="text-amber-400">[延至次年6月]</span>}</span>
        </div>
        {/* 当前甲子历 */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Clock className="w-3 h-3" />
          <span>今天: {current.dateStr}</span>
          <span className="text-amber-400 font-medium">{current.yearPillar}年</span>
          <span className="text-purple-400 font-medium">{current.monthPillar}月</span>
          <span className="text-cyan-400 font-medium">{current.dayPillar}日</span>
          {currentTerm && <span className="text-emerald-400 font-medium">{currentTerm}</span>}
        </div>
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
            <p className="text-slate-400 text-xs">月柱预测 {current?.monthPillar && <span className="text-purple-400">(当前: {current.monthPillar}月)</span>}</p>
            <span className="text-slate-500 text-[10px]">有数据 {monthHas}/{predictMonths.length}</span>
          </div>
          <div className="w-full" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#475569' }} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#475569' }} tickLine={false} tickFormatter={(v: number) => (v * 100).toFixed(0) + '%'} />
                <Tooltip content={<MonthTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="value" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* 月柱数值 */}
          <div className="grid grid-cols-6 gap-2">
            {monthData.map(d => (
              <div key={`${d.year}-${d.month}`} className={`text-center p-2 rounded-lg relative ${
                d.isCurrent ? 'ring-2 ring-purple-400 bg-purple-500/10' : d.hasData ? 'bg-slate-700/30' : 'bg-slate-700/10 opacity-30'
              }`}>
                {d.isCurrent && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-400 animate-pulse" />}
                <p className="text-[10px] text-slate-500">{d.name}</p>
                <p className={`text-xs font-medium ${d.isCurrent ? 'text-purple-400' : 'text-amber-300'}`}>{d.pillar}</p>
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
            <p className="text-slate-400 text-xs">节气预测 {currentTerm && <span className="text-emerald-400">(当前: {currentTerm})</span>}</p>
            <span className="text-slate-500 text-[10px]">有数据 {termHas}/24</span>
          </div>
          <div className="w-full" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={termData} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
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
            {termData.map(d => {
              const c = getSolarTermColor(d.name);
              return (
                <div key={d.name} className={`text-center p-2 rounded-lg relative ${
                  d.isCurrent ? 'ring-2 ring-emerald-400 bg-emerald-500/10' : d.hasData ? 'bg-slate-700/30' : 'bg-slate-700/10 opacity-30'
                }`}>
                  {d.isCurrent && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                  <p className={`text-xs font-medium ${d.isCurrent ? 'text-emerald-400' : c.text}`}>{d.name}</p>
                  <p className="text-[10px] text-slate-500">{d.dateStr}</p>
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
      <p className="text-white text-sm font-medium">{d.name} ({d.pillar}) {d.isCurrent && <span className="text-purple-400">← 当前</span>}</p>
      <p className={`text-xs font-semibold ${d.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtPct(d.value)}</p>
      <p className="text-slate-500 text-xs">n={d.count}</p>
    </div>
  );
}

/** 节气Tooltip（含日期范围） */
function TermTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d.hasData && !d.range) return null;
  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 shadow-xl min-w-[160px]">
      <p className="text-white text-sm font-medium">{d.name} {d.isCurrent && <span className="text-emerald-400">← 当前</span>}</p>
      {d.range && (
        <p className="text-amber-300 text-xs mt-0.5">
          {d.range.start} ~ {d.range.end}
        </p>
      )}
      {d.hasData && (
        <>
          <p className={`text-xs font-semibold mt-1 ${d.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtPct(d.value)}</p>
          <p className="text-slate-500 text-xs">n={d.count}</p>
        </>
      )}
      {!d.hasData && <p className="text-slate-500 text-xs mt-1">无历史数据</p>}
    </div>
  );
}
