/** 价格走势图中高亮标注的模式 */
export interface HighlightedPattern {
  /** 类型：当前模式或相似模式 */
  type: 'current' | 'similar';
  /** 起始日期字符串（CSV中的原始格式） */
  startDate: string;
  /** 结束日期字符串 */
  endDate: string;
  /** 显示标签 */
  label: string;
  /** 颜色 */
  color: string;
}

/** 坐标类型 */
export type ScaleType = 'linear' | 'log' | 'percent';
