import { NextRequest, NextResponse } from 'next/server';
import { fetchStockBasic, fetchFundFlowDays, fetchKlineHistory, normalizeCode } from '@/lib/astock';

const cache = new Map<string, { text: string; ts: number }>();
const CACHE_MS = 20 * 60 * 60 * 1000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await params;
  const code = normalizeCode(rawCode);

  const sp = req.nextUrl.searchParams;
  const shares = sp.get('shares') ? parseFloat(sp.get('shares')!) : undefined;
  const avgCost = sp.get('avgCost') ? parseFloat(sp.get('avgCost')!) : undefined;

  const cacheKey = `${code}_${shares ?? 0}_${avgCost ?? 0}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    return NextResponse.json({ text: cached.text, cached: true });
  }

  const [basicRes, flowRes, histRes] = await Promise.allSettled([
    fetchStockBasic(code),
    fetchFundFlowDays(code, 3),
    fetchKlineHistory(code, 20),
  ]);

  const basic = basicRes.status === 'fulfilled' ? basicRes.value : null;
  if (!basic) return NextResponse.json({ error: '无法获取股票数据' }, { status: 404 });

  const flows = flowRes.status === 'fulfilled' ? flowRes.value : [];
  const history = histRes.status === 'fulfilled' ? histRes.value : [];

  const closes = history.map(h => h.close);
  const ma5 = closes.length >= 5 ? closes.slice(-5).reduce((s, v) => s + v, 0) / 5 : null;
  const ma20 = closes.length >= 20 ? closes.slice(-20).reduce((s, v) => s + v, 0) / 20 : null;
  const maAlign =
    ma5 && ma20
      ? basic.price > ma5 && ma5 > ma20 ? '多头排列（短中期均线向上）'
        : basic.price < ma5 && ma5 < ma20 ? '空头排列（短中期均线向下）'
        : '均线混乱（方向不明）'
      : '数据不足';

  const total3d = flows.reduce((s, d) => s + d.mainNetInflow, 0);
  const fundSummary =
    total3d > 3000_0000 ? `近3日主力净流入 ${(total3d / 1e8).toFixed(2)} 亿，资金积极进场`
    : total3d < -3000_0000 ? `近3日主力净流出 ${(Math.abs(total3d) / 1e8).toFixed(2)} 亿，资金撤退`
    : '近3日主力资金无明显方向';

  const positionInfo =
    shares && avgCost
      ? `持仓 ${shares} 股，均价 ¥${avgCost}，当前浮盈亏 ${((basic.price - avgCost) / avgCost * 100).toFixed(2)}%`
      : '未持仓（观察中）';

  const systemPrompt = `你是一位A股权益研究分析师，为散户投资者出具简短中文研究简报。风格：简洁、直接、有判断，避免废话，不保证涨跌。`;

  const userPrompt = `请为以下A股出具研究简报。

## 标的信息
代码：${basic.code}  股票名称：${basic.name}
所属行业：${basic.industry}
当前价：¥${basic.price.toFixed(2)}（今日涨跌 ${basic.changePercent >= 0 ? '+' : ''}${basic.changePercent.toFixed(2)}%）
市值：${basic.marketCap >= 1e12 ? (basic.marketCap / 1e12).toFixed(1) + '万亿' : (basic.marketCap / 1e8).toFixed(0) + '亿'}
PE：${basic.pe != null ? basic.pe.toFixed(1) : 'N/A'} | PB：${basic.pb != null ? basic.pb.toFixed(2) : 'N/A'}
量比：${basic.volumeRatio.toFixed(2)} | 换手率：${basic.turnoverRate.toFixed(2)}%

## 资金与技术
${fundSummary}
均线状态：${maAlign}

## 我的持仓
${positionInfo}

---
请按以下结构输出（每项 1-2 句，总计不超过 350 字，用中文）：

**📊 核心逻辑**
（这只股票当前的核心投资逻辑）

**🚀 多头催化剂**
（2-3 个近期可能推动股价上涨的因素）

**⚠️ 主要风险**
（2 个最值得警惕的风险）

**📈 技术面判断**
（结合量比、换手率和均线，判断当前技术状态）

**💡 操作建议**
（基于持仓状况给出明确的持有/加仓/减仓建议，若未持仓说明是否值得关注）

**免责声明**：以上为 AI 辅助分析，不构成投资建议。`;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI 功能未配置' }, { status: 500 });

  try {
    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 800,
        temperature: 0.6,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    const json = await resp.json();
    const text: string = json.choices?.[0]?.message?.content ?? '';
    if (!text) throw new Error('empty response');

    cache.set(cacheKey, { text, ts: Date.now() });
    return NextResponse.json({ text, cached: false });
  } catch (e) {
    console.error('[AI]', e);
    return NextResponse.json({ error: 'AI 分析暂时不可用，请稍后重试' }, { status: 500 });
  }
}
