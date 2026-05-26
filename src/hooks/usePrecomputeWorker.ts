import { useEffect, useRef, useState, useCallback } from 'react';
import type { PrecomputedData } from '@/utils/precompute';

// Vite 原生 Worker 导入：自动打包成独立 chunk
import PrecomputeWorkerURL from '@/workers/precompute.worker?worker';

export function usePrecomputeWorker() {
  const [computed, setComputed] = useState<PrecomputedData | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // 创建 Worker 实例（组件挂载时创建，卸载时销毁）
  useEffect(() => {
    const worker = new PrecomputeWorkerURL();

    worker.onmessage = (e: MessageEvent<PrecomputedData>) => {
      setComputed(e.data);
    };

    worker.onerror = (err) => {
      console.error('Precompute Worker 错误:', err);
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  /** 触发预计算。传 null 清空结果。 */
  const compute = useCallback(
    (data: {
      rows: Record<string, string>[];
      dateColumn: string;
      closeColumn: string;
    } | null) => {
      if (!data) {
        setComputed(null);
        return;
      }
      setComputed(null); // 先清空，显示 loading 状态
      workerRef.current?.postMessage(data);
    },
    [],
  );

  return { computed, compute };
}
