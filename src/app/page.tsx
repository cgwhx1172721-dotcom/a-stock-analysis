'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const HOTLIST = [
  { code: '600519', name: '贵州茅台' },
  { code: '000858', name: '五粮液' },
  { code: '300750', name: '宁德时代' },
  { code: '688981', name: '中芯国际' },
  { code: '002594', name: '比亚迪' },
];

export default function HomePage() {
  const [code, setCode] = useState('');
  const router = useRouter();
  const go = (c: string) => { const n = c.replace(/\D/g, ''); if (n.length >= 5) router.push(`/stocks/${n}`); };

  return (
    <main className="min-h-screen bg-[#050d1a] flex flex-col items-center justify-center px-5 py-12 safe-bottom">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">A 股量化分析助手</p>
          <h1 className="text-4xl font-semibold text-white">选股分析</h1>
          <p className="text-slate-400 text-sm">主力资金 · 量能状态 · 赛道热度</p>
        </div>

        <div className="space-y-3">
          <input
            type="text" inputMode="numeric"
            value={code} maxLength={6}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && go(code)}
            placeholder="输入 6 位股票代码"
            className="w-full rounded-2xl border border-slate-700 bg-[#0d1c2e] px-5 py-4 text-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500 text-center tracking-widest"
          />
          <button onClick={() => go(code)} disabled={code.length < 5}
            className="w-full rounded-2xl bg-teal-500 py-4 text-lg font-semibold text-slate-900 hover:bg-teal-400 disabled:opacity-40 transition-colors">
            开始分析
          </button>
        </div>

        <div>
          <p className="text-xs text-slate-600 mb-3 text-center uppercase tracking-wider">热门股票</p>
          <div className="space-y-2">
            {HOTLIST.map(s => (
              <button key={s.code} onClick={() => go(s.code)}
                className="w-full flex items-center justify-between rounded-2xl border border-slate-800 bg-[#0d1c2e] px-4 py-3 hover:border-slate-600 transition-colors">
                <span className="text-white font-medium">{s.name}</span>
                <span className="text-slate-500 text-sm">{s.code} →</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
