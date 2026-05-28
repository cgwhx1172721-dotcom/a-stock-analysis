import type { FundFlowDay } from './astock';

export type Signal = 'good' | 'neutral' | 'bad';

export interface FundAnalysis {
  signal: Signal;
  title: string;
  summary: string;
  dailyLines: string[];
  total3d: number;
}

export interface VolumeAnalysis {
  signal: Signal;
  title: string;
  summary: string;
  details: string[];
}

export interface MomAdvice {
  text: string;
  emoji: string;
  colorClass: string;
}

function fmt(yuan: number): string {
  const abs = Math.abs(yuan);
  const sign = yuan >= 0 ? '+' : '-';
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}亿`;
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(0)}万`;
  return `${sign}${abs.toFixed(0)}元`;
}

export function analyzeFundFlow(days: FundFlowDay[]): FundAnalysis {
  if (!days.length) {
    return { signal: 'neutral', title: '暂无数据', summary: '未能获取资金流向数据，请稍后再试', dailyLines: [], total3d: 0 };
  }

  const recent = days.slice(-3);
  const total3d = recent.reduce((s, d) => s + d.mainNetInflow, 0);
  const posCount = recent.filter(d => d.mainNetInflow > 0).length;
  const todayInflow = days[days.length - 1]?.mainNetInflow ?? 0;
  const dailyLines = recent.map(d => `${d.date.slice(5)}  主力 ${fmt(d.mainNetInflow)}`);

  if (posCount >= 2 && total3d > 3000_0000) {
    return { signal: 'good', title: '主力积极买入 🟢', dailyLines, total3d,
      summary: `近3天主力合计净流入 ${fmt(total3d)}，资金持续进场，有主力介入迹象，信号较强。` };
  }
  if (posCount >= 2 || todayInflow > 0) {
    return { signal: 'neutral', title: '主力小幅参与 🟡', dailyLines, total3d,
      summary: `近3天资金有进有出，主力态度不明朗。可以继续观察，暂不着急买入。` };
  }
  return { signal: 'bad', title: '主力在离场 🔴', dailyLines, total3d,
    summary: `近3天主力净流出 ${fmt(Math.abs(total3d))}，资金在撤退，暂时不建议买入。` };
}

export function analyzeVolume(volumeRatio: number, turnoverRate: number): VolumeAnalysis {
  const details = [
    `量比 ${volumeRatio.toFixed(2)}（大于1表示今天比平时活跃）`,
    `换手率 ${turnoverRate.toFixed(2)}%（越高代表交投越活跃）`,
  ];

  if (volumeRatio >= 1.5 && turnoverRate >= 2) {
    return { signal: 'good', title: '量能充足 🟢', details,
      summary: `量比 ${volumeRatio.toFixed(1)}，换手 ${turnoverRate.toFixed(1)}%，今日成交活跃，有资金积极参与，量价配合较好。` };
  }
  if (volumeRatio >= 0.8) {
    return { signal: 'neutral', title: '量能正常 🟡', details,
      summary: `量比 ${volumeRatio.toFixed(1)}，换手 ${turnoverRate.toFixed(1)}%，交投正常，暂无明显放量信号，继续观察。` };
  }
  return { signal: 'bad', title: '量能萎缩 🔴', details,
    summary: `量比 ${volumeRatio.toFixed(1)}，换手 ${turnoverRate.toFixed(1)}%，成交偏冷清，市场参与度低，不是好的买入时机。` };
}

export function getMomAdvice(fund: Signal, volume: Signal, hotSector: boolean): MomAdvice {
  const score =
    (fund === 'good' ? 2 : fund === 'neutral' ? 1 : 0) +
    (volume === 'good' ? 2 : volume === 'neutral' ? 1 : 0) +
    (hotSector ? 2 : 0);

  if (score >= 5) {
    return { emoji: '✅', colorClass: 'text-emerald-400',
      text: '三个条件基本都满足，可以重点关注。买入前记得看大盘整体走势，不要在大盘下跌时逆势操作。' };
  }
  if (score >= 3) {
    return { emoji: '🟡', colorClass: 'text-amber-400',
      text: '部分条件满足，可以加入自选继续观察。等主力信号更明确、量能放大时再考虑买入，不用着急。' };
  }
  return { emoji: '⏸️', colorClass: 'text-rose-400',
    text: '当前条件不太理想，主力未明显介入或量能不足。建议暂时观望，把钱留着等更好的机会。' };
}
