import { NextRequest, NextResponse } from 'next/server';
import { fetchStockBasic, fetchFundFlowDays, normalizeCode } from '@/lib/astock';
import { analyzeSector } from '@/lib/sectors';
import { analyzeFundFlow, analyzeVolume, getMomAdvice } from '@/lib/analysis';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = normalizeCode(rawCode);
  const [basicRes, flowRes] = await Promise.allSettled([
    fetchStockBasic(code),
    fetchFundFlowDays(code, 5),
  ]);
  const basic = basicRes.status === 'fulfilled' ? basicRes.value : null;
  const flowDays = flowRes.status === 'fulfilled' ? flowRes.value : [];
  if (!basic) {
    return NextResponse.json({ error: `找不到股票代码 ${code}，请确认代码正确` }, { status: 404 });
  }
  const fund = analyzeFundFlow(flowDays);
  const volume = analyzeVolume(basic.volumeRatio, basic.turnoverRate);
  const sector = analyzeSector(basic.industry, basic.name);
  const momAdvice = getMomAdvice(fund.signal, volume.signal, sector.isHot);
  return NextResponse.json({ basic, fund, volume, sector, momAdvice });
}
