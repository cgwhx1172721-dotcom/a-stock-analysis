import { NextRequest, NextResponse } from 'next/server';
import { fetchKlineHistory, normalizeCode } from '@/lib/astock';

function calcMA(closes: number[], n: number): number | null {
  if (closes.length < n) return null;
  const slice = closes.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / n;
}

function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const rs = gains / (losses || 0.001);
  return 100 - 100 / (1 + rs);
}

function calcEMA(closes: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema = [closes[0]];
  for (let i = 1; i < closes.length; i++) ema.push(closes[i] * k + ema[i - 1] * (1 - k));
  return ema;
}

function calcMACD(closes: number[]) {
  if (closes.length < 26) return { macd: null, signal: null, histogram: null };
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const dif = ema12.map((v, i) => v - ema26[i]);
  const dea = calcEMA(dif, 9);
  const last = dif.length - 1;
  return { macd: dif[last] - dea[last], signal: dea[last], histogram: (dif[last] - dea[last]) * 2 };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const history = await fetchKlineHistory(normalizeCode(code), 120);
  if (!history.length) return NextResponse.json({ data: null });

  const closes = history.map(h => h.close);
  const ma5 = calcMA(closes, 5);
  const ma20 = calcMA(closes, 20);
  const ma60 = calcMA(closes, 60);
  const rsi = calcRSI(closes);
  const macd = calcMACD(closes);
  const current = closes[closes.length - 1];

  const signals: string[] = [];
  if (ma5 && ma20 && ma60) {
    if (current > ma5 && ma5 > ma20 && ma20 > ma60) signals.push('均线多头排列，趋势向上');
    else if (current < ma5 && ma5 < ma20 && ma20 < ma60) signals.push('均线空头排列，趋势向下');
    else if (current > ma20) signals.push('价格站稳20日均线，中期偏多');
    else signals.push('价格低于20日均线，注意风险');
  }
  if (macd.macd !== null) {
    if (macd.macd > 0) signals.push('MACD 在零轴上方，多头区间');
    else signals.push('MACD 在零轴下方，空头区间');
  }
  if (rsi !== null) {
    if (rsi >= 70) signals.push(`RSI ${rsi.toFixed(0)}，短期超买，注意回调`);
    else if (rsi <= 30) signals.push(`RSI ${rsi.toFixed(0)}，超卖区间，可能有反弹`);
    else signals.push(`RSI ${rsi.toFixed(0)}，处于中性区域`);
  }

  return NextResponse.json({ data: { ma5, ma20, ma60, rsi, macd, signals } });
}
