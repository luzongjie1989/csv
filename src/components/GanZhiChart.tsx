import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts';
import { generateGanZhiStatsReport, fmtPct } from '@/utils/statistics';
import type { ParsedCSV } from '@/types';

type MainTab = 'gan' | 'zhi';
type SubTab = 'year' | 'month' | 'day';

interface Props {
  data: ParsedCSV;
}

const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: 'gan', label: '天干统计' },
  { key: 'zhi', label: '地支统计' },
];

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'year', label: '年' },
  { key: 'month', label: '月' },
  { key: 'day', label: '日' },
];

/** 天干五行配色 */
const GAN_COLORS: Record<string, string> = {
  '甲': '#10b981', '乙': '#10b981', // 木-绿
  '丙': '#f43f5e', '丁': '#f43f5e', // 火-红
  '戊': '#d97706', '己': '#d97706', // 土-黄
  '庚': '#f8fafc', '辛': '#f8fafc', // 金-白
  '壬': '#3b82f6', '癸': '#3b82f6', // 水-蓝
};

/** 地支五行配色 */
const ZHI_COLORS: Record<string, string> = {
  '寅': '#10b981', '卯': '#10b981', // 木-绿
  '巳': '#f43f5e', '午': '#f43f5e', // 火-红
  '辰': '#d97706', '戌': '#d97706', '丑': '#d97706', '未': '#d97706', // 土-黄
  '申': '#f8fafc', '酉': '#f8fafc', // 金-白
  '亥': '#3b82f6', '子': '#3b82f6', // 水-蓝
};

export default function GanZhiChart({ data }: Props) {
  const [mainTab, setMainTab] = useState<MainTab>('gan');
  const [subTab, setSubTab] = useState<SubTab>('year');

  const report = useMemo(() => generateGanZhiStatsReport(data), [data]);

  if (!report) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-400 text-sm">
        暂无收盘价数据，无法进行天干地支统计
      </div>
    );
  }

  // Select current stats
  const stats = mainTab === 'gan'
    ? (subTab === 'year' ? report.ganYear : subTab === 'month' ? report.ganMonth : report.ganDay)
    : (subTab === 'year' ? report.zhiYear : subTab === 'month' ? report.zhiMonth : report.zhiDay);

  const colors = mainTab === 'gan' ? GAN_COLORS : ZHI_COLORS;

  // Transform for Recharts
  const chartData = stats.map(s => ({
    name: s.label,
    value: s.avgLogReturn,
    count: s.count,
    display: fmtPct(s.avgLogReturn),
    color: s.count > 0 ? (colors[s.label] || '#94a3b8') : '#334155',
  }));

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-white font-medium text-sm">天干地支收益率统计</h3>
        <span className="text-slate-500 text-xs">
          连续段首尾对数收益率取平均
        </span>
      </div>

      {/* Main Tabs (天干/地支) */}
      <div className="grid grid-cols-2 border-b border-slate-700">
        {MAIN_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setMainTab(t.key)}
            className={`py-3 text-sm font-medium transition-colors ${
              mainTab === t.key
                ? 'text-amber-400 bg-amber-500/10 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/20'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub Tabs (年/月/日) */}
      <div className="flex border-b border-slate-700">
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex-1 py-2.5 text-sm transition-colors ${
              subTab === t.key
                ? 'text-cyan-400 bg-cyan-500/10 border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/20'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="px-4 py-6" style={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#94a3b8', fontSize: 13 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={false}
              tickFormatter={(v: number) => (v * 100).toFixed(0) + '%'}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={mainTab === 'gan' ? 48 : 36}>
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.color}
                  fillOpacity={entry.count > 0 ? 0.85 : 0.2}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-slate-700 flex flex-wrap gap-x-4 gap-y-1 justify-center">
        {getLegendItems(mainTab).map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-slate-400">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Custom tooltip for the bar chart */
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-white text-sm font-medium">{d.name}</p>
      <p className={`text-xs font-semibold ${d.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
        {d.display}
      </p>
      <p className="text-slate-500 text-xs">n={d.count}</p>
    </div>
  );
}

/** Get legend items with wuxing colors */
function getLegendItems(mainTab: MainTab): { label: string; color: string }[] {
  if (mainTab === 'gan') {
    return [
      { label: '木(甲乙)', color: '#10b981' },
      { label: '火(丙丁)', color: '#f43f5e' },
      { label: '土(戊己)', color: '#d97706' },
      { label: '金(庚辛)', color: '#f8fafc' },
      { label: '水(壬癸)', color: '#3b82f6' },
    ];
  }
  return [
    { label: '木(寅卯)', color: '#10b981' },
    { label: '火(巳午)', color: '#f43f5e' },
    { label: '土(辰戌丑未)', color: '#d97706' },
    { label: '金(申酉)', color: '#f8fafc' },
    { label: '水(亥子)', color: '#3b82f6' },
  ];
}
