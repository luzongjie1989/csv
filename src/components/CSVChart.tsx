import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { ParsedCSV } from '@/types';

interface CSVChartProps {
  data: ParsedCSV;
}

interface ChartPoint {
  date: string;
  close: number;
  [key: string]: string | number;
}

export default function CSVChart({ data }: CSVChartProps) {
  const chartData = useMemo<ChartPoint[]>(() => {
    const { dateColumn, closeColumn, headers, rows } = data;

    if (!dateColumn || !closeColumn) {
      return [];
    }

    return rows
      .map((row) => {
        const dateValue = row[dateColumn];
        const closeValue = parseFloat(row[closeColumn]?.replace(/,/g, ''));

        if (!dateValue || isNaN(closeValue)) return null;

        const point: ChartPoint = {
          date: dateValue,
          close: closeValue,
        };

        // Add other numeric columns for potential multi-line chart
        headers.forEach((header) => {
          if (header !== dateColumn) {
            const val = parseFloat(row[header]?.replace(/,/g, ''));
            if (!isNaN(val)) {
              point[header] = val;
            }
          }
        });

        return point;
      })
      .filter((item): item is ChartPoint => item !== null);
  }, [data]);

  // Check if we have Open, High, Low columns for multi-line
  const hasOHLC = useMemo(() => {
    const headers = data.headers.map(h => h.toLowerCase());
    return headers.includes('open') || headers.includes('开盘') ||
           headers.includes('high') || headers.includes('最高') ||
           headers.includes('low') || headers.includes('最低');
  }, [data.headers]);

  if (chartData.length === 0) {
    return null;
  }

  const numericHeaders = data.headers.filter(h => {
    if (h === data.dateColumn) return false;
    const lower = h.toLowerCase();
    return ['open', 'high', 'low', 'close', '开盘', '最高', '最低', '收盘'].includes(lower);
  });

  const lineColors: Record<string, string> = {
    [data.closeColumn || 'close']: '#06b6d4',
  };

  // Assign colors for OHLC
  const colorPalette = ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  numericHeaders.forEach((h, i) => {
    if (!lineColors[h]) {
      lineColors[h] = colorPalette[i % colorPalette.length];
    }
  });

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
  }) => {
    if (!active || !payload) return null;

    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
        <p className="text-slate-300 text-xs font-medium mb-2">{label}</p>
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-400">{entry.name}:</span>
            <span className="text-white font-medium">
              {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-cyan-400" />
        <h3 className="text-white font-medium text-sm">价格走势图</h3>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={{ stroke: '#475569' }}
              axisLine={{ stroke: '#475569' }}
              minTickGap={30}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={{ stroke: '#475569' }}
              axisLine={{ stroke: '#475569' }}
              domain={['auto', 'auto']}
              tickFormatter={(value: number) =>
                value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value.toString()
              }
            />
            <Tooltip content={<CustomTooltip />} />

            {hasOHLC && numericHeaders.length > 1 ? (
              numericHeaders.map((header) => (
                <Line
                  key={header}
                  type="monotone"
                  dataKey={header}
                  stroke={lineColors[header] || colorPalette[0]}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4, fill: lineColors[header] || colorPalette[0] }}
                />
              ))
            ) : (
              <Line
                type="monotone"
                dataKey="close"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: '#06b6d4' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {hasOHLC && numericHeaders.length > 1 && (
        <div className="px-4 pb-3 flex flex-wrap gap-3">
          {numericHeaders.map((header) => (
            <div key={header} className="flex items-center gap-1.5 text-xs">
              <span
                className="w-2.5 h-0.5 rounded"
                style={{ backgroundColor: lineColors[header] }}
              />
              <span className="text-slate-400">{header}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
