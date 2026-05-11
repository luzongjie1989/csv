import { useState } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
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

  // Determine if we have GanZhi data
  const hasGanZhi = data.ganZhiMap && data.ganZhiMap.size > 0;
  const dateColIdx = data.dateColumn ? headers.indexOf(data.dateColumn) : -1;

  // Build display headers: original headers + GanZhi columns inserted after date column
  const displayHeaders: string[] = [];
  const ganZhiHeaders = ['年柱', '月柱', '日柱'];
  const headerGanZhiSet = new Set(ganZhiHeaders);

  headers.forEach((h, idx) => {
    displayHeaders.push(h);
    // Insert GanZhi columns right after the date column
    if (hasGanZhi && dateColIdx === idx) {
      ganZhiHeaders.forEach(gh => displayHeaders.push(gh));
    }
  });

  // Helper: render a header cell
  const renderHeaderCell = (header: string) => {
    const isGanZhiCol = headerGanZhiSet.has(header);
    return (
      <TableHead
        key={header}
        className={`font-medium text-xs whitespace-nowrap bg-slate-800 ${
          isGanZhiCol ? 'text-amber-400' : 'text-cyan-400'
        }`}
      >
        {header}
      </TableHead>
    );
  };

  // Helper: render a data cell
  const renderDataCell = (header: string, value: string) => {
    const isGanZhiCol = headerGanZhiSet.has(header);
    return (
      <TableCell
        key={header}
        className={`text-xs whitespace-nowrap ${
          isGanZhiCol ? 'text-amber-300 font-medium' : 'text-slate-300'
        }`}
      >
        {value || '-'}
      </TableCell>
    );
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-medium text-sm">数据预览</h3>
          {hasGanZhi && (
            <span className="text-amber-400 text-xs bg-amber-500/10 px-2 py-0.5 rounded-full">
              ☯ 甲子历法已启用
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
              // Build the cells array with GanZhi columns inserted
              const cells: { header: string; value: string }[] = [];
              headers.forEach((h, idx) => {
                cells.push({ header: h, value: row[h] || '' });
                // Insert GanZhi values after date column
                if (hasGanZhi && dateColIdx === idx) {
                  const gz = data.ganZhiMap!.get(rowIdx);
                  cells.push({ header: '年柱', value: gz?.yearPillar || '' });
                  cells.push({ header: '月柱', value: gz?.monthPillar || '' });
                  cells.push({ header: '日柱', value: gz?.dayPillar || '' });
                }
              });

              return (
                <TableRow
                  key={rowIdx}
                  className="border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                >
                  {cells.map((c) => renderDataCell(c.header, c.value))}
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
