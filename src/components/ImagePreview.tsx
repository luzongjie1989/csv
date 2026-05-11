import { X, Image, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface ImagePreviewProps {
  fileName: string;
  fileSize: number;
  imageUrl: string;
  onClear: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export default function ImagePreview({ fileName, fileSize, imageUrl, onClear }: ImagePreviewProps) {
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Image className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-white font-medium text-sm">{fileName}</h3>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <FileText className="w-3 h-3" />
              <span>{formatFileSize(fileSize)}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onClear}
          className="w-8 h-8 rounded-lg bg-slate-700/50 hover:bg-red-500/20 flex items-center justify-center transition-colors group"
        >
          <X className="w-4 h-4 text-slate-400 group-hover:text-red-400 transition-colors" />
        </button>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg overflow-hidden bg-slate-900/50 flex items-center justify-center max-h-[500px]">
          <img
            src={imageUrl}
            alt={fileName}
            className="max-w-full max-h-[500px] object-contain"
          />
        </div>
      </CardContent>
    </Card>
  );
}
