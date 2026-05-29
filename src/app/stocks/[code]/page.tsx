'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ColorType, createChart } from 'lightweight-charts';

interface Basic { code:string;name:string;price:number;changePercent:number;change:number;volumeRatio:number;turnoverRate:number;marketCap:number;industry:string;prevClose:number;high:number;low:number;pe:number|null;pb:number|null; }
interface FundAnalysis { signal:'good'|'neutral'|'bad';title:string;summary:string;dailyLines:string[];total3d:number; }
interface VolumeAnalysis { signal:'good'|'neutral'|'bad';title:string;summary:string;details:string[]; }
interface SectorResult { isHot:boolean;theme:string|null;industry:string;reason:string; }
interface MomAdvice { text:string;emoji:string;colorClass:string; }
interface LogicAnalysis { signal:'good'|'neutral'|'bad';title:string;summary:string;bullets:string[]; }
interface FundamentalsAnalysis { signal:'good'|'neutral'|'bad';title:string;summary:string;details:string[]; }
interface PositionAnalysis { signal:'good'|'neutral'|'bad';title:string;summary:string;positionPct:number;details:string[]; }
interface RiskAnalysis { signal:'good'|'neutral'|'bad';title:string;summary:string;risks:string[]; }
interface StopPointsAnalysis { stopLoss:number;stopLossPct:number;tp1:number;tp2:number;tp3:number;riskReward:number;details:string[]; }
interface Technical { ma5:number|null;ma20:number|null;ma60:number|null;rsi:number|null;macd:{macd:number|null;signal:number|null};signals:string[]; }
interface Kline { date:string;open:number;close:number;high:number;low:number;volume:number;changePercent:number; }
interface Holdings { shares:number;avgCost:number; }

const fmtY = (n: number) => `¥${n.toFixed(2)}`;
const fmtCap = (v: number) => v >= 1e12 ? `${(v/1e12).toFixed(1)}万亿` : v >= 1e8 ? `${(v/1e8).toFixed(0)}亿` : `${(v/1e6).toFixed(0)}百万`;
const fmtAmt = (n: number) => {
  const abs = Math.abs(n), sign = n >= 0 ? '+' : '-';
  if (abs >= 1e8) return `${sign}¥${(abs/1e8).toFixed(2)}亿`;
  if (abs >= 1e4) return `${sign}¥${(abs/1e4).toFixed(1)}万`;
  return `${sign}¥${abs.toFixed(0)}`;
};

// Light-theme signal borders
function signalBorder(s: 'good'|'neutral'|'bad') {
  return s === 'good'
    ? 'border-orange-200 bg-orange-50'
    : s === 'bad'
    ? 'border-rose-200 bg-rose-50'
    : 'border-[#E5E5EA] bg-white';
}
function signalTitle(s: 'good'|'neutral'|'bad') {
  return s === 'good' ? 'text-orange-700' : s === 'bad' ? 'text-rose-600' : 'text-[#1A1A1E]';
}

function SignalCard({ label, data }: { label: string; data: { signal:'good'|'neutral'|'bad'; title:string; summary:string; } & Record<string,unknown> }) {
  const lists = Object.entries(data).filter(([k]) => ['bullets','details','risks','dailyLines'].includes(k)).flatMap(([,v]) => v as string[]);
  return (
    <section className={`rounded-2xl border p-5 ${signalBorder(data.signal)}`}>
      <p className="text-xs text-[#9A9A9E] uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-base font-semibold ${signalTitle(data.signal)}`}>{data.title}</p>
      <p className="text-sm text-[#4A4A4E] mt-2 leading-relaxed">{data.summary}</p>
      {lists.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {lists.map((l, i) => <li key={i} className="text-xs text-[#6A6A6E] leading-relaxed">· {l}</li>)}
        </ul>
      )}
    </section>
  );
}

function PositionBar({ pct }: { pct: number }) {
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-[#9A9A9E] mb-1.5"><span>近期低点</span><span>近期高点</span></div>
      <div className="relative h-1.5 rounded-full bg-[#E5E5EA]">
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-orange-400 via-amber-300 to-rose-400" style={{ width: `${pct}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-1 rounded-full bg-orange-500 shadow" style={{ left: `${pct}%` }} />
      </div>
      <p className="text-center text-xs text-[#9A9A9E] mt-1.5">{pct}% 位置</p>
    </div>
  );
}

function rsiInfo(r: number) {
  if (r >= 80) return { text:'严重超买', desc:'建议减仓，等待回调', color:'text-rose-600', border:'border-rose-200', bg:'bg-rose-50' };
  if (r >= 70) return { text:'超买区间', desc:'短期有回调风险',     color:'text-orange-600', border:'border-orange-200', bg:'bg-orange-50' };
  if (r >= 50) return { text:'偏强',     desc:'多方占优，可持有',   color:'text-orange-500', border:'border-orange-100', bg:'bg-orange-50/60' };
  if (r >= 30) return { text:'中性',     desc:'方向不明，观望为主', color:'text-[#4A4A4E]', border:'border-[#E5E5EA]', bg:'bg-white' };
  return              { text:'超卖',     desc:'可能存在反弹机会',   color:'text-sky-600', border:'border-sky-200', bg:'bg-sky-50' };
}
function macdInfo(m: number) {
  if (m > 3)  return { text:'强势多头', desc:'动能强劲，趋势向上', color:'text-orange-600', border:'border-orange-200', bg:'bg-orange-50' };
  if (m > 0)  return { text:'多头区间', desc:'偏多，适合持有',     color:'text-amber-600',  border:'border-amber-200',  bg:'bg-amber-50' };
  if (m > -3) return { text:'空头区间', desc:'偏空，谨慎持仓',     color:'text-[#4A4A4E]',  border:'border-[#E5E5EA]',  bg:'bg-white' };
  return             { text:'弱势空头', desc:'下行压力大，注意止损',color:'text-rose-600',   border:'border-rose-200',   bg:'bg-rose-50' };
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse p-4">
      <div className="h-24 rounded-2xl bg-[#E5E5EA]" />
      <div className="grid grid-cols-4 gap-2">{[...Array(8)].map((_,i)=><div key={i} className="h-14 rounded-xl bg-[#E5E5EA]"/>)}</div>
      <div className="h-60 rounded-2xl bg-[#E5E5EA]"/>
      {[...Array(6)].map((_,i)=><div key={i} className="h-32 rounded-2xl bg-[#E5E5EA]"/>)}
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
  const [logic, setLogic] = useState<LogicAnalysis|null>(null);
  const [fundamentals, setFundamentals] = useState<FundamentalsAnalysis|null>(null);
  const [position, setPosition] = useState<PositionAnalysis|null>(null);
  const [risk, setRisk] = useState<RiskAnalysis|null>(null);
  const [stopPoints, setStopPoints] = useState<StopPointsAnalysis|null>(null);
  const [technical, setTechnical] = useState<Technical|null>(null);
  const [history, setHistory] = useState<Kline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const chartRef = useRef<HTMLDivElement|null>(null);

  // ── AI Analysis ──
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // ── Watchlist ──
  const [inWatchlist, setInWatchlist] = useState(false);

  useEffect(() => {
    if (!code) return;
    try {
      const wl: { code: string; name: string }[] = JSON.parse(localStorage.getItem('watchlist') || '[]');
      setInWatchlist(wl.some(w => w.code === code));
    } catch { /* ignore */ }
  }, [code]);

  const toggleWatchlist = () => {
    if (!basic) return;
    try {
      const wl: { code: string; name: string }[] = JSON.parse(localStorage.getItem('watchlist') || '[]');
      const next = inWatchlist
        ? wl.filter(w => w.code !== basic.code)
        : [{ code: basic.code, name: basic.name }, ...wl.filter(w => w.code !== basic.code)];
      localStorage.setItem('watchlist', JSON.stringify(next));
      setInWatchlist(!inWatchlist);
    } catch { /* ignore */ }
  };

  // ── Holdings ──
  const [holdings, setHoldings] = useState<Holdings|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [hShares, setHShares] = useState('');
  const [hCost, setHCost] = useState('');

  useEffect(() => {
    if (!code) return;
    try {
      const saved = localStorage.getItem(`holdings_${code}`);
      if (saved) {
        const p: Holdings = JSON.parse(saved);
        setHoldings(p);
        setHShares(String(p.shares));
        setHCost(String(p.avgCost));
      }
    } catch { /* ignore */ }
  }, [code]);

  const saveHoldings = () => {
    const shares = Math.round(Math.abs(parseFloat(hShares)));
    const avgCost = parseFloat(parseFloat(hCost).toFixed(3));
    if (!shares || shares <= 0 || !avgCost || avgCost <= 0) return;
    const data: Holdings = { shares, avgCost };
    setHoldings(data);
    localStorage.setItem(`holdings_${code}`, JSON.stringify(data));
    setShowForm(false);
  };

  const clearHoldings = () => {
    setHoldings(null); setHShares(''); setHCost('');
    localStorage.removeItem(`holdings_${code}`);
    setShowForm(false);
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [mainRes, techRes, histRes] = await Promise.all([
        fetch(`/api/stocks/${code}`).then(r=>r.json()),
        fetch(`/api/stocks/${code}/technical`).then(r=>r.json()),
        fetch(`/api/stocks/${code}/history`).then(r=>r.json()),
      ]);
      if (mainRes.error) { setError(mainRes.error); return; }
      setBasic(mainRes.basic); setFund(mainRes.fund); setVolume(mainRes.volume);
      setSector(mainRes.sector); setMomAdvice(mainRes.momAdvice);
      setLogic(mainRes.logic); setFundamentals(mainRes.fundamentals);
      setPosition(mainRes.position); setRisk(mainRes.risk);
      setStopPoints(mainRes.stopPoints);
      setTechnical(techRes.data); setHistory(histRes.data || []);
      try {
        const entry = { code: mainRes.basic.code, name: mainRes.basic.name };
        const prev: { code: string; name: string }[] = JSON.parse(localStorage.getItem('recent_searches') || '[]');
        const next = [entry, ...prev.filter(x => x.code !== entry.code)].slice(0, 6);
        localStorage.setItem('recent_searches', JSON.stringify(next));
      } catch { /* ignore */ }

      // Fetch AI analysis async (non-blocking)
      setAiLoading(true);
      try {
        const hSaved = localStorage.getItem(`holdings_${mainRes.basic.code}`);
        const hData = hSaved ? JSON.parse(hSaved) : null;
        const aiParams = hData ? `?shares=${hData.shares}&avgCost=${hData.avgCost}` : '';
        const aiRes = await fetch(`/api/stocks/${mainRes.basic.code}/ai${aiParams}`).then(r => r.json());
        if (aiRes.text) setAiText(aiRes.text);
      } catch { /* AI failure is non-fatal */ }
      finally { setAiLoading(false); }
    } catch { setError('网络错误，请检查连接后重试'); }
    finally { setLoading(false); }
  }, [code]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!chartRef.current || !history.length) return;
    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth, height: 240,
      layout: { background: { type: ColorType.Solid, color: '#FFFFFF' }, textColor: '#9A9A9E', fontSize: 10 },
      grid: { vertLines: { color: '#F5F5F8' }, horzLines: { color: '#F5F5F8' } },
      rightPriceScale: { borderColor: '#E5E5EA' },
      timeScale: { borderColor: '#E5E5EA', timeVisible: false },
    });
    const candles = chart.addCandlestickSeries({ upColor:'#e84444', downColor:'#1aab6b', borderVisible:false, wickUpColor:'#e84444', wickDownColor:'#1aab6b' });
    candles.setData(history.map(h => ({ time: h.date as any, open: h.open, high: h.high, low: h.low, close: h.close })));
    const vol = chart.addHistogramSeries({ priceScaleId:'', color:'#eee' });
    vol.setData(history.map(h => ({ time: h.date as any, value: h.volume, color: h.close >= h.open ? '#e8444430' : '#1aab6b30' })));
    const resize = () => chartRef.current && chart.applyOptions({ width: chartRef.current.clientWidth });
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); chart.remove(); };
  }, [history]);

  if (loading) return <div className="bg-[#F2F2F7] min-h-screen"><Skeleton /></div>;
  if (error || !basic) return (
    <main className="min-h-screen bg-[#F2F2F7] flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <p className="text-[#1A1A1E] text-lg">{error || '分析失败'}</p>
        <button onClick={() => router.push('/')} className="rounded-xl border border-[#E5E5EA] bg-white px-6 py-3 text-[#1A1A1E] text-sm shadow-sm">← 返回</button>
      </div>
    </main>
  );

  const up = basic.changePercent >= 0;
  const priceColor = up ? 'text-rose-500' : 'text-emerald-600';
  const limitUp = Math.round(basic.prevClose * 1.1 * 100) / 100;
  const limitDown = Math.round(basic.prevClose * 0.9 * 100) / 100;

  return (
    <main className="min-h-screen bg-[#F2F2F7] pb-28">
      <div className="max-w-2xl mx-auto space-y-3 px-4 pt-4">

        {/* ─── 顶部标题栏 ─── */}
        <section className="rounded-2xl border border-[#E5E5EA] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <button onClick={() => router.push('/')} className="text-xs text-[#9A9A9E] hover:text-orange-500 mb-1.5 transition-colors">← 重新搜索</button>
              <p className="text-xs tracking-widest text-[#9A9A9E] uppercase">{basic.industry}</p>
              <h2 className="text-2xl font-bold text-[#1A1A1E] mt-0.5">{basic.name}</h2>
              <p className="text-[#9A9A9E] text-sm mt-0.5">{basic.code}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-3xl font-bold tracking-tight ${priceColor}`}>{fmtY(basic.price)}</p>
              <p className={`text-sm font-medium mt-0.5 ${priceColor}`}>{up?'+':''}{basic.changePercent.toFixed(2)}%　{up?'+':''}{basic.change.toFixed(2)}</p>
              <button onClick={load} className="mt-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 active:bg-orange-600 px-4 py-1.5 text-xs text-white font-medium shadow-sm transition-colors">
                刷新
              </button>
              <button onClick={toggleWatchlist}
                className={`mt-1.5 rounded-lg border px-4 py-1.5 text-xs font-medium transition-all ${
                  inWatchlist
                    ? 'border-orange-300 bg-orange-50 text-orange-600'
                    : 'border-[#E5E5EA] bg-white text-[#9A9A9E] hover:border-orange-300 hover:text-orange-500'
                }`}>
                {inWatchlist ? '★ 已自选' : '☆ 加自选'}
              </button>
            </div>
          </div>
        </section>

        {/* ─── 关键指标网格 ─── */}
        <section className="rounded-2xl border border-[#E5E5EA] bg-white p-4 shadow-sm">
          <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
            {[
              { label:'涨停价', value: fmtY(limitUp), color:'text-rose-500' },
              { label:'跌停价', value: fmtY(limitDown), color:'text-emerald-600' },
              { label:'今日最高', value: fmtY(basic.high) },
              { label:'今日最低', value: fmtY(basic.low) },
              { label:'市值', value: fmtCap(basic.marketCap) },
              { label:'换手率', value: `${basic.turnoverRate.toFixed(2)}%` },
              { label:'量比', value: basic.volumeRatio.toFixed(2) },
              { label:'市盈率PE', value: basic.pe != null ? basic.pe.toFixed(1) : '--' },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-[#F0F0F5] bg-[#F8F8FA] p-2.5">
                <p className="text-[#9A9A9E]">{item.label}</p>
                <p className={`mt-1 font-semibold text-sm ${item.color || 'text-[#1A1A1E]'}`}>{item.value || '--'}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── K 线图 ─── */}
        <section className="rounded-2xl border border-[#E5E5EA] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#1A1A1E]">价格走势（日线）</h3>
            <p className="text-xs text-[#9A9A9E]">红涨绿跌 · 近 90 天</p>
          </div>
          {history.length ? (
            <div ref={chartRef} className="rounded-xl overflow-hidden border border-[#F0F0F5]" style={{ height: 240 }} />
          ) : (
            <div className="h-40 flex items-center justify-center text-[#9A9A9E] text-sm">K 线数据加载中…</div>
          )}
        </section>

        {/* ─── 投资逻辑 ─── */}
        {logic && <SignalCard label="投资逻辑" data={logic as any} />}

        {/* ─── 基本面 ─── */}
        {fundamentals && <SignalCard label="基本面分析" data={fundamentals as any} />}

        {/* ─── 价格位置 ─── */}
        {position && (
          <section className={`rounded-2xl border p-5 shadow-sm ${signalBorder(position.signal)}`}>
            <p className="text-xs text-[#9A9A9E] uppercase tracking-wider mb-1">价格位置</p>
            <p className={`text-base font-semibold ${signalTitle(position.signal)}`}>{position.title}</p>
            <PositionBar pct={position.positionPct} />
            <p className="text-sm text-[#4A4A4E] mt-3 leading-relaxed">{position.summary}</p>
            <ul className="mt-2 space-y-1">
              {position.details.map((d,i) => <li key={i} className="text-xs text-[#6A6A6E]">· {d}</li>)}
            </ul>
          </section>
        )}

        {/* ─── 主力资金 + 量能 ─── */}
        {fund && <SignalCard label="主力资金" data={fund as any} />}
        {volume && <SignalCard label="量能分析" data={volume as any} />}

        {/* ─── 赛道热度 ─── */}
        {sector && (
          <section className={`rounded-2xl border p-5 shadow-sm ${sector.isHot ? 'border-orange-200 bg-orange-50' : 'border-[#E5E5EA] bg-white'}`}>
            <p className="text-xs text-[#9A9A9E] uppercase tracking-wider mb-1">赛道热度</p>
            <p className={`text-base font-semibold ${sector.isHot ? 'text-orange-700' : 'text-[#1A1A1E]'}`}>
              {sector.isHot ? `🔥 热门赛道：${sector.theme}` : '❄️ 非热门赛道'}
            </p>
            <p className="text-sm text-[#4A4A4E] mt-2 leading-relaxed">{sector.reason}</p>
          </section>
        )}

        {/* ─── 风险分析 ─── */}
        {risk && <SignalCard label="风险分析" data={risk as any} />}

        {/* ─── 技术指标 ─── */}
        {technical && (
          <section className="rounded-2xl border border-[#E5E5EA] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-[#1A1A1E] mb-3">技术指标</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {technical.ma5 && technical.ma20 && technical.ma60 && (() => {
                const p = basic.price;
                const isUp = p > technical.ma5! && technical.ma5! > technical.ma20! && technical.ma20! > technical.ma60!;
                const isDn = p < technical.ma5! && technical.ma5! < technical.ma20! && technical.ma20! < technical.ma60!;
                const info = isUp
                  ? { text:'多头排列', desc:'三线向上，趋势健康',   color:'text-orange-600', border:'border-orange-200', bg:'bg-orange-50' }
                  : isDn
                  ? { text:'空头排列', desc:'三线向下，注意止损',   color:'text-rose-600',   border:'border-rose-200',   bg:'bg-rose-50' }
                  : { text:'均线混乱', desc:'方向不明，建议观望',   color:'text-[#4A4A4E]',  border:'border-[#E5E5EA]',  bg:'bg-[#F8F8FA]' };
                return (
                  <div className={`sm:col-span-2 rounded-xl border ${info.border} ${info.bg} p-4`}>
                    <span className="text-xs text-[#9A9A9E]">均线系统</span>
                    <p className={`mt-1 text-base font-bold ${info.color}`}>{info.text}</p>
                    <p className="text-xs text-[#6A6A6E] mt-0.5">{info.desc}</p>
                    <div className="mt-2.5 flex flex-wrap gap-3 text-xs text-[#9A9A9E]">
                      <span>MA5 <span className="text-[#1A1A1E] font-medium">{fmtY(technical.ma5)}</span></span>
                      <span>MA20 <span className="text-[#1A1A1E] font-medium">{fmtY(technical.ma20)}</span></span>
                      <span>MA60 <span className="text-[#1A1A1E] font-medium">{fmtY(technical.ma60)}</span></span>
                    </div>
                  </div>
                );
              })()}
              {technical.rsi != null && (() => {
                const r = rsiInfo(technical.rsi!);
                return (
                  <div className={`rounded-xl border ${r.border} ${r.bg} p-4`}>
                    <div className="flex justify-between">
                      <span className="text-xs text-[#9A9A9E]">RSI 强弱指数</span>
                      <span className="text-xs text-[#6A6A6E]">{technical.rsi!.toFixed(1)}</span>
                    </div>
                    <p className={`mt-2 text-base font-bold ${r.color}`}>{r.text}</p>
                    <p className="text-xs text-[#6A6A6E] mt-0.5">{r.desc}</p>
                  </div>
                );
              })()}
              {technical.macd.macd != null && (() => {
                const m = macdInfo(technical.macd.macd!);
                return (
                  <div className={`rounded-xl border ${m.border} ${m.bg} p-4`}>
                    <div className="flex justify-between">
                      <span className="text-xs text-[#9A9A9E]">MACD 动能</span>
                      <span className="text-xs text-[#6A6A6E]">{technical.macd.macd!.toFixed(3)}</span>
                    </div>
                    <p className={`mt-2 text-base font-bold ${m.color}`}>{m.text}</p>
                    <p className="text-xs text-[#6A6A6E] mt-0.5">{m.desc}</p>
                  </div>
                );
              })()}
              {technical.signals.length > 0 && (
                <div className="sm:col-span-2 rounded-xl border border-[#E5E5EA] bg-[#F8F8FA] p-4">
                  <p className="text-xs text-[#9A9A9E] mb-2">综合技术信号</p>
                  <ul className="space-y-1.5">
                    {technical.signals.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#4A4A4E]">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ─── 综合建议 ─── */}
        {momAdvice && (
          <section className="rounded-2xl border border-[#E5E5EA] bg-white p-5 shadow-sm">
            <p className="text-xs text-[#9A9A9E] uppercase tracking-wider mb-3">综合建议</p>
            <div className="text-4xl mb-3">{momAdvice.emoji}</div>
            <p className={`text-base leading-relaxed font-medium ${momAdvice.colorClass}`}>{momAdvice.text}</p>
          </section>
        )}

        {/* ─── 我的持仓 ─── */}
        <section className="rounded-2xl border border-[#E5E5EA] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-[#9A9A9E] uppercase tracking-wider">我的持仓</p>
              <p className="text-sm font-semibold text-[#1A1A1E] mt-0.5">个性化盈亏分析</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-lg border border-orange-300 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 text-xs text-orange-600 font-medium transition-colors"
            >
              {holdings ? (showForm ? '取消' : '修改') : (showForm ? '取消' : '+ 录入')}
            </button>
          </div>

          {/* 录入表单 */}
          {showForm && (
            <div className="space-y-3 mb-1">
              <div>
                <p className="text-xs text-[#9A9A9E] mb-1.5">持股数量（股）</p>
                <input
                  type="number" inputMode="numeric" min="1" step="1"
                  value={hShares} onChange={e => setHShares(e.target.value)}
                  placeholder="如：1000"
                  className="w-full rounded-xl border border-[#E5E5EA] bg-[#F8F8FA] px-4 py-3 text-[#1A1A1E] text-sm placeholder:text-[#C0C0C5] focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                />
              </div>
              <div>
                <p className="text-xs text-[#9A9A9E] mb-1.5">持仓均价（每股买入成本，元）</p>
                <input
                  type="number" inputMode="decimal" min="0.01" step="0.01"
                  value={hCost} onChange={e => setHCost(e.target.value)}
                  placeholder="如：12.50"
                  className="w-full rounded-xl border border-[#E5E5EA] bg-[#F8F8FA] px-4 py-3 text-[#1A1A1E] text-sm placeholder:text-[#C0C0C5] focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={saveHoldings}
                  className="flex-1 rounded-xl bg-orange-500 hover:bg-orange-400 active:bg-orange-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors">
                  保存持仓
                </button>
                {holdings && (
                  <button onClick={clearHoldings}
                    className="rounded-xl border border-[#E5E5EA] px-4 py-3 text-xs text-[#9A9A9E] hover:text-rose-500 hover:border-rose-200 transition-colors">
                    清除
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 空状态 */}
          {!holdings && !showForm && (
            <div className="text-center py-5 border border-dashed border-[#E5E5EA] rounded-xl bg-[#F8F8FA]">
              <p className="text-sm text-[#9A9A9E]">录入持股数量和成本</p>
              <p className="text-xs text-[#C0C0C5] mt-1">即可查看实时盈亏和止盈止损到账金额</p>
              <button onClick={() => setShowForm(true)}
                className="mt-3 rounded-xl border border-orange-300 bg-orange-50 hover:bg-orange-100 px-5 py-2 text-sm text-orange-600 font-medium transition-colors">
                + 录入持仓数据
              </button>
            </div>
          )}

          {/* 持仓分析 */}
          {holdings && !showForm && (() => {
            const { shares, avgCost } = holdings;
            const curPrice = basic.price;
            const totalCost = shares * avgCost;
            const curValue = shares * curPrice;
            const pnl = curValue - totalCost;
            const pnlPct = (curPrice - avgCost) / avgCost * 100;
            const inProfit = pnl >= 0;

            return (
              <div className="space-y-3">
                <div className="text-sm text-[#6A6A6E] bg-[#F8F8FA] rounded-xl px-4 py-3">
                  持有 <span className="text-[#1A1A1E] font-semibold">{shares.toLocaleString()}</span> 股
                  &nbsp;·&nbsp;均价 <span className="text-[#1A1A1E] font-semibold">{fmtY(avgCost)}</span>
                  &nbsp;·&nbsp;总成本 <span className="text-[#4A4A4E]">¥{totalCost.toLocaleString('zh', {maximumFractionDigits:0})}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-[#E5E5EA] bg-[#F8F8FA] p-3">
                    <p className="text-xs text-[#9A9A9E]">当前市值</p>
                    <p className="text-base font-bold text-[#1A1A1E] mt-0.5">
                      ¥{curValue.toLocaleString('zh', {maximumFractionDigits:0})}
                    </p>
                  </div>
                  <div className={`rounded-xl border p-3 ${inProfit ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
                    <p className="text-xs text-[#9A9A9E]">当前盈亏</p>
                    <p className={`text-base font-bold mt-0.5 ${inProfit ? 'text-rose-500' : 'text-emerald-600'}`}>
                      {fmtAmt(pnl)}
                    </p>
                    <p className={`text-xs mt-0.5 ${inProfit ? 'text-rose-400' : 'text-emerald-500'}`}>
                      {inProfit ? '+' : ''}{pnlPct.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {stopPoints && (
                  <div className="rounded-xl border border-[#E5E5EA] bg-[#F8F8FA] p-4">
                    <p className="text-xs text-[#9A9A9E] mb-3">止盈止损到账预估</p>
                    <div className="space-y-3">
                      {([
                        { label:'🛡️ 触发止损', price: stopPoints.stopLoss, pctLabel: `${stopPoints.stopLossPct.toFixed(1)}%` },
                        { label:'🎯 止盈一 +5%',  price: stopPoints.tp1, pctLabel: '+5.0%' },
                        { label:'🎯 止盈二 +10%', price: stopPoints.tp2, pctLabel: '+10.0%' },
                        { label:'🎯 止盈三 +18%', price: stopPoints.tp3, pctLabel: '+18.0%' },
                      ] as const).map(item => {
                        const amt = (item.price - avgCost) * shares;
                        const amtPct = (item.price - avgCost) / avgCost * 100;
                        const pos = amt >= 0;
                        return (
                          <div key={item.label} className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs text-[#4A4A4E] shrink-0">{item.label}</span>
                              <span className="text-xs text-[#9A9A9E] shrink-0">{fmtY(item.price)}</span>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <span className={`text-sm font-semibold ${pos ? 'text-rose-500' : 'text-emerald-600'}`}>
                                {fmtAmt(amt)}
                              </span>
                              <span className={`ml-1 text-xs ${pos ? 'text-rose-400' : 'text-emerald-500'}`}>
                                ({pos?'+':''}{amtPct.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </section>

        {/* ─── 止盈止损参考 ─── */}
        {stopPoints && (() => {
          const rrGood = stopPoints.riskReward >= 1.5;
          const rrOk   = stopPoints.riskReward >= 1.0;
          const rrColor  = rrGood ? 'text-orange-600' : rrOk ? 'text-amber-600' : 'text-rose-500';
          const rrStyle  = rrGood ? 'border-orange-200 bg-orange-50' : rrOk ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50';
          return (
            <section className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
              <p className="text-xs text-[#9A9A9E] uppercase tracking-wider mb-3">止盈止损参考价位</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="col-span-2 rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#9A9A9E]">🛡️ 参考止损</p>
                    <p className="text-lg font-bold text-rose-500 mt-0.5">{fmtY(stopPoints.stopLoss)}</p>
                  </div>
                  <span className="rounded-lg bg-rose-100 border border-rose-200 px-3 py-1 text-sm font-semibold text-rose-500">
                    {stopPoints.stopLossPct.toFixed(1)}%
                  </span>
                </div>
                <div className="rounded-xl border border-orange-200 bg-white p-3">
                  <p className="text-xs text-[#9A9A9E]">🎯 止盈一</p>
                  <p className="text-base font-bold text-orange-600 mt-0.5">{fmtY(stopPoints.tp1)}</p>
                  <p className="text-xs text-[#9A9A9E] mt-0.5">+5.0% · 减半</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-white p-3">
                  <p className="text-xs text-[#9A9A9E]">🎯 止盈二</p>
                  <p className="text-base font-bold text-amber-600 mt-0.5">{fmtY(stopPoints.tp2)}</p>
                  <p className="text-xs text-[#9A9A9E] mt-0.5">+10.0% · 再减</p>
                </div>
                <div className="rounded-xl border border-yellow-200 bg-white p-3">
                  <p className="text-xs text-[#9A9A9E]">🎯 止盈三</p>
                  <p className="text-base font-bold text-yellow-600 mt-0.5">{fmtY(stopPoints.tp3)}</p>
                  <p className="text-xs text-[#9A9A9E] mt-0.5">+18.0% · 清仓</p>
                </div>
                <div className={`rounded-xl border p-3 ${rrStyle}`}>
                  <p className="text-xs text-[#9A9A9E]">⚖️ 风险回报比</p>
                  <p className={`text-base font-bold mt-0.5 ${rrColor}`}>1 : {stopPoints.riskReward.toFixed(2)}</p>
                  <p className="text-xs text-[#9A9A9E] mt-0.5">以止盈一计算</p>
                </div>
              </div>
              <ul className="space-y-1.5">
                {stopPoints.details.map((d, i) => <li key={i} className="text-xs text-[#6A6A6E] leading-relaxed">· {d}</li>)}
              </ul>
            </section>
          );
        })()}

        {/* ─── AI 中文解释 ─── */}
        <section className="rounded-2xl border border-[#E5E5EA] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🤖</span>
            <h3 className="text-base font-semibold text-[#1A1A1E]">AI 中文解读</h3>
            {aiLoading && (
              <span className="ml-auto text-xs text-[#9A9A9E] animate-pulse">DeepSeek 分析中…</span>
            )}
          </div>
          {aiLoading && !aiText && (
            <div className="space-y-2 animate-pulse">
              <div className="h-3.5 rounded bg-[#E5E5EA] w-full" />
              <div className="h-3.5 rounded bg-[#E5E5EA] w-5/6" />
              <div className="h-3.5 rounded bg-[#E5E5EA] w-4/6" />
              <div className="h-3.5 rounded bg-[#E5E5EA] w-full mt-2" />
              <div className="h-3.5 rounded bg-[#E5E5EA] w-3/4" />
            </div>
          )}
          {aiText ? (
            <div className="text-sm text-[#4A4A4E] leading-7 whitespace-pre-line">{aiText}</div>
          ) : !aiLoading ? (
            <p className="text-sm text-[#C0C0C5]">AI 解读加载失败，请刷新重试</p>
          ) : null}
        </section>

        <p className="text-center text-xs text-[#C0C0C5] pb-4">以上分析仅供参考，不构成投资建议。股市有风险，投资需谨慎。</p>
      </div>
    </main>
  );
}
