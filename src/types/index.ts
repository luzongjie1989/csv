export interface GanZhiInfo {
  yearPillar: string;
  monthPillar: string;
  dayPillar: string;
  yearAnimal: string;
  fullGanZhi: string;
}

export interface SolarTermInfo {
  name: string;
  year: number;
  month: number;
  day: number;
  dateStr: string;
  isJie: boolean;
  isQi: boolean;
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
  solarTermMap?: Map<number, SolarTermInfo>;
}

export interface UploadedFile {
  file: File;
  type: 'csv' | 'image';
  data?: ParsedCSV;
  imageUrl?: string;
}
