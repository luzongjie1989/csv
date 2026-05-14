import { useState, useCallback } from 'react';
import { BarChart3, Upload, Table2, ScrollText, TrendingUp, GitCompare } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import UploadZone from '@/components/UploadZone';
import ImagePreview from '@/components/ImagePreview';
import DataCards from '@/components/DataCards';
import CSVTable from '@/components/CSVTable';
import CSVChart from '@/components/CSVChart';
import StatisticsPanel from '@/components/StatisticsPanel';
import GanZhiChart from '@/components/GanZhiChart';
import PredictionPanel from '@/components/PredictionPanel';
import SeasonalAnalysis from '@/components/SeasonalAnalysis';
import MatrixProfilePanel from '@/components/MatrixProfilePanel';
import { useCSVParser } from '@/hooks/useCSVParser';
import type { UploadedFile } from '@/types';
import type { HighlightedPattern } from '@/types/chart';

type ViewTab = 'preview' | 'classical' | 'seasonal' | 'matrixProfile';

export default function App() {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { handleFileUpload } = useCSVParser();

  // 价格走势图中高亮标注的模式（来自相似序列识别的联动）
  const [highlightedPatterns, setHighlightedPatterns] = useState<HighlightedPattern[]>([]);

  const onFileSelect = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const result = await handleFileUpload(file);
      setUploadedFile(result);
      setHighlightedPatterns([]); // 新文件清空标注
    } catch (err) {
      console.error('上传失败:', err);
      alert('文件处理失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setIsUploading(false);
    }
  }, [handleFileUpload]);

  const handleClear = useCallback(() => {
    setUploadedFile(null);
    setHighlightedPatterns([]);
  }, []);

  const handleHeaderUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.png,.jpg,.jpeg';
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        onFileSelect(files[0]);
      }
    };
    input.click();
  }, [onFileSelect]);

  const isStockData = uploadedFile?.data?.closeColumn != null;
  const [viewTab, setViewTab] = useState<ViewTab>('preview');

  return (
    <div className="min-h-[100dvh] bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
            </div>
            <h1 className="text-white font-semibold text-lg tracking-tight">
              数据分析与预览工具
            </h1>
          </div>
          <button
            onClick={handleHeaderUpload}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">上传文件</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Upload Zone */}
        <AnimatePresence mode="wait">
          {!uploadedFile && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <UploadZone onFileSelect={onFileSelect} />
              {isUploading && (
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center gap-2 text-cyan-400 text-sm">
                    <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    正在处理文件...
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview Content */}
        <AnimatePresence>
          {uploadedFile && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Image Preview */}
              {uploadedFile.type === 'image' && uploadedFile.imageUrl && (
                <ImagePreview
                  fileName={uploadedFile.file.name}
                  fileSize={uploadedFile.file.size}
                  imageUrl={uploadedFile.imageUrl}
                  onClear={handleClear}
                />
              )}

              {/* CSV Content */}
              {uploadedFile.type === 'csv' && uploadedFile.data && (
                <div className="space-y-6">
                  <DataCards data={uploadedFile.data} />

                  {/* 价格走势图 - 页面顶端独立模块（所有标签页可见） */}
                  {isStockData && (
                    <CSVChart
                      data={uploadedFile.data}
                      highlightedPatterns={highlightedPatterns}
                      onClearPatterns={() => setHighlightedPatterns([])}
                    />
                  )}

                  {/* Tab Switcher */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setViewTab('preview')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        viewTab === 'preview'
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 border border-transparent'
                      }`}
                    >
                      <Table2 className="w-4 h-4" />
                      数据预览
                    </button>
                    <button
                      onClick={() => setViewTab('classical')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        viewTab === 'classical'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 border border-transparent'
                      }`}
                    >
                      <ScrollText className="w-4 h-4" />
                      古典历法分析
                    </button>
                    <button
                      onClick={() => setViewTab('seasonal')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        viewTab === 'seasonal'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 border border-transparent'
                      }`}
                    >
                      <TrendingUp className="w-4 h-4" />
                      季节性分析
                    </button>
                    <button
                      onClick={() => setViewTab('matrixProfile')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        viewTab === 'matrixProfile'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 border border-transparent'
                      }`}
                    >
                      <GitCompare className="w-4 h-4" />
                      相似序列识别
                    </button>
                  </div>

                  {/* 数据预览标签页 */}
                  {viewTab === 'preview' && (
                    <div className="space-y-6">
                      <CSVTable data={uploadedFile.data} />
                    </div>
                  )}

                  {/* 古典历法分析标签页 */}
                  {viewTab === 'classical' && (
                    <div className="space-y-8">
                      {isStockData && <PredictionPanel data={uploadedFile.data} />}
                      <StatisticsPanel data={uploadedFile.data} />
                      <GanZhiChart data={uploadedFile.data} />
                    </div>
                  )}

                  {/* 季节性分析标签页 */}
                  {viewTab === 'seasonal' && (
                    <div className="space-y-8">
                      <SeasonalAnalysis data={uploadedFile.data} />
                    </div>
                  )}

                  {/* 相似序列识别标签页 */}
                  {viewTab === 'matrixProfile' && (
                    <div className="space-y-8">
                      <MatrixProfilePanel
                        data={uploadedFile.data}
                        onHighlightPatterns={setHighlightedPatterns}
                      />
                    </div>
                  )}

                  {/* Upload another file */}
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={handleClear}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-400 text-sm font-medium transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      上传其他文件
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
