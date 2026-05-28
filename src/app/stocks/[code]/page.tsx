'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ColorType, createChart } from 'lightweight-charts';

// ——— types ———
interface Basic { code:string;name:string;price:number;changePercent:number;change:number;volumeRatio:number;turnoverRate:number;marketCap:number;industry:string;prevClose:number;high:number;low:number; }
interface FundDay { date:string;mainNetInflow:number; }
interface FundAnalysis { signal:'good'|'neutral'|'bad';title:string;summary:string;dailyLines:string[];total3d:number; }
interface VolumeAnalysis { signal:'good'|'neutral'|'bad';title:string;summary:string;details:string[]; }
interface SectorResult { isHot:boolean;theme:string|null;industry:string;reason:string; }
interface MomAdvice { text:string;emoji:string;colorClass:string; }
interface Technical { ma5:number|null;ma20:number|null;ma60:number|null;rsi:number|null;macd:{macd:number|null;signal:number|null};signals:string[]; }
interface Kline { date:string;open:number;close:number;high:number;low:number;volume:number;changePercent:number; }

// ——— helpers ———
const fmtY = (n: number) => `¥${n.toFixed(2)}`;
const fmtCap = (v: number) => v >= 1e12 ? `${(v/1e12).toFixed(1)}万亿` : v >= 1e8 ? `${(v/1e8).toFixed(0)}亿` : `${(v/1e6).toFixed(0)}百万`;

function rsiInfo(r: number) {
  if (r >= 80) return { text:'严重超买', desc:'建议减仓，等待回调', color:'text-rose-400', border:'border-rose-700', bg:'bg-rose-950/40' };
  if (r >= 70) return { text:'超买',     desc:'短期有回调风险',     color:'text-orange-400', border:'border-orange-700', bg:'bg-orange-950/40' };
  if (r >= 50) return { text:'偏强',     desc:'多方占优，可持有',   color:'text-emerald-400', border:'border-emerald-700', bg:'bg-emerald-950/40' };
  if (r >= 30) return { text:'中性',     desc:'方向不明，观望为主', color:'text-slate-400', border:'border-slate-700', bg:'bg-slate-800' };
  return              { text:'超卖',     desc:'可能存在反弹机会',   color:'text-sky-400', border:'border-sky-700', bg:'bg-sky-950/40' };
}
function macdInfo(m: number) {
  if (m > 3)  return { text:'强势多头', desc:'动能强劲，趋势向上', color:'text-emerald-400', border:'border-emerald-700', bg:'bg-emerald-950/40' };
  if (m > 0)  return { text:'多头区间', desc:'偏多，适合持有',     color:'text-teal-400', border:'border-teal-700', bg:'bg-teal-950/40' };
  if (m > -3) return { text:'空头区间', desc:'偏空，谨慎持仓',     color:'text-orange-400', border:'border-orange-700', bg:'bg-orange-950/40' };
  return             { text:'弱势空头', desc:'下行压力大，注意止损',color:'text-rose-400', border:'border-rose-700', bg:'bg-rose-950/40' };
}
function signalBorder(s: 'good'|'neutral'|'bad') {
  return s==='good' ? 'border-emerald-600 bg-emerald-950/30' : s==='bad' ? 'border-rose-600 bg-rose-950/30' : 'border-amber-600 bg-amber-950/30';
}

// ——— skeleton ———
function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse p-4">
      <div className="h-24 rounded-3xl bg-slate-800" />
      <div className="grid grid-cols-4 gap-2">{[...Array(4)].map((_,i)=><div key={i} className="h-16 rounded-2xl bg-slate-800"/>)}</div>
      <div className="h-64 rounded-3xl bg-slate-800"/>
      <div className="h-48 rounded-3xl bg-slate-800"/>
    </div>
  );
}

export default function StockPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [basic, setBasic] = useState<Basic|null>(null);
  const [fund, setFund] = useState<FundAnalysis|null>(null);
  const [volume, setVolume] = useState<VolumeAnalysis|null>(null);
  const [sector, setSector] = useState<SectorResult|null>(null);
  const [momAdvice, setMomAdvice] = useState<MomAdvice|null>(null);
  const [technical, setTechnical] = useState<Technical|null>(null);
  const [history, setHistory] = useState<Kline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const chartRef = useRef<HTMLDivElement|null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [mainRes, techRes, histRes] = await Promise.all([
        fetch(`/api/stocks/${code}`).then(r=>r.json()),
        fetch(`/api/stocks/${code}/technical`).then(r=>r.json()),
        fetch(`/api/stocks/${code}/history`).then(r=>r.json()),
      ]);
      if (mainRes.error) { setError(mainRes.error); return; }
      setBasic(mainRes.basic);
      setFund(mainRes.fund);
      setVolume(mainRes.volume);
      setSector(mainRes.sector);
      setMomAdvice(mainRes.momAdvice);
      setTechnical(techRes.data);
      setHistory(histRes.data || []);
    } catch { setError('网络错误，请检查连接后重试'); }
    finally { setLoading(false); }
  }, [code]);

  useEffect(() => { load(); }, [load]);

  // K 线图（A 股色：红涨绿跌）
  useEffect(() => {
    if (!chartRef.current || !history.length) return;
    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth, height: 280,
      layout: { background: { type: ColorType.Solid, color: '#07121f' }, textColor: '#94a3b8', fontSize: 11 },
      grid: { vertLines: { color: '#1d2e42' }, horzLines: { color: '#1d2e42' } },
      rightPriceScale: { borderColor: '#33415c' },
      timeScale: { borderColor: '#33415c', timeVisible: false },
    });
    const candles = chart.addCandlestickSeries({ upColor:'#e84444', downColor:'#1aab6b', borderVisible:false, wickUpColor:'#e84444', wickDownColor:'#1aab6b' });
    candles.setData(history.map(h => ({ time: h.date as any, open: h.open, high: h.high, low: h.low, close: h.close })));
    const vol = chart.addHistogramSeries({ priceScaleId:'', color:'#0a1b2f' });
    vol.setData(history.map(h => ({ time: h.date as any, value: h.volume, color: h.close >= h.open ? '#e8444466' : '#1aab6b66' })));
    const resize = () => chartRef.current && chart.applyOptions({ width: chartRef.current.clientWidth });
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); chart.remove(); };
  }, [history]);

  if (loading) return <div className="bg-[#050d1a] min-h-screen"><Skeleton /></div>;
  if (error || !basic) return (
    <main className="min-h-screen bg-[#050d1a] flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <p className="text-white text-lg">{error || '分析失败'}</p>
        <button onClick={() => router.push('/')} className="rounded-xl bg-slate-700 px-6 py-3 text-white">← 返回</button>
      </div>
    </main>
  );

  const up = basic.changePercent >= 0;
  const priceColor = up ? 'text-rose-400' : 'text-emerald-400';
  const limitUp = Math.round(basic.prevClose * 1.1 * 100) / 100;
  const limitDown = Math.round(basic.prevClose * 0.9 * 100) / 100;

  return (
    <main className="min-h-screen bg-[#050d1a] pb-20">
      <div className="max-w-2xl mx-auto space-y-4 px-4 pt-4">

        {/* ─── 顶部标题栏 ─── */}
        <section className="rounded-3xl border border-slate-800 bg-[#0d1c2e] p-5 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <button onClick={() => router.push('/')} className="text-xs text-slate-500 hover:text-slate-300 mb-1">← 重新搜索</button>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{basic.industry}</p>
              <h2 className="text-2xl font-semibold text-white mt-0.5">{basic.name}</h2>
              <p className="text-slate-400 text-sm mt-1">{basic.code}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-3xl font-bold ${priceColor}`}>{fmtY(basic.price)}</p>
              <p className={`text-sm font-medium ${priceColor}`}>{up?'+':''}{basic.changePercent.toFixed(2)}%　{up?'+':''}{basic.change.toFixed(2)}</p>
              <button onClick={load} className="mt-2 rounded-xl bg-[#14293b] px-4 py-1.5 text-xs text-slate-300 hover:bg-[#1d415f]">刷新数据</button>
            </div>
          </div>
        </section>

        {/* ─── 关键指标网格 ─── */}
        <section className="rounded-3xl border border-slate-800 bg-[#0d1c2e] p-4">
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            {[
              { label:'今日最高', value: fmtY(basic.high) },
              { label:'今日最低', value: fmtY(basic.low) },
              { label:'涨停价', value: fmtY(limitUp), color:'text-rose-400' },
              { label:'跌停价', value: fmtY(limitDown), color:'text-emerald-400' },
              { label:'市值', value: fmtCap(basic.marketCap) },
              { label:'换手率', value: `${basic.turnoverRate.toFixed(2)}%` },
              { label:'量比', value: basic.volumeRatio.toFixed(2) },
              { label:'昨收', value: fmtY(basic.prevClose) },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-slate-700 bg-[#07121f] p-2.5">
                <p className="text-slate-500">{item.label}</p>
                <p className={`mt-1 font-medium text-sm ${item.color || 'text-white'}`}>{item.value || '--'}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── K 线图 ─── */}
        <section className="rounded-3xl border border-slate-800 bg-[#0d1c2e] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-white">价格走势（日线）</h3>
            <p className="text-xs text-slate-500">红涨绿跌 · 近 90 天</p>
          </div>
          {history.length ? (
            <div ref={chartRef} className="rounded-2xl bg-[#07121f] overflow-hidden" style={{ height: 280 }} />
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-500 text-sm">K 线数据加载中…</div>
          )}
        </section>

        {/* ─── A 股专属：主力资金 + 量能 ─── */}
        {fund && (
          <section className={`rounded-3xl border p-5 ${signalBorder(fund.signal)}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">主力资金</p>
                <p className="text-base font-bold text-white">{fund.title}</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">{fund.summary}</p>
            {fund.dailyLines.length > 0 && (
              <ul className="mt-3 space-y-1">
                {fund.dailyLines.map((l, i) => <li key={i} className="text-xs text-slate-400 font-mono">· {l}</li>)}
              </ul>
            )}
          </section>
        )}

        {volume && (
          <section className={`rounded-3xl border p-5 ${signalBorder(volume.signal)}`}>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">量能分析</p>
            <p className="text-base font-bold text-white">{volume.title}</p>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">{volume.summary}</p>
            {volume.details.length > 0 && (
              <ul className="mt-2 space-y-1">
                {volume.details.map((d, i) => <li key={i} className="text-xs text-slate-400">· {d}</li>)}
              </ul>
            )}
          </section>
        )}

        {/* ─── 赛道热度 ─── */}
        {sector && (
          <section className={`rounded-3xl border p-5 ${sector.isHot ? 'border-orange-600 bg-orange-950/20' : 'border-slate-700 bg-[#0d1c2e]'}`}>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">赛道热度</p>
            <p className="text-base font-bold text-white">{sector.isHot ? `🔥 热门赛道：${sector.theme}` : '❄️ 非热门赛道'}</p>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">{sector.reason}</p>
          </section>
        )}

        {/* ─── 技术指标 ─── */}
        {technical && (
          <section className="rounded-3xl border border-slate-800 bg-[#0d1c2e] p-5">
            <h3 className="text-base font-semibold text-white mb-4">技术指标</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              {/* 均线 */}
              {technical.ma5 && technical.ma20 && technical.ma60 && (() => {
                const p = basic.price;
                const up = p > technical.ma5! && technical.ma5! > technical.ma20! && technical.ma20! > technical.ma60!;
                const down = p < technical.ma5! && technical.ma5! < technical.ma20! && technical.ma20! < technical.ma60!;
                const info = up ? { text:'多头排列', desc:'三线向上，趋势健康', color:'text-emerald-400', border:'border-emerald-700', bg:'bg-emerald-950/40' }
                           : down ? { text:'空头排列', desc:'三线向下，注意止损', color:'text-rose-400', border:'border-rose-700', bg:'bg-rose-950/40' }
                           : { text:'均线混乱', desc:'方向不明，建议观望', color:'text-slate-400', border:'border-slate-700', bg:'bg-slate-800' };
                return (
                  <div className={`sm:col-span-2 rounded-2xl border ${info.border} ${info.bg} p-4`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">均线系统</span>
                    </div>
                    <p className={`mt-1 text-base font-bold ${info.color}`}>{info.text}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{info.desc}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                      <span>MA5 <span className="text-slate-200">{fmtY(technical.ma5)}</span></span>
                      <span>MA20 <span className="text-slate-200">{fmtY(technical.ma20)}</span></span>
                      <span>MA60 <span className="text-slate-200">{fmtY(technical.ma60)}</span></span>
                    </div>
                  </div>
                );
              })()}

              {/* RSI */}
              {technical.rsi != null && (() => {
                const r = rsiInfo(technical.rsi!);
                return (
                  <div className={`rounded-2xl border ${r.border} ${r.bg} p-4`}>
                    <div className="flex items-center justify-between"><span className="text-xs text-slate-500">RSI 强弱指数</span><span className="text-xs text-slate-400">{technical.rsi!.toFixed(1)}</span></div>
                    <p className={`mt-2 text-base font-bold ${r.color}`}>{r.text}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{r.desc}</p>
                  </div>
                );
              })()}

              {/* MACD */}
              {technical.macd.macd != null && (() => {
                const m = macdInfo(technical.macd.macd!);
                return (
                  <div className={`rounded-2xl border ${m.border} ${m.bg} p-4`}>
                    <div className="flex items-center justify-between"><span className="text-xs text-slate-500">MACD 动能</span><span className="text-xs text-slate-400">{technical.macd.macd!.toFixed(3)}</span></div>
                    <p className={`mt-2 text-base font-bold ${m.color}`}>{m.text}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{m.desc}</p>
                  </div>
                );
              })()}

              {/* 综合信号 */}
              {technical.signals.length > 0 && (
                <div className="sm:col-span-2 rounded-2xl border border-slate-700 bg-[#07121f] p-4">
                  <p className="text-xs text-slate-500 mb-2">综合技术信号</p>
                  <ul className="space-y-1.5">
                    {technical.signals.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-teal-400 shrink-0" />{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ─── 妈妈综合建议 ─── */}
        {momAdvice && (
          <section className="rounded-3xl border border-slate-700 bg-[#0d1c2e] p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">综合建议</p>
            <div className="text-4xl mb-3">{momAdvice.emoji}</div>
            <p className={`text-base leading-relaxed font-medium ${momAdvice.colorClass}`}>{momAdvice.text}</p>
          </section>
        )}

        <p className="text-center text-xs text-slate-700 pb-4">以上分析仅供参考，不构成投资建议。股市有风险，投资需谨慎。</p>
      </div>
    </main>
  );
}
