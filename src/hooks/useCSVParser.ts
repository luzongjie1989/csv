import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import * as jschardet from 'jschardet';
import type { ParsedCSV, UploadedFile } from '@/types';

function detectDelimiter(text: string): string {
  const lines = text.split('\n').filter(l => l.trim() !== '');
  const firstLine = lines[0] || '';
  if (firstLine.includes('|')) {
    const pipeCount = (firstLine.match(/\|/g) || []).length;
    if (pipeCount >= 2) return '|';
  }
  if (firstLine.includes('\t')) return '\t';
  if (firstLine.includes(';')) return ';';
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
  return /^[-\|:\s]+$/.test(trimmed) || /^\|[\s-]+\|/.test(trimmed);
}

function detectDateColumn(headers: string[]): string | undefined {
  const datePatterns = ['date', '日期', 'time', '时间'];
  return headers.find(h =>
    datePatterns.some(p => h.toLowerCase().includes(p.toLowerCase()))
  );
}

function detectCloseColumn(headers: string[]): string | undefined {
  return headers.find(h => {
    const lower = h.toLowerCase();
    return lower === 'close' || lower === '收盘' || lower === '收';
  });
}

function detectFormat(headers: string[]): 'american' | 'chinese' | 'unknown' {
  const headerStr = headers.join(' ').toLowerCase();
  if (headerStr.includes('date') && headerStr.includes('open') && headerStr.includes('close')) {
    return 'american';
  }
  if (headerStr.includes('日期') && headerStr.includes('开盘') && headerStr.includes('收盘')) {
    return 'chinese';
  }
  const hasDate = headerStr.includes('日期') || headerStr.includes('时间');
  const hasOpen = headerStr.includes('开盘') || headerStr.includes('开');
  const hasClose = headerStr.includes('收盘') || headerStr.includes('收');
  if (hasDate && hasOpen && hasClose) {
    return 'chinese';
  }
  if (headerStr.includes('date') || headerStr.includes('日期') || headerStr.includes('时间')) {
    return headerStr.includes('日期') || headerStr.includes('时间') ? 'chinese' : 'american';
  }
  return 'unknown';
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
}

function detectEncoding(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);
  const sampleSize = Math.min(uint8Array.length, 50 * 1024);
  const sample = uint8Array.slice(0, sampleSize);
  let binaryString = '';
  for (let i = 0; i < sample.length; i++) {
    binaryString += String.fromCharCode(sample[i]);
  }
  const result = jschardet.detect(binaryString);
  const detected = result.encoding?.toLowerCase() || 'utf-8';
  const encodingMap: Record<string, string> = {
    'gb2312': 'gbk',
    'gb18030': 'gbk',
    'gbk': 'gbk',
    'big5': 'big5',
    'ascii': 'utf-8',
  };
  return encodingMap[detected] || detected;
}

function decodeBuffer(buffer: ArrayBuffer, encoding: string): string {
  try {
    const decoder = new TextDecoder(encoding, { fatal: false });
    return decoder.decode(buffer);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  }
}

async function readFileWithEncoding(file: File): Promise<string> {
  const buffer = await readFileAsArrayBuffer(file);
  const encoding = detectEncoding(buffer);
  console.log(`[Encoding] Detected: ${encoding} for file: ${file.name}`);
  return decodeBuffer(buffer, encoding);
}

export function useCSVParser() {
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseCSV = useCallback((file: File): Promise<ParsedCSV> => {
    return new Promise(async (resolve, reject) => {
      setIsParsing(true);
      setError(null);

      try {
        const text = await readFileWithEncoding(file);
        const delimiter = detectDelimiter(text);

        const parseResult = Papa.parse<string[]>(text, {
          delimiter,
          skipEmptyLines: true,
        });

        const allData = parseResult.data;
        const nonEmptyRows = allData.filter(row => row.some(cell => cell.trim() !== ''));

        let headerIndex = 0;
        let headers: string[] = [];

        for (let i = 0; i < nonEmptyRows.length; i++) {
          const line = nonEmptyRows[i].join(',');
          if (isCommentLine(line) || isSeparatorLine(line)) {
            headerIndex = i + 1;
            continue;
          }
          const lineLower = line.toLowerCase();
          if (/date|日期|time|时间|open|开盘|close|收盘|high|最高|low|最低|volume|成交量/i.test(lineLower)) {
            headers = nonEmptyRows[i].map(h => cleanHeader(h).trim()).filter(h => h !== '');
            headerIndex = i;
            break;
          }
          if (headers.length === 0 && i < 5) {
            headers = nonEmptyRows[i].map(h => cleanHeader(h).trim()).filter(h => h !== '');
            headerIndex = i;
            break;
          }
        }

        if (headers.length === 0) {
          throw new Error('无法识别CSV表头，请检查文件格式');
        }

        const rows: Record<string, string>[] = [];
        for (let i = headerIndex + 1; i < nonEmptyRows.length; i++) {
          const line = nonEmptyRows[i].join(',');
          if (isCommentLine(line) || isSeparatorLine(line)) continue;
          const rowData = nonEmptyRows[i];
          const rowObj: Record<string, string> = {};
          headers.forEach((header, idx) => {
            rowObj[header] = (rowData[idx] || '').trim();
          });
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
        const errorMsg = err instanceof Error ? err.message : '解析CSV失败';
        setError(errorMsg);
        reject(new Error(errorMsg));
      }
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
