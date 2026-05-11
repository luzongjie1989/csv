import { Table2, Columns3, Rows3, CalendarRange } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ParsedCSV } from '@/types';

interface DataCardsProps {
  data: ParsedCSV;
}

export default function DataCards({ data }: DataCardsProps) {
  const { rowCount, columnCount, dateColumn, rows, detectedFormat, ganZhiMap } = data;

  // Calculate date range if date column exists
  let dateRange = '-';
  if (dateColumn && rows.length > 0) {
    const dates = rows
      .map(r => r[dateColumn])
      .filter(d => d && d.trim() !== '');
    if (dates.length > 0) {
      dateRange = `${dates[0]} ~ ${dates[dates.length - 1]}`;
    }
  }

  // Get first and last GanZhi info for display
  let firstGanZhi = ganZhiMap?.size ? ganZhiMap.get(0) : undefined;
  let lastGanZhi: import('@/types').GanZhiInfo | undefined;
  if (ganZhiMap && ganZhiMap.size > 0) {
    const lastIdx = rows.length - 1;
    lastGanZhi = ganZhiMap.get(lastIdx);
  }

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

      {/* 干支历法信息 */}
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
