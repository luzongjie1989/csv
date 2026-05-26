import { useState, useCallback, useRef, useMemo } from 'react';
import { BarChart3, Upload, Table2, ScrollText, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
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
import DrawdownAnalysis from '@/components/DrawdownAnalysis';
import { useCSVParser } from '@/hooks/useCSVParser';
import { computeGanZhiMaps, type GanZhiMaps } from '@/utils/gzCompute';
import type { UploadedFile } from '@/types';

type ViewTab = 'preview' | 'classical' | 'seasonal' | 'drawdown';

export default function App() {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { handleFileUpload } = useCSVParser();

  const onFileSelect = useCallback(async (file: File) => {
    setIsUploading(true);
    setGzMaps(null);
    setGzLoading(false);
    setGzProgress(null);
    try {
      const result = await handleFileUpload(file);
      setUploadedFile(result);
    } catch (err) {
      console.error('上传失败:', err);
      alert('文件处理失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setIsUploading(false);
    }
  }, [handleFileUpload]);

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

  // 干支/节气延迟计算状态
  const [gzMaps, setGzMaps] = useState<GanZhiMaps | null>(null);
  const [gzLoading, setGzLoading] = useState(false);
  const [gzProgress, setGzProgress] = useState<{ done: number; total: number } | null>(null);
  const gzComputingRef = useRef(false);

  // 开始延迟计算干支/节气
  const startGZComputation = useCallback(async () => {
    if (!uploadedFile?.data || gzMaps || gzComputingRef.current) return;
    gzComputingRef.current = true;
    setGzLoading(true);
    try {
      const maps = await computeGanZhiMaps(uploadedFile.data, (done, total) => {
        setGzProgress({ done, total });
      });
      setGzMaps(maps);
    } finally {
      setGzLoading(false);
      setGzProgress(null);
      gzComputingRef.current = false;
    }
  }, [uploadedFile?.data, gzMaps]);

  // 切换标签时触发延迟计算
  const handleSwitchTab = useCallback((tab: ViewTab) => {
    setViewTab(tab);
    if (tab === 'classical') {
      startGZComputation();
    }
  }, [startGZComputation]);

  // 清除时重置干支计算状态
  const handleClear = useCallback(() => {
    setUploadedFile(null);
    setGzMaps(null);
    setGzLoading(false);
    setGzProgress(null);
  }, []);

  // 增强的数据对象（包含计算好的干支/节气映射）
  const classicalData = useMemo(() => {
    if (!uploadedFile?.data) return undefined;
    if (!gzMaps) return uploadedFile.data;
    return {
      ...uploadedFile.data,
      ganZhiMap: gzMaps.ganZhiMap,
      solarTermMap: gzMaps.solarTermMap,
    };
  }, [uploadedFile?.data, gzMaps]);

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

                  {/* 价格走势图 */}
                  {isStockData && (
                    <CSVChart data={uploadedFile.data} />
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
                      onClick={() => handleSwitchTab('classical')}
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
                      onClick={() => setViewTab('drawdown')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        viewTab === 'drawdown'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 border border-transparent'
                      }`}
                    >
                      <TrendingDown className="w-4 h-4" />
                      历史回撤分析
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
                      {gzLoading && (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                          <p className="text-slate-400 text-sm">
                            正在计算干支/节气数据...
                            {gzProgress && (
                              <span className="ml-2 text-amber-400">
                                {gzProgress.done}/{gzProgress.total}
                              </span>
                            )}
                          </p>
                          <div className="w-64 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all duration-300"
                              style={{
                                width: gzProgress
                                  ? `${Math.round((gzProgress.done / gzProgress.total) * 100)}%`
                                  : '0%',
                              }}
                            />
                          </div>
                        </div>
                      )}
                      {!gzLoading && classicalData && (
                        <>
                          {isStockData && <PredictionPanel data={classicalData} />}
                          <StatisticsPanel data={classicalData} />
                          <GanZhiChart data={classicalData} />
                        </>
                      )}
                    </div>
                  )}

                  {/* 季节性分析标签页 */}
                  {viewTab === 'seasonal' && (
                    <div className="space-y-8">
                      <SeasonalAnalysis data={uploadedFile.data} />
                    </div>
                  )}

                  {/* 历史回撤分析标签页 */}
                  {viewTab === 'drawdown' && (
                    <div className="space-y-8">
                      <DrawdownAnalysis data={uploadedFile.data} />
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
