'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface RecentItem { code: string; name: string; }

export default function HomePage() {
  const [code, setCode] = useState('');
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const router = useRouter();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('recent_searches') || '[]');
      setRecents(saved);
    } catch { /* ignore */ }
  }, []);

  const go = (c: string) => { const n = c.replace(/\D/g, ''); if (n.length >= 5) router.push(`/stocks/${n}`); };

  return (
    <main className="min-h-screen bg-[#F2F2F7] flex flex-col items-center justify-center px-5 py-12 pb-24">
      <div className="w-full max-w-sm space-y-8">

        {/* 标题 */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg shadow-red-200 mb-2 overflow-hidden">
            <img src="/icon.svg" alt="A股分析助手" className="w-full h-full" />
          </div>
          <h1 className="text-3xl font-bold text-[#1A1A1E]">A 股分析助手</h1>
          <p className="text-[#9A9A9E] text-sm">主力资金 · 量能状态 · 赛道热度</p>
        </div>

        {/* 搜索框 */}
        <div className="space-y-3">
          <input
            type="text" inputMode="numeric"
            value={code} maxLength={6}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && go(code)}
            placeholder="输入 6 位股票代码"
            className="w-full rounded-2xl border border-[#E5E5EA] bg-white px-5 py-4 text-xl text-[#1A1A1E] placeholder:text-[#C0C0C5] focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 text-center tracking-widest shadow-sm transition-all"
          />
          <button onClick={() => go(code)} disabled={code.length < 5}
            className="w-full rounded-2xl bg-orange-500 py-4 text-lg font-semibold text-white hover:bg-orange-400 active:bg-orange-600 disabled:opacity-30 shadow-md shadow-orange-200 transition-all">
            开始分析
          </button>
        </div>

        {/* 最近搜索 */}
        <div>
          <p className="text-xs text-[#C0C0C5] mb-3 text-center uppercase tracking-wider">最近搜索</p>
          {recents.length > 0 ? (
            <div className="space-y-2">
              {recents.map(s => (
                <button key={s.code} onClick={() => go(s.code)}
                  className="w-full flex items-center justify-between rounded-2xl border border-[#E5E5EA] bg-white px-4 py-3.5 hover:border-orange-300 hover:bg-orange-50 active:bg-orange-100 shadow-sm transition-all">
                  <span className="text-[#1A1A1E] font-medium">{s.name}</span>
                  <span className="text-[#9A9A9E] text-sm">{s.code} →</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 border border-dashed border-[#E5E5EA] rounded-2xl bg-white">
              <p className="text-sm text-[#C0C0C5]">搜索过的股票会显示在这里</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
