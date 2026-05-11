import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
}

export default function UploadZone({ onFileSelect }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFileSelect(files[0]);
    }
  }, [onFileSelect]);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  }, [onFileSelect]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={cn(
        'border-2 border-dashed rounded-xl p-12 cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-4 text-center',
        isDragOver
          ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
          : 'border-slate-600 hover:border-cyan-500 hover:bg-slate-800/50'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.png,.jpg,.jpeg"
        onChange={handleFileChange}
        className="hidden"
      />
      <div
        className={cn(
          'w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300',
          isDragOver ? 'bg-cyan-500/20' : 'bg-slate-700/50'
        )}
      >
        <Upload
          className={cn(
            'w-8 h-8 transition-colors duration-300',
            isDragOver ? 'text-cyan-400' : 'text-slate-400'
          )}
        />
      </div>
      <div>
        <p className="text-lg font-medium text-white">
          拖拽文件到此处，或点击浏览
        </p>
        <p className="text-sm text-slate-400 mt-2">
          支持 CSV 数据文件 (.csv) 和图片文件 (.png, .jpg, .jpeg)
        </p>
      </div>
    </div>
  );
}
