'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface WatchItem { code: string; name: string; }
interface StockData {
  code: string; name: string; price: number; changePercent: number;
  signal: 'good' | 'neutral' | 'bad'; signalTitle: string; fundTitle: string;
}

function signalChip(signal: 'good' | 'neutral' | 'bad', title: string) {
  const cls =
    signal === 'good' ? 'bg-orange-100 text-orange-600' :
    signal === 'bad'  ? 'bg-rose-100 text-rose-500' :
    'bg-[#F5F5F8] text-[#9A9A9E]';
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{title}</span>;
}

export default function WatchlistPage() {
  const router = useRouter();
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [data, setData] = useState<Record<string, StockData | null>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    try {
      const saved: WatchItem[] = JSON.parse(localStorage.getItem('watchlist') || '[]');
      setWatchlist(saved);
    } catch { /* ignore */ }
  }, []);

  const fetchAll = useCallback(async (list: WatchItem[]) => {
    if (!list.length) return;
    setLoading(true);
    const results = await Promise.allSettled(
      list.map(async (item) => {
        const r = await fetch(`/api/stocks/${item.code}`);
        const json = await r.json();
        if (json.error) return { code: item.code, name: item.name, price: 0, changePercent: 0, signal: 'neutral' as const, signalTitle: '数据失败', fundTitle: '' };
        const cc: string = json.momAdvice?.colorClass || '';
        const signal: 'good' | 'neutral' | 'bad' =
          cc.includes('orange') ? 'good' : cc.includes('rose') ? 'bad' : 'neutral';
        return {
          code: item.code,
          name: json.basic?.name || item.name,
          price: json.basic?.price || 0,
          changePercent: json.basic?.changePercent || 0,
          signal,
          signalTitle: signal === 'good' ? '可关注' : signal === 'bad' ? '暂观望' : '继续观察',
          fundTitle: json.fund?.title || '',
        };
      })
    );
    const map: Record<string, StockData | null> = {};
    results.forEach(r => {
      if (r.status === 'fulfilled') map[r.value.code] = r.value;
    });
    setData(map);
    setLoading(false);
    setLastUpdated(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
  }, []);

  useEffect(() => {
    if (watchlist.length) fetchAll(watchlist);
  }, [watchlist, fetchAll]);

  const remove = (code: string) => {
    const next = watchlist.filter(w => w.code !== code);
    setWatchlist(next);
    localStorage.setItem('watchlist', JSON.stringify(next));
    setData(prev => { const n = { ...prev }; delete n[code]; return n; });
  };

  const hasData = Object.keys(data).length > 0;

  return (
    <main className="min-h-screen bg-[#F2F2F7] pt-4 pb-28 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#1A1A1E]">自选</h1>
            {lastUpdated && <p className="text-xs text-[#9A9A9E] mt-0.5">更新于 {lastUpdated}</p>}
          </div>
          {watchlist.length > 0 && (
            <button onClick={() => fetchAll(watchlist)} disabled={loading}
              className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs text-orange-600 font-medium disabled:opacity-50">
              {loading ? '刷新中…' : '刷新'}
            </button>
          )}
        </div>

        {watchlist.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">⭐</p>
            <p className="text-[#1A1A1E] font-semibold text-lg">暂无自选股票</p>
            <p className="text-sm text-[#9A9A9E] mt-2">搜索股票后点击「加自选」</p>
            <button onClick={() => router.push('/')}
              className="mt-6 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-orange-200">
              去搜索股票
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {loading && !hasData && watchlist.map((_, i) => (
              <div key={i} className="h-[88px] rounded-2xl bg-white border border-[#E5E5EA] animate-pulse" />
            ))}

            {watchlist.map(item => {
              const d = data[item.code];
              const up = d && d.changePercent >= 0;
              const loaded = d !== undefined;

              return (
                <div key={item.code} className="rounded-2xl border border-[#E5E5EA] bg-white shadow-sm overflow-hidden">
                  <button onClick={() => router.push(`/stocks/${item.code}`)}
                    className="w-full flex items-center justify-between px-4 py-4 active:bg-[#F5F5F8] transition-colors">
                    <div className="text-left">
                      <p className="font-semibold text-[#1A1A1E]">{d?.name || item.name}</p>
                      <p className="text-xs text-[#9A9A9E] mt-0.5">{item.code}</p>
                      {d && d.fundTitle && (
                        <p className="text-xs text-[#9A9A9E] mt-1">{d.fundTitle}</p>
                      )}
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      {!loaded ? (
                        <div className="space-y-1">
                          <div className="h-6 w-16 rounded bg-[#E5E5EA] animate-pulse" />
                          <div className="h-4 w-12 rounded bg-[#E5E5EA] animate-pulse" />
                        </div>
                      ) : d && d.price > 0 ? (
                        <>
                          <p className={`text-xl font-bold ${up ? 'text-rose-500' : 'text-emerald-600'}`}>
                            ¥{d.price.toFixed(2)}
                          </p>
                          <p className={`text-sm font-medium ${up ? 'text-rose-500' : 'text-emerald-600'}`}>
                            {up ? '+' : ''}{d.changePercent.toFixed(2)}%
                          </p>
                          {signalChip(d.signal, d.signalTitle)}
                        </>
                      ) : (
                        <p className="text-xs text-[#C0C0C5]">数据失败</p>
                      )}
                    </div>
                  </button>
                  <div className="border-t border-[#F5F5F8] px-4 py-2 flex justify-between items-center">
                    <p className="text-xs text-[#C0C0C5]">点击查看完整分析</p>
                    <button onClick={() => remove(item.code)}
                      className="text-xs text-[#C0C0C5] hover:text-rose-500 transition-colors">
                      移除
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
