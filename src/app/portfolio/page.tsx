'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Holding { code: string; name: string; shares: number; avgCost: number; }
interface StockPrice { price: number; name: string; changePercent: number; signal: 'good' | 'neutral' | 'bad'; fundTitle: string; }

const fmt2 = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function PortfolioPage() {
  const router = useRouter();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [prices, setPrices] = useState<Record<string, StockPrice>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newShares, setNewShares] = useState('');
  const [newCost, setNewCost] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    try {
      const list: Holding[] = JSON.parse(localStorage.getItem('portfolio_list') || '[]');
      setHoldings(list);
    } catch { /* ignore */ }
  }, []);

  const persist = (list: Holding[]) => {
    setHoldings(list);
    localStorage.setItem('portfolio_list', JSON.stringify(list));
  };

  const fetchPrices = useCallback(async (list: Holding[]) => {
    if (!list.length) return;
    setLoading(true);
    const results = await Promise.allSettled(
      list.map(async (h) => {
        const r = await fetch(`/api/stocks/${h.code}`);
        const json = await r.json();
        if (json.error) return { code: h.code, price: h.avgCost, name: h.name, changePercent: 0, signal: 'neutral' as const, fundTitle: '' };
        const cc: string = json.momAdvice?.colorClass || '';
        const signal: 'good' | 'neutral' | 'bad' =
          cc.includes('orange') ? 'good' : cc.includes('rose') ? 'bad' : 'neutral';
        return {
          code: h.code,
          price: json.basic?.price || h.avgCost,
          name: json.basic?.name || h.name,
          changePercent: json.basic?.changePercent || 0,
          signal,
          fundTitle: json.fund?.title || '',
        };
      })
    );
    const map: Record<string, StockPrice> = {};
    results.forEach(r => { if (r.status === 'fulfilled') map[r.value.code] = r.value; });
    setPrices(map);
    setLoading(false);
    setLastUpdated(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
  }, []);

  useEffect(() => {
    if (holdings.length) fetchPrices(holdings);
  }, [holdings, fetchPrices]);

  const addHolding = async () => {
    setAddError('');
    const code = newCode.replace(/\D/g, '').padStart(6, '0');
    const shares = Math.round(Math.abs(parseFloat(newShares)));
    const avgCost = parseFloat(newCost);
    if (code.length < 5 || !shares || !avgCost || avgCost <= 0) {
      setAddError('请填写完整的股票代码、股数和均价');
      return;
    }
    setAdding(true);
    try {
      const r = await fetch(`/api/stocks/${code}`);
      const json = await r.json();
      if (json.error) { setAddError('找不到该股票，请确认代码正确'); setAdding(false); return; }
      const finalCode = json.basic?.code || code;
      const name = json.basic?.name || code;
      const newH: Holding = { code: finalCode, name, shares, avgCost };
      const next = [...holdings.filter(h => h.code !== finalCode), newH];
      persist(next);
      localStorage.setItem(`holdings_${finalCode}`, JSON.stringify({ shares, avgCost }));
      setNewCode(''); setNewShares(''); setNewCost('');
      setShowForm(false);
    } catch { setAddError('网络错误，请重试'); }
    finally { setAdding(false); }
  };

  const removeHolding = (code: string) => {
    persist(holdings.filter(h => h.code !== code));
    localStorage.removeItem(`holdings_${code}`);
    setPrices(prev => { const n = { ...prev }; delete n[code]; return n; });
  };

  const totalCost = holdings.reduce((s, h) => s + h.shares * h.avgCost, 0);
  const totalValue = holdings.reduce((s, h) => s + h.shares * (prices[h.code]?.price ?? h.avgCost), 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const hasPrices = Object.keys(prices).length > 0;

  return (
    <main className="min-h-screen bg-[#F2F2F7] pt-4 pb-28 px-4">
      <div className="max-w-2xl mx-auto space-y-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#1A1A1E]">持仓</h1>
            {lastUpdated && <p className="text-xs text-[#9A9A9E] mt-0.5">更新于 {lastUpdated}</p>}
          </div>
          <div className="flex gap-2">
            {holdings.length > 0 && (
              <button onClick={() => fetchPrices(holdings)} disabled={loading}
                className="rounded-xl border border-[#E5E5EA] bg-white px-3 py-1.5 text-xs text-[#4A4A4E] font-medium disabled:opacity-50">
                {loading ? '刷新中…' : '刷新'}
              </button>
            )}
            <button onClick={() => { setShowForm(!showForm); setAddError(''); }}
              className="rounded-xl bg-orange-500 px-3 py-1.5 text-xs text-white font-semibold shadow-sm shadow-orange-200">
              + 加入持仓
            </button>
          </div>
        </div>

        {/* Add form */}
        {showForm && (
          <section className="rounded-2xl border border-orange-200 bg-orange-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-[#1A1A1E]">新增持仓</p>
            <input value={newCode} onChange={e => setNewCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="股票代码（6位，如 600519）" inputMode="numeric"
              className="w-full rounded-xl border border-[#E5E5EA] bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all" />
            <input value={newShares} onChange={e => setNewShares(e.target.value.replace(/\D/g, ''))}
              placeholder="持仓股数（如 1000）" inputMode="numeric"
              className="w-full rounded-xl border border-[#E5E5EA] bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all" />
            <input value={newCost} onChange={e => setNewCost(e.target.value)}
              placeholder="持仓均价（元，如 12.50）" inputMode="decimal"
              className="w-full rounded-xl border border-[#E5E5EA] bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all" />
            {addError && <p className="text-xs text-rose-500">{addError}</p>}
            <div className="flex gap-2">
              <button onClick={addHolding} disabled={adding}
                className="flex-1 rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
                {adding ? '查询中…' : '确认添加'}
              </button>
              <button onClick={() => { setShowForm(false); setAddError(''); }}
                className="rounded-xl border border-[#E5E5EA] bg-white px-4 py-2.5 text-sm text-[#4A4A4E]">
                取消
              </button>
            </div>
          </section>
        )}

        {/* Summary */}
        {holdings.length > 0 && hasPrices && (
          <section className="rounded-2xl border border-[#E5E5EA] bg-white p-4 shadow-sm">
            <p className="text-xs text-[#9A9A9E] uppercase tracking-wider mb-1">总资产估值</p>
            <p className="text-2xl font-bold text-[#1A1A1E]">¥{fmt0(totalValue)}</p>
            <div className="flex items-center gap-3 mt-1">
              <p className={`text-sm font-semibold ${totalPnl >= 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                {totalPnl >= 0 ? '+' : ''}¥{fmt0(totalPnl)} ({totalPnl >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%)
              </p>
              <p className="text-xs text-[#9A9A9E]">成本 ¥{fmt0(totalCost)}</p>
            </div>
          </section>
        )}

        {/* Empty state */}
        {holdings.length === 0 && (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">💼</p>
            <p className="text-[#1A1A1E] font-semibold text-lg">暂无持仓</p>
            <p className="text-sm text-[#9A9A9E] mt-2">点击「加入持仓」录入你的股票数据</p>
            <button onClick={() => setShowForm(true)}
              className="mt-6 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-orange-200">
              + 录入第一支股票
            </button>
          </div>
        )}

        {/* Holdings list */}
        {holdings.length > 0 && (
          <div className="space-y-2">
            {loading && !hasPrices && holdings.map((_, i) => (
              <div key={i} className="h-[130px] rounded-2xl bg-white border border-[#E5E5EA] animate-pulse" />
            ))}
            {holdings.map(h => {
              const p = prices[h.code];
              const curPrice = p?.price ?? h.avgCost;
              const pnl = (curPrice - h.avgCost) * h.shares;
              const pnlPct = ((curPrice - h.avgCost) / h.avgCost) * 100;
              const up = pnlPct >= 0;

              return (
                <div key={h.code} className="rounded-2xl border border-[#E5E5EA] bg-white shadow-sm overflow-hidden">
                  <button onClick={() => router.push(`/stocks/${h.code}`)}
                    className="w-full px-4 pt-4 pb-3 active:bg-[#F5F5F8] transition-colors text-left">

                    <div className="flex items-start justify-between mb-2.5">
                      <div>
                        <p className="font-semibold text-[#1A1A1E]">{p?.name || h.name}</p>
                        <p className="text-xs text-[#9A9A9E] mt-0.5">{h.code}</p>
                        {p?.fundTitle && <p className="text-xs text-[#9A9A9E] mt-0.5">{p.fundTitle}</p>}
                      </div>
                      <div className="text-right">
                        {p ? (
                          <>
                            <p className={`text-xl font-bold ${up ? 'text-rose-500' : 'text-emerald-600'}`}>¥{fmt2(p.price)}</p>
                            <p className={`text-xs font-medium ${up ? 'text-rose-500' : 'text-emerald-600'}`}>
                              今日 {up ? '+' : ''}{p.changePercent.toFixed(2)}%
                            </p>
                          </>
                        ) : (
                          <div className="space-y-1">
                            <div className="h-6 w-16 rounded bg-[#E5E5EA] animate-pulse" />
                            <div className="h-3.5 w-12 rounded bg-[#E5E5EA] animate-pulse" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-[#F5F5F8]">
                      <div>
                        <p className="text-xs text-[#9A9A9E]">{fmt0(h.shares)}股 · 均价¥{h.avgCost}</p>
                        <p className="text-xs text-[#9A9A9E]">市值 ¥{fmt0(curPrice * h.shares)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${up ? 'text-rose-500' : 'text-emerald-600'}`}>
                          {up ? '+' : ''}¥{fmt0(pnl)}
                        </p>
                        <p className={`text-xs font-medium ${up ? 'text-rose-500' : 'text-emerald-600'}`}>
                          {up ? '+' : ''}{pnlPct.toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    {p && (
                      <div className="mt-2.5">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.signal === 'good' ? 'bg-orange-100 text-orange-600' :
                          p.signal === 'bad'  ? 'bg-rose-100 text-rose-500' :
                          'bg-[#F5F5F8] text-[#9A9A9E]'
                        }`}>
                          {p.signal === 'good' ? '可关注' : p.signal === 'bad' ? '暂观望' : '继续观察'}
                        </span>
                      </div>
                    )}
                  </button>

                  <div className="border-t border-[#F5F5F8] px-4 py-2 flex justify-between items-center">
                    <p className="text-xs text-[#C0C0C5]">点击查看完整分析及止盈止损</p>
                    <button onClick={() => removeHolding(h.code)}
                      className="text-xs text-[#C0C0C5] hover:text-rose-500 transition-colors">
                      删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
