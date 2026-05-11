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

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-white font-medium text-sm">数据预览</h3>
        <span className="text-slate-400 text-xs">
          共 {rows.length.toLocaleString()} 行
        </span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent">
              {headers.map((header) => (
                <TableHead
                  key={header}
                  className="text-cyan-400 font-medium text-xs whitespace-nowrap bg-slate-800"
                >
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((row, idx) => (
              <TableRow
                key={idx}
                className="border-slate-700/50 hover:bg-slate-700/30 transition-colors"
              >
                {headers.map((header) => (
                  <TableCell
                    key={header}
                    className="text-slate-300 text-xs whitespace-nowrap"
                  >
                    {row[header] || '-'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
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
