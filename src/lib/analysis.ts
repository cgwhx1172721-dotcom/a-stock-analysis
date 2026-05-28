import type { FundFlowDay, KlinePoint } from './astock';

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

export interface LogicAnalysis {
  signal: Signal;
  title: string;
  summary: string;
  bullets: string[];
}

export interface FundamentalsAnalysis {
  signal: Signal;
  title: string;
  summary: string;
  details: string[];
}

export interface PositionAnalysis {
  signal: Signal;
  title: string;
  summary: string;
  positionPct: number;
  details: string[];
}

export interface RiskAnalysis {
  signal: Signal;
  title: string;
  summary: string;
  risks: string[];
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

// ─── 新增：逻辑面 ─────────────────────────────────
export function analyzeLogic(
  hotSector: boolean,
  theme: string | null,
  fundSignal: Signal,
  volumeSignal: Signal,
  changePercent: number,
): LogicAnalysis {
  const bullets: string[] = [];
  let score = 0;

  if (hotSector && theme) {
    bullets.push(`🔥 属于「${theme}」热门赛道，市场资金关注度高`);
    score += 2;
  } else {
    bullets.push('❄️ 非热门赛道，行情主要依赖个股基本面和市场情绪');
  }

  if (fundSignal === 'good') {
    bullets.push('💰 主力资金连续净流入，有机构或大资金建仓迹象');
    score += 2;
  } else if (fundSignal === 'neutral') {
    bullets.push('👀 主力资金小幅参与，尚未形成明确方向');
    score += 1;
  } else {
    bullets.push('🚪 主力资金持续流出，当前缺乏资金推动');
  }

  if (volumeSignal === 'good') {
    bullets.push('📊 量价配合良好，上涨有成交量支撑，动能充足');
    score += 1;
  } else if (volumeSignal === 'neutral') {
    bullets.push('📊 成交量正常，暂无明显量价异动');
  } else {
    bullets.push('📉 成交量萎缩，上涨缺乏量能支撑，需谨慎');
  }

  if (Math.abs(changePercent) > 5) {
    bullets.push(`⚡ 今日波动较大（${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%），可能有消息面驱动`);
  }

  if (score >= 4) {
    return { signal: 'good', title: '逻辑清晰，多重信号共振', summary: '赛道热度、资金面、量能三重共振，当前具备较明确的上涨逻辑，可重点关注。', bullets };
  }
  if (score >= 2) {
    return { signal: 'neutral', title: '逻辑一般，信号待确认', summary: '部分正面信号但尚未形成共振，投资逻辑有一定支撑但需要更多确认，建议观察等待。', bullets };
  }
  return { signal: 'bad', title: '逻辑薄弱，缺乏驱动', summary: '当前缺乏明确上涨逻辑，赛道冷、资金撤、量能弱，建议暂时回避，等待机会。', bullets };
}

// ─── 新增：基本面 ─────────────────────────────────
export function analyzeFundamentals(
  pe: number | null,
  pb: number | null,
  marketCap: number,
): FundamentalsAnalysis {
  const details: string[] = [];
  let score = 0;

  // 市值规模
  const capLabel = marketCap >= 5e11 ? '超大盘（>500亿，相对稳健）'
    : marketCap >= 5e10 ? '中大盘（50-500亿，弹性适中）'
    : '小盘股（<50亿，弹性大但风险高）';
  details.push(`📏 市值：${capLabel}`);
  if (marketCap >= 5e10) score += 1;

  // 市盈率
  if (pe !== null && pe > 0) {
    const peLabel = pe < 15 ? '低估值区间，安全边际较高' : pe < 30 ? '估值合理，性价比尚可' : pe < 60 ? '成长溢价，需要业绩持续兑现' : '估值偏高，风险较大';
    details.push(`💹 市盈率(PE)：${pe.toFixed(1)} — ${peLabel}`);
    if (pe < 30) score += 2;
    else if (pe < 60) score += 1;
  } else if (pe !== null && pe < 0) {
    details.push('💹 市盈率(PE)：负值 — 当前处于亏损状态，注意业绩风险');
  } else {
    details.push('💹 市盈率(PE)：暂无数据');
    score += 1;
  }

  // 市净率
  if (pb !== null && pb > 0) {
    const pbLabel = pb < 1 ? '破净股，资产价值被低估（注意行业是否有结构性问题）' : pb < 3 ? '市净率合理' : '市净率偏高，溢价明显';
    details.push(`🏦 市净率(PB)：${pb.toFixed(2)} — ${pbLabel}`);
    if (pb >= 1 && pb < 3) score += 1;
  } else {
    details.push('🏦 市净率(PB)：暂无数据');
  }

  if (score >= 3) {
    return { signal: 'good', title: '基本面扎实 🟢', summary: '估值合理、市值适中，基本面具备一定投资价值。', details };
  }
  if (score >= 1) {
    return { signal: 'neutral', title: '基本面中性 🟡', summary: '基本面数据一般，估值不算极端，但也缺乏明显吸引力，结合其他因素综合判断。', details };
  }
  return { signal: 'bad', title: '基本面偏弱 🔴', summary: '估值偏高或存在亏损，基本面支撑不足，追高风险较大，建议谨慎。', details };
}

// ─── 新增：位置面 ─────────────────────────────────
export function analyzePosition(
  price: number,
  ma5: number | null,
  ma20: number | null,
  ma60: number | null,
  history: KlinePoint[],
): PositionAnalysis {
  const details: string[] = [];

  // 计算近期高低点（使用全部历史数据）
  const highs = history.map(h => h.high);
  const lows = history.map(h => h.low);
  const recentHigh = highs.length ? Math.max(...highs) : price;
  const recentLow = lows.length ? Math.min(...lows) : price;
  const range = recentHigh - recentLow;
  const positionPct = range > 0 ? Math.round(((price - recentLow) / range) * 100) : 50;

  details.push(`📍 近90日区间：${recentLow.toFixed(2)} — ${recentHigh.toFixed(2)}`);
  details.push(`📐 当前位置：处于近期区间的 ${positionPct}% 处`);

  // 均线位置
  if (ma5 && ma20 && ma60) {
    const aboveMa5 = price > ma5;
    const aboveMa20 = price > ma20;
    const aboveMa60 = price > ma60;
    const maStatus = [aboveMa5 && '站上MA5', aboveMa20 && '站上MA20', aboveMa60 && '站上MA60'].filter(Boolean);
    const maBelowStatus = [!aboveMa5 && '跌破MA5', !aboveMa20 && '跌破MA20', !aboveMa60 && '跌破MA60'].filter(Boolean);
    if (maStatus.length) details.push(`✅ 均线：${maStatus.join('、')}`);
    if (maBelowStatus.length) details.push(`⚠️ 均线：${maBelowStatus.join('、')}`);
  }

  let signal: Signal;
  let title: string;
  let summary: string;

  if (positionPct >= 80) {
    signal = 'bad';
    title = '高位区间，注意压力';
    summary = `当前价格处于近90日高位区间（${positionPct}%），追高风险较大。如已持有可考虑分批止盈，未持有建议等待回调后再介入。`;
  } else if (positionPct >= 50) {
    signal = 'neutral';
    title = '中部整理区间';
    summary = `价格处于近90日中上部（${positionPct}%），区间不高不低，适合观察均线支撑是否有效。突破前高则可能开启新一轮上涨。`;
  } else if (positionPct >= 20) {
    signal = 'neutral';
    title = '中低位寻找支撑';
    summary = `价格处于近90日中下部（${positionPct}%），有一定安全边际，但需确认是否已止跌企稳。结合量能和均线判断反弹时机。`;
  } else {
    signal = 'good';
    title = '低位区间，关注企稳信号';
    summary = `价格处于近90日低位区间（${positionPct}%），已有较大回撤。若出现放量止跌、主力资金回流，可能是较好的介入时机。`;
  }

  return { signal, title, summary, positionPct, details };
}

// ─── 新增：风险面 ─────────────────────────────────
export function analyzeRisk(
  price: number,
  prevClose: number,
  changePercent: number,
  rsi: number | null,
  fundSignal: Signal,
  ma20: number | null,
  ma60: number | null,
): RiskAnalysis {
  const risks: string[] = [];
  let riskScore = 0;

  // 涨停追高风险
  const limitUp = Math.round(prevClose * 1.1 * 100) / 100;
  const distToLimitUp = ((limitUp - price) / price) * 100;
  if (distToLimitUp < 2) {
    risks.push('🚨 价格接近涨停板，追高风险极大，等待回落再看');
    riskScore += 3;
  } else if (changePercent > 5) {
    risks.push(`⚠️ 今日已涨 ${changePercent.toFixed(1)}%，短期涨幅较大，注意回调风险`);
    riskScore += 1;
  }

  // RSI 超买风险
  if (rsi !== null) {
    if (rsi >= 80) {
      risks.push(`🔥 RSI=${rsi.toFixed(0)}，严重超买，技术上回调压力很大`);
      riskScore += 2;
    } else if (rsi >= 70) {
      risks.push(`⚡ RSI=${rsi.toFixed(0)}，进入超买区，短期有回调风险`);
      riskScore += 1;
    }
  }

  // 主力撤退风险
  if (fundSignal === 'bad') {
    risks.push('💸 主力资金持续流出，机构在撤退，拉升动力不足');
    riskScore += 2;
  }

  // 均线下方风险
  if (ma20 && price < ma20) {
    risks.push(`📉 价格跌破 MA20（${ma20.toFixed(2)}），短期趋势偏空`);
    riskScore += 1;
  }
  if (ma60 && price < ma60) {
    risks.push(`📉 价格跌破 MA60（${ma60.toFixed(2)}），中期趋势转弱`);
    riskScore += 1;
  }

  // 止损参考
  const stopLoss = Math.round(prevClose * 0.9 * 100) / 100;
  risks.push(`🛡️ 参考止损价：${stopLoss.toFixed(2)}（跌停价），不建议持仓跌破此位`);

  if (riskScore === 0) {
    return { signal: 'good', title: '风险可控 🟢', summary: '当前无明显技术风险信号，RSI未超买、主力未撤退、均线支撑有效，可正常持仓。', risks };
  }
  if (riskScore <= 2) {
    return { signal: 'neutral', title: '存在一定风险 🟡', summary: '有部分风险信号，建议控制仓位，不要重仓追高，做好止损准备。', risks };
  }
  return { signal: 'bad', title: '风险较高，需谨慎 🔴', summary: '多项风险信号叠加，当前追入风险较大。建议观望或轻仓，严格执行止损纪律。', risks };
}
