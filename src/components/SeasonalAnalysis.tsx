import type { ParsedCSV } from '@/types';

interface Props {
  data: ParsedCSV;
}

export default function SeasonalAnalysis({ data: _data }: Props) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
      <h3 className="text-white font-medium text-sm mb-2">传统金融数据的季节性分析</h3>
      <p className="text-slate-400 text-xs">请告诉我具体分析需求，我将立即实现</p>
      <p className="text-slate-500 text-xs mt-2">例如：月度收益率、星期效应、季度表现等</p>
    </div>
  );
}
