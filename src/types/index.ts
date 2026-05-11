export interface GanZhiInfo {
  yearPillar: string;
  monthPillar: string;
  dayPillar: string;
  yearAnimal: string;
  fullGanZhi: string;
}

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  columnCount: number;
  rowCount: number;
  detectedFormat: 'american' | 'chinese' | 'unknown';
  dateColumn?: string;
  closeColumn?: string;
  ganZhiMap?: Map<number, GanZhiInfo>;
}

export interface UploadedFile {
  file: File;
  type: 'csv' | 'image';
  data?: ParsedCSV;
  imageUrl?: string;
}
