import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import * as jschardet from 'jschardet';
import type { ParsedCSV, UploadedFile } from '@/types';
import { solarToGanZhi } from '@/utils/lunarCalendar';

/**
 * Detect delimiter by analyzing the first few non-empty lines
 */
function detectDelimiter(text: string): string {
  const lines = text.split('\n').filter(l => l.trim() !== '');
  const firstLine = lines[0] || '';
  
  // Check for pipe delimiter first (Chinese format: | 日期 | 开盘 | ...)
  if (firstLine.includes('|')) {
    // Count pipes
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
  // Match "close", "收盘", or standalone "收" (simplified Chinese column name)
  return headers.find(h => {
    const lower = h.toLowerCase();
    return lower === 'close' || lower === '收盘' || lower === '收';
  });
}

function detectFormat(headers: string[]): 'american' | 'chinese' | 'unknown' {
  const headerStr = headers.join(' ').toLowerCase();
  // American format: DATE, Open, High, Low, Close
  if (headerStr.includes('date') && headerStr.includes('open') && headerStr.includes('close')) {
    return 'american';
  }
  // Chinese format (full): 日期, 开盘, 最高, 最低, 收盘
  if (headerStr.includes('日期') && headerStr.includes('开盘') && headerStr.includes('收盘')) {
    return 'chinese';
  }
  // Chinese format (simplified): 时间/日期, 开, 高, 低, 收
  // e.g. 重庆啤酒.csv: 时间,开,高,低,收,成交量,成交额,涨跌...
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

/**
 * Read a File as ArrayBuffer
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Detect file encoding using jschardet.
 * Handles common Chinese encodings: GBK, GB2312, GB18030, Big5, UTF-8, etc.
 */
function detectEncoding(buffer: ArrayBuffer): string {
  // Create a Uint8Array for jschardet to analyze
  const uint8Array = new Uint8Array(buffer);
  
  // Only analyze first 50KB for performance
  const sampleSize = Math.min(uint8Array.length, 50 * 1024);
  const sample = uint8Array.slice(0, sampleSize);
  
  // Convert sample to binary string for jschardet
  let binaryString = '';
  for (let i = 0; i < sample.length; i++) {
    binaryString += String.fromCharCode(sample[i]);
  }
  
  const result = jschardet.detect(binaryString);
  const detected = result.encoding?.toLowerCase() || 'utf-8';
  
  // Map common encoding aliases to TextDecoder compatible names
  const encodingMap: Record<string, string> = {
    'gb2312': 'gbk',
    'gb18030': 'gbk',
    'gbk': 'gbk',
    'big5': 'big5',
    'euc-jp': 'euc-jp',
    'shift_jis': 'shift_jis',
    'euc-kr': 'euc-kr',
    'iso-8859-1': 'iso-8859-1',
    'windows-1252': 'windows-1252',
    'ascii': 'utf-8',
  };
  
  return encodingMap[detected] || detected;
}

/**
 * Decode ArrayBuffer to string using detected encoding
 */
function decodeBuffer(buffer: ArrayBuffer, encoding: string): string {
  try {
    const decoder = new TextDecoder(encoding, { fatal: false });
    return decoder.decode(buffer);
  } catch {
    // Fallback to UTF-8
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  }
}

/**
 * Detect and decode file content, handling GBK/GB2312 Chinese encodings
 */
async function readFileWithEncoding(file: File): Promise<string> {
  const buffer = await readFileAsArrayBuffer(file);
  const encoding = detectEncoding(buffer);
  console.log(`[Encoding] Detected: ${encoding}, confidence: file=${file.name}`);
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
        // Step 1: Read file with automatic encoding detection
        const text = await readFileWithEncoding(file);
        
        // Step 2: Detect delimiter
        const delimiter = detectDelimiter(text);
        
        // Step 3: Split into lines for manual header/data processing
        const allLines = text.split('\n').map(l => l.trimEnd());
        
        // Step 4: Filter out empty rows and comments, find header
        const nonEmptyLines = allLines.filter(line => line.trim() !== '');
        
        let headerIndex = 0;
        let headers: string[] = [];
        
        for (let i = 0; i < nonEmptyLines.length; i++) {
          const line = nonEmptyLines[i];
          
          // Skip comment lines (starting with //)
          if (isCommentLine(line)) {
            headerIndex = i + 1;
            continue;
          }
          
          // Skip separator lines (markdown table format: | --- | --- |)
          if (isSeparatorLine(line)) {
            headerIndex = i + 1;
            continue;
          }
          
          // Check if this row looks like a header
          const lineLower = line.toLowerCase();
          if (/date|日期|open|开盘|close|收盘|high|最高|low|最低|volume|成交量/i.test(lineLower)) {
            // Parse this line as header
            const headerResult = Papa.parse<string[]>(line, { 
              delimiter,
              skipEmptyLines: true 
            });
            if (headerResult.data.length > 0) {
              headers = headerResult.data[0].map(h => cleanHeader(h).trim()).filter(h => h !== '');
              headerIndex = i;
              break;
            }
          }
          
          // If we haven't found a header yet and we're within first 5 rows, use current row
          if (headers.length === 0 && i < 5) {
            const headerResult = Papa.parse<string[]>(line, { 
              delimiter,
              skipEmptyLines: true 
            });
            if (headerResult.data.length > 0) {
              headers = headerResult.data[0].map(h => cleanHeader(h).trim()).filter(h => h !== '');
              headerIndex = i;
              break;
            }
          }
        }
        
        if (headers.length === 0) {
          throw new Error('无法识别CSV表头，请检查文件格式');
        }
        
        // Step 5: Parse data rows
        const rows: Record<string, string>[] = [];
        for (let i = headerIndex + 1; i < nonEmptyLines.length; i++) {
          const line = nonEmptyLines[i];
          
          // Skip comments and separators
          if (isCommentLine(line) || isSeparatorLine(line)) continue;
          
          const parseResult = Papa.parse<string[]>(line, { 
            delimiter,
            skipEmptyLines: true 
          });
          
          if (parseResult.data.length === 0) continue;
          
          const rowData = parseResult.data[0];
          const rowObj: Record<string, string> = {};
          
          headers.forEach((header, idx) => {
            rowObj[header] = (rowData[idx] || '').trim();
          });
          
          // Skip completely empty rows
          if (Object.values(rowObj).some(v => v !== '')) {
            rows.push(rowObj);
          }
        }
        
        const detectedFormat = detectFormat(headers);
        const dateColumn = detectDateColumn(headers);
        const closeColumn = detectCloseColumn(headers);

        // 干支转换：对日期列的每个值进行转换
        const ganZhiMap = new Map<number, import('@/types').GanZhiInfo>();
        if (dateColumn) {
          rows.forEach((row, idx) => {
            const dateValue = row[dateColumn];
            if (dateValue) {
              const gz = solarToGanZhi(dateValue);
              if (gz) ganZhiMap.set(idx, gz);
            }
          });
        }

        const parsed: ParsedCSV = {
          headers,
          rows,
          columnCount: headers.length,
          rowCount: rows.length,
          detectedFormat,
          dateColumn,
          closeColumn,
          ganZhiMap: ganZhiMap.size > 0 ? ganZhiMap : undefined,
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
