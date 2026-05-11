export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  columnCount: number;
  rowCount: number;
  detectedFormat: 'american' | 'chinese' | 'unknown';
  dateColumn?: string;
  closeColumn?: string;
}

export interface UploadedFile {
  file: File;
  type: 'csv' | 'image';
  data?: ParsedCSV;
  imageUrl?: string;
}
