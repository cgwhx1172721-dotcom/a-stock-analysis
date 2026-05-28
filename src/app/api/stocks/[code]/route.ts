import { NextRequest, NextResponse } from 'next/server';
import { fetchStockBasic, fetchFundFlowDays, fetchKlineHistory, normalizeCode } from '@/lib/astock';
import { analyzeSector } from '@/lib/sectors';
import {
  analyzeFundFlow, analyzeVolume, getMomAdvice,
  analyzeLogic, analyzeFundamentals, analyzePosition, analyzeRisk,
} from '@/lib/analysis';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = normalizeCode(rawCode);
  const [basicRes, flowRes, histRes] = await Promise.allSettled([
    fetchStockBasic(code),
    fetchFundFlowDays(code, 5),
    fetchKlineHistory(code, 90),
  ]);
  const basic = basicRes.status === 'fulfilled' ? basicRes.value : null;
  const flowDays = flowRes.status === 'fulfilled' ? flowRes.value : [];
  const history = histRes.status === 'fulfilled' ? histRes.value : [];
  if (!basic) {
    return NextResponse.json({ error: `找不到股票代码 ${code}，请确认代码正确` }, { status: 404 });
  }
  const fund = analyzeFundFlow(flowDays);
  const volume = analyzeVolume(basic.volumeRatio, basic.turnoverRate);
  const sector = analyzeSector(basic.industry, basic.name);
  const momAdvice = getMomAdvice(fund.signal, volume.signal, sector.isHot);

  const closes = history.map(h => h.close);
  const ma20 = closes.length >= 20 ? closes.slice(-20).reduce((s,v)=>s+v,0)/20 : null;
  const ma60 = closes.length >= 60 ? closes.slice(-60).reduce((s,v)=>s+v,0)/60 : null;
  let rsi: number | null = null;
  if (closes.length >= 15) {
    const slice = closes.slice(-15);
    let gains = 0, losses = 0;
    for (let i = 1; i < slice.length; i++) {
      const d = slice[i] - slice[i-1];
      if (d > 0) gains += d; else losses -= d;
    }
    const avgG = gains / 14, avgL = losses / 14;
    rsi = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }

  const logic = analyzeLogic(sector.isHot, sector.theme, fund.signal, volume.signal, basic.changePercent);
  const fundamentals = analyzeFundamentals(basic.pe, basic.pb, basic.marketCap);
  const position = analyzePosition(basic.price, null, ma20, ma60, history);
  const risk = analyzeRisk(basic.price, basic.prevClose, basic.changePercent, rsi, fund.signal, ma20, ma60);

  return NextResponse.json({ basic, fund, volume, sector, momAdvice, logic, fundamentals, position, risk });
}
