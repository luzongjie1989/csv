import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import type { ParsedCSV, UploadedFile } from '@/types';

function detectDelimiter(text: string): string {
  const firstLine = text.split('\n')[0] || '';
  if (firstLine.includes('|')) return '|';
  if (firstLine.includes('\t')) return '\t';
  return ',';
}

function cleanHeader(header: string): string {
  return header.replace(/^\/\//, '').trim();
}

function isCommentLine(line: string): boolean {
  return line.trim().startsWith('//');
}

function isSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  return /^[-\|:\s]+$/.test(trimmed) || trimmed.startsWith('| ---');
}

function detectDateColumn(headers: string[]): string | undefined {
  const datePatterns = ['date', '日期', 'time', '时间'];
  return headers.find(h =>
    datePatterns.some(p => h.toLowerCase().includes(p.toLowerCase()))
  );
}

function detectCloseColumn(headers: string[]): string | undefined {
  const closePatterns = ['close', '收盘'];
  return headers.find(h =>
    closePatterns.some(p => h.toLowerCase().includes(p.toLowerCase()))
  );
}

function detectFormat(headers: string[]): 'american' | 'chinese' | 'unknown' {
  const headerStr = headers.join(' ').toLowerCase();
  if (headerStr.includes('date') && headerStr.includes('open') && headerStr.includes('close')) {
    return 'american';
  }
  if (headerStr.includes('日期') && headerStr.includes('开盘') && headerStr.includes('收盘')) {
    return 'chinese';
  }
  if (headerStr.includes('date') || headerStr.includes('日期')) {
    return headerStr.includes('日期') ? 'chinese' : 'american';
  }
  return 'unknown';
}

export function useCSVParser() {
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseCSV = useCallback((file: File): Promise<ParsedCSV> => {
    return new Promise((resolve, reject) => {
      setIsParsing(true);
      setError(null);

      Papa.parse<string[]>(file, {
        complete: (results) => {
          try {
            const allData = results.data;

            // Filter out empty rows
            const nonEmptyRows = allData.filter(row => row.some(cell => cell.trim() !== ''));

            // Skip comment lines and find header
            let headerIndex = 0;
            let headers: string[] = [];

            for (let i = 0; i < nonEmptyRows.length; i++) {
              const line = nonEmptyRows[i].join(',');
              if (isCommentLine(line) || isSeparatorLine(line)) {
                headerIndex = i + 1;
                continue;
              }
              // Check if this row looks like a header (contains date/日期 keywords)
              const rowStr = nonEmptyRows[i].join(' ');
              if (/date|日期|open|开盘|close|收盘/i.test(rowStr)) {
                headers = nonEmptyRows[i].map(h => cleanHeader(h).trim());
                headerIndex = i;
                break;
              }
              if (headers.length === 0 && i < 5) {
                // Use first non-comment row as header
                headers = nonEmptyRows[i].map(h => cleanHeader(h).trim());
                headerIndex = i;
                break;
              }
            }

            if (headers.length === 0) {
              throw new Error('无法识别CSV表头');
            }

            // Parse data rows
            const rows: Record<string, string>[] = [];
            for (let i = headerIndex + 1; i < nonEmptyRows.length; i++) {
              const line = nonEmptyRows[i].join(',');
              if (isCommentLine(line) || isSeparatorLine(line)) continue;

              const rowData = nonEmptyRows[i];
              const rowObj: Record<string, string> = {};

              headers.forEach((header, idx) => {
                rowObj[header] = (rowData[idx] || '').trim();
              });

              // Skip empty rows
              if (Object.values(rowObj).some(v => v !== '')) {
                rows.push(rowObj);
              }
            }

            const detectedFormat = detectFormat(headers);
            const dateColumn = detectDateColumn(headers);
            const closeColumn = detectCloseColumn(headers);

            const parsed: ParsedCSV = {
              headers,
              rows,
              columnCount: headers.length,
              rowCount: rows.length,
              detectedFormat,
              dateColumn,
              closeColumn,
            };

            setIsParsing(false);
            resolve(parsed);
          } catch (err) {
            setIsParsing(false);
            setError(err instanceof Error ? err.message : '解析CSV失败');
            reject(err);
          }
        },
        error: (err: Error) => {
          setIsParsing(false);
          setError(err.message);
          reject(err);
        },
        delimiter: detectDelimiter,
        skipEmptyLines: false,
      });
    });
  }, []);

  const handleFileUpload = useCallback(async (file: File): Promise<UploadedFile> => {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
      const parsed = await parseCSV(file);
      return {
        file,
        type: 'csv',
        data: parsed,
      };
    } else if (/\.(png|jpg|jpeg)$/.test(fileName)) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            file,
            type: 'image',
            imageUrl: e.target?.result as string,
          });
        };
        reader.readAsDataURL(file);
      });
    } else {
      throw new Error('不支持的文件格式');
    }
  }, [parseCSV]);

  return { parseCSV, handleFileUpload, isParsing, error };
}
