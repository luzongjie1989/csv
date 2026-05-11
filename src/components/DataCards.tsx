import { Table2, Columns3, Rows3, CalendarRange, Sun } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getSolarTermColor } from '@/utils/solarTerms';
import type { ParsedCSV } from '@/types';

interface DataCardsProps {
  data: ParsedCSV;
}

export default function DataCards({ data }: DataCardsProps) {
  const { rowCount, columnCount, dateColumn, rows, detectedFormat, ganZhiMap, solarTermMap } = data;

  // Calculate date range
  let dateRange = '-';
  if (dateColumn && rows.length > 0) {
    const dates = rows
      .map(r => r[dateColumn])
      .filter(d => d && d.trim() !== '');
    if (dates.length > 0) {
      dateRange = `${dates[0]} ~ ${dates[dates.length - 1]}`;
    }
  }

  // Get GanZhi info
  const firstGanZhi = ganZhiMap?.size ? ganZhiMap.get(0) : undefined;
  let lastGanZhi = ganZhiMap?.size ? ganZhiMap.get(rows.length - 1) : undefined;

  // Get Solar Term info
  const firstSolarTerm = solarTermMap?.size ? solarTermMap.get(0) : undefined;
  let lastSolarTerm = solarTermMap?.size ? solarTermMap.get(rows.length - 1) : undefined;

  // Count how many unique solar terms are covered
  const uniqueTerms = new Set<string>();
  solarTermMap?.forEach((term) => uniqueTerms.add(term.name));

  const formatLabel = detectedFormat === 'american'
    ? '美式格式'
    : detectedFormat === 'chinese'
      ? '中式格式'
      : '通用格式';

  const cards = [
    {
      icon: Rows3,
      label: '数据行数',
      value: rowCount.toLocaleString(),
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
    },
    {
      icon: Columns3,
      label: '数据列数',
      value: columnCount.toString(),
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      icon: CalendarRange,
      label: '日期范围',
      value: dateRange,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      icon: Table2,
      label: '格式识别',
      value: formatLabel,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.label} className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg ${card.bgColor} flex items-center justify-center shrink-0`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-slate-400 text-xs">{card.label}</p>
                <p className="text-white font-semibold text-sm truncate">{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Solar Term Info Card */}
      {solarTermMap && solarTermMap.size > 0 && firstSolarTerm && (
        <Card className="bg-gradient-to-br from-emerald-950/40 to-slate-800 border-emerald-700/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sun className="w-4 h-4 text-emerald-400" />
              <p className="text-emerald-300 text-sm font-medium">24节气信息</p>
              <span className="text-emerald-500/50 text-xs ml-1">({uniqueTerms.size} 个节气)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-slate-500 text-xs mb-1">起始节气区间</p>
                <SolarTermDisplay term={firstSolarTerm} />
              </div>
              {lastSolarTerm && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">结束节气区间</p>
                  <SolarTermDisplay term={lastSolarTerm} />
                </div>
              )}
            </div>
            {/* Unique terms tags */}
            <div className="mt-3 pt-3 border-t border-emerald-800/30">
              <p className="text-slate-500 text-xs mb-2">涉及节气</p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(uniqueTerms).map(termName => {
                  const colors = getSolarTermColor(termName);
                  return (
                    <span
                      key={termName}
                      className={`inline-block px-2 py-0.5 rounded text-xs ${colors.bg} ${colors.text}`}
                    >
                      {termName}
                    </span>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* GanZhi Info Card */}
      {ganZhiMap && ganZhiMap.size > 0 && firstGanZhi && (
        <Card className="bg-gradient-to-br from-amber-950/40 to-slate-800 border-amber-700/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-400 text-lg">☯</span>
              <p className="text-amber-300 text-sm font-medium">甲子历法</p>
            </div>
            <p className="text-slate-300 text-xs">
              首条：{firstGanZhi?.fullGanZhi}（{firstGanZhi?.yearAnimal}年）
            </p>
            {lastGanZhi && (
              <p className="text-slate-400 text-xs mt-1">
                末条：{lastGanZhi?.fullGanZhi}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Display a single solar term with seasonal styling */
function SolarTermDisplay({ term }: { term: { name: string; dateStr: string; isJie: boolean; isQi: boolean } }) {
  const colors = getSolarTermColor(term.name);
  const typeLabel = term.isJie ? '节' : term.isQi ? '气' : '';
  return (
    <div className={`inline-flex items-center gap-2 px-2 py-1 rounded ${colors.bg} ${colors.text}`}>
      <span className="text-sm font-medium">{term.name}</span>
      <span className="text-[10px] opacity-60 border border-current px-1 rounded">{typeLabel}</span>
      <span className="text-xs opacity-70">{term.dateStr}</span>
    </div>
  );
}
