import { useState } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { getSolarTermColor } from '@/utils/solarTerms';
import type { ParsedCSV } from '@/types';

interface CSVTableProps {
  data: ParsedCSV;
}

const MAX_DISPLAY_ROWS = 100;

export default function CSVTable({ data }: CSVTableProps) {
  const [showAll, setShowAll] = useState(false);
  const { headers, rows } = data;
  const displayRows = showAll ? rows : rows.slice(0, MAX_DISPLAY_ROWS);
  const hasMore = rows.length > MAX_DISPLAY_ROWS;

  // Check feature flags
  const hasGanZhi = data.ganZhiMap && data.ganZhiMap.size > 0;
  const hasSolarTerm = data.solarTermMap && data.solarTermMap.size > 0;
  const dateColIdx = data.dateColumn ? headers.indexOf(data.dateColumn) : -1;

  // Build display headers with inserted columns
  const displayHeaders: string[] = [];
  const ganZhiHeaders = ['年柱', '月柱', '日柱'];
  const headerGanZhiSet = new Set(ganZhiHeaders);
  const headerSolarTermSet = new Set(['节气']);

  headers.forEach((h, idx) => {
    displayHeaders.push(h);
    // Insert GanZhi columns right after date column
    if (hasGanZhi && dateColIdx === idx) {
      ganZhiHeaders.forEach(gh => displayHeaders.push(gh));
    }
    // Insert Solar Term column right after date column (before GanZhi if both exist)
    if (hasSolarTerm && dateColIdx === idx) {
      displayHeaders.push('节气');
    }
  });

  // Helper: render a header cell
  const renderHeaderCell = (header: string) => {
    const isGanZhiCol = headerGanZhiSet.has(header);
    const isSolarTermCol = headerSolarTermSet.has(header);
    let className = 'font-medium text-xs whitespace-nowrap bg-slate-800 ';
    if (isGanZhiCol) {
      className += 'text-amber-400';
    } else if (isSolarTermCol) {
      className += 'text-emerald-400';
    } else {
      className += 'text-cyan-400';
    }
    return (
      <TableHead key={header} className={className}>
        {header}
      </TableHead>
    );
  };

  // Helper: render a data cell
  const renderDataCell = (header: string, value: string, rowIdx: number) => {
    const isGanZhiCol = headerGanZhiSet.has(header);
    const isSolarTermCol = headerSolarTermSet.has(header);

    if (isGanZhiCol) {
      return (
        <TableCell key={`${rowIdx}-${header}`} className="text-amber-300 text-xs whitespace-nowrap font-medium">
          {value || '-'}
        </TableCell>
      );
    }

    if (isSolarTermCol) {
      const term = data.solarTermMap?.get(rowIdx);
      if (!term) {
        return (
          <TableCell key={`${rowIdx}-${header}`} className="text-slate-500 text-xs whitespace-nowrap">
            -
          </TableCell>
        );
      }
      const colors = getSolarTermColor(term.name);
      const seasonChar = getSeasonChar(term.name);
      return (
        <TableCell key={`${rowIdx}-${header}`} className="text-xs whitespace-nowrap">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
            <span className="text-[10px] opacity-70">{seasonChar}</span>
            {term.name}
          </span>
        </TableCell>
      );
    }

    return (
      <TableCell key={`${rowIdx}-${header}`} className="text-slate-300 text-xs whitespace-nowrap">
        {value || '-'}
      </TableCell>
    );
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-white font-medium text-sm">数据预览</h3>
          {hasGanZhi && (
            <span className="text-amber-400 text-xs bg-amber-500/10 px-2 py-0.5 rounded-full">
              ☯ 甲子历法
            </span>
          )}
          {hasSolarTerm && (
            <span className="text-emerald-400 text-xs bg-emerald-500/10 px-2 py-0.5 rounded-full">
              ❄ 24节气
            </span>
          )}
        </div>
        <span className="text-slate-400 text-xs">
          共 {rows.length.toLocaleString()} 行
        </span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent">
              {displayHeaders.map(renderHeaderCell)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((row, rowIdx) => {
              // Build cells array with inserted columns
              const cells: { header: string; value: string }[] = [];
              headers.forEach((h, idx) => {
                cells.push({ header: h, value: row[h] || '' });
                
                if (dateColIdx === idx) {
                  // Insert GanZhi values
                  if (hasGanZhi) {
                    const gz = data.ganZhiMap!.get(rowIdx);
                    cells.push({ header: '年柱', value: gz?.yearPillar || '' });
                    cells.push({ header: '月柱', value: gz?.monthPillar || '' });
                    cells.push({ header: '日柱', value: gz?.dayPillar || '' });
                  }
                  // Insert Solar Term value
                  if (hasSolarTerm) {
                    const st = data.solarTermMap!.get(rowIdx);
                    cells.push({ header: '节气', value: st?.name || '' });
                  }
                }
              });

              return (
                <TableRow
                  key={rowIdx}
                  className="border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                >
                  {cells.map((c) => renderDataCell(c.header, c.value, rowIdx))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {hasMore && !showAll && (
        <div className="px-4 py-3 border-t border-slate-700 flex justify-center">
          <button
            onClick={() => setShowAll(true)}
            className="text-cyan-400 hover:text-cyan-300 text-xs font-medium transition-colors"
          >
            显示全部 {rows.length.toLocaleString()} 行数据
          </button>
        </div>
      )}
    </div>
  );
}

/** Get season character for display */
function getSeasonChar(termName: string): string {
  const spring = ['立春', '雨水', '惊蛰', '春分', '清明', '谷雨'];
  const summer = ['立夏', '小满', '芒种', '夏至', '小暑', '大暑'];
  const autumn = ['立秋', '处暑', '白露', '秋分', '寒露', '霜降'];
  const winter = ['立冬', '小雪', '大雪', '冬至', '小寒', '大寒'];

  if (spring.includes(termName)) return '春';
  if (summer.includes(termName)) return '夏';
  if (autumn.includes(termName)) return '秋';
  if (winter.includes(termName)) return '冬';
  return '';
}
