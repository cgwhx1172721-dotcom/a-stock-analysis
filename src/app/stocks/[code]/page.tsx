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
interface NewsItem { title:string;url:string;publishTime:string;source:string; }

const fmtY = (n: number) => `¥${n.toFixed(2)}`;
const fmtCap = (v: number) => v >= 1e12 ? `${(v/1e12).toFixed(1)}万亿` : v >= 1e8 ? `${(v/1e8).toFixed(0)}亿` : `${(v/1e6).toFixed(0)}百万`;
const fmtAmt = (n: number) => { const abs=Math.abs(n),s=n>=0?'+':'-'; return abs>=1e8?`${s}¥${(abs/1e8).toFixed(2)}亿`:abs>=1e4?`${s}¥${(abs/1e4).toFixed(1)}万`:`${s}¥${abs.toFixed(0)}`; };

function sigCard(s:'good'|'neutral'|'bad') { return s==='good'?'bg-emerald-950/40 border-emerald-800':s==='bad'?'bg-rose-950/40 border-rose-800':'bg-slate-800/60 border-slate-700'; }
function sigText(s:'good'|'neutral'|'bad') { return s==='good'?'text-emerald-400':s==='bad'?'text-rose-400':'text-slate-300'; }

function rsiInfo(r:number) {
  if(r>=80) return {text:'严重超买',desc:'建议减仓，等待回调',color:'text-rose-400',border:'border-rose-800',bg:'bg-rose-950/40'};
  if(r>=70) return {text:'超买区间',desc:'短期有回调风险',color:'text-orange-400',border:'border-orange-800',bg:'bg-orange-950/40'};
  if(r>=50) return {text:'偏强',desc:'多方占优，可持有',color:'text-emerald-400',border:'border-emerald-800',bg:'bg-emerald-950/40'};
  if(r>=30) return {text:'中性',desc:'方向不明，观望为主',color:'text-slate-300',border:'border-slate-700',bg:'bg-slate-800'};
  return {text:'超卖',desc:'可能存在反弹机会',color:'text-sky-400',border:'border-sky-800',bg:'bg-sky-950/40'};
}
function macdInfo(m:number) {
  if(m>3) return {text:'强势多头',desc:'动能强劲，趋势向上',color:'text-emerald-400',border:'border-emerald-800',bg:'bg-emerald-950/40'};
  if(m>0) return {text:'多头区间',desc:'偏多，适合持有',color:'text-teal-400',border:'border-teal-800',bg:'bg-teal-950/40'};
  if(m>-3) return {text:'空头区间',desc:'偏空，谨慎持仓',color:'text-orange-400',border:'border-orange-800',bg:'bg-orange-950/40'};
  return {text:'弱势空头',desc:'下行压力大，注意止损',color:'text-rose-400',border:'border-rose-800',bg:'bg-rose-950/40'};
}

function Skeleton() {
  return (
    <div className="min-h-screen bg-[#07121f] p-4 space-y-4 animate-pulse">
      <div className="h-28 rounded-3xl bg-slate-800" />
      <div className="grid grid-cols-4 gap-2">{[...Array(8)].map((_,i)=><div key={i} className="h-16 rounded-2xl bg-slate-800"/>)}</div>
      <div className="h-64 rounded-3xl bg-slate-800"/>
      {[...Array(4)].map((_,i)=><div key={i} className="h-32 rounded-3xl bg-slate-800"/>)}
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
  const [technical, setTechnical] = useState<Technical|null>(null);
  const [history, setHistory] = useState<Kline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const chartRef = useRef<HTMLDivElement|null>(null);

  // Watchlist
  const [inWatchlist, setInWatchlist] = useState(false);
  useEffect(() => {
    if (!code) return;
    try { const wl:{code:string;name:string}[] = JSON.parse(localStorage.getItem('watchlist')||'[]'); setInWatchlist(wl.some(w=>w.code===code)); } catch {}
  }, [code]);
  const toggleWatchlist = () => {
    if (!basic) return;
    try {
      const wl:{code:string;name:string}[] = JSON.parse(localStorage.getItem('watchlist')||'[]');
      const next = inWatchlist ? wl.filter(w=>w.code!==basic.code) : [{code:basic.code,name:basic.name},...wl.filter(w=>w.code!==basic.code)];
      localStorage.setItem('watchlist', JSON.stringify(next)); setInWatchlist(!inWatchlist);
    } catch {}
  };

  // Holdings
  const [holdings, setHoldings] = useState<Holdings|null>(null);
  const [showHoldForm, setShowHoldForm] = useState(false);
  const [hShares, setHShares] = useState('');
  const [hCost, setHCost] = useState('');
  useEffect(() => {
    if (!code) return;
    try { const s = localStorage.getItem(`holdings_${code}`); if(s){const p:Holdings=JSON.parse(s);setHoldings(p);setHShares(String(p.shares));setHCost(String(p.avgCost));} } catch {}
  }, [code]);
  const saveHoldings = () => {
    const shares=Math.round(Math.abs(parseFloat(hShares))), avgCost=parseFloat(parseFloat(hCost).toFixed(3));
    if(!shares||!avgCost||avgCost<=0) return;
    const data:Holdings={shares,avgCost}; setHoldings(data); localStorage.setItem(`holdings_${code}`,JSON.stringify(data)); setShowHoldForm(false);
  };
  const clearHoldings = () => { setHoldings(null);setHShares('');setHCost(''); localStorage.removeItem(`holdings_${code}`); setShowHoldForm(false); };

  // Price alerts
  const [alertHigh, setAlertHigh] = useState('');
  const [alertLow, setAlertLow] = useState('');
  const [savedHigh, setSavedHigh] = useState('');
  const [savedLow, setSavedLow] = useState('');
  useEffect(() => {
    if (!code) return;
    try { const a = JSON.parse(localStorage.getItem(`alert_${code}`)||'{}'); if(a.high){setAlertHigh(a.high);setSavedHigh(a.high);} if(a.low){setAlertLow(a.low);setSavedLow(a.low);} } catch {}
  }, [code]);
  const saveAlert = () => {
    const obj:{high?:string;low?:string}={};
    const h=parseFloat(alertHigh),l=parseFloat(alertLow);
    if(!isNaN(h)&&h>0){obj.high=alertHigh;setSavedHigh(alertHigh);} else setSavedHigh('');
    if(!isNaN(l)&&l>0){obj.low=alertLow;setSavedLow(alertLow);} else setSavedLow('');
    localStorage.setItem(`alert_${code}`,JSON.stringify(obj));
  };

  // AI
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [aiAnalyzedAt, setAiAnalyzedAt] = useState('');

  // News
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);

  const loadAi = useCallback(async (stockCode: string, avgCost?: number, shares?: number) => {
    setAiLoading(true);
    try {
      const params = avgCost && shares ? `?shares=${shares}&avgCost=${avgCost}` : '';
      const r = await fetch(`/api/stocks/${stockCode}/ai${params}`).then(r=>r.json());
      if(r.text) { setAiText(r.text); setAiAnalyzedAt(new Date().toLocaleString('zh-CN')); }
    } catch {} finally { setAiLoading(false); }
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [mainRes, techRes, histRes] = await Promise.all([
        fetch(`/api/stocks/${code}`).then(r=>r.json()),
        fetch(`/api/stocks/${code}/technical`).then(r=>r.json()),
        fetch(`/api/stocks/${code}/history`).then(r=>r.json()),
      ]);
      if(mainRes.error){setError(mainRes.error);return;}
      setBasic(mainRes.basic); setFund(mainRes.fund); setVolume(mainRes.volume);
      setSector(mainRes.sector); setMomAdvice(mainRes.momAdvice);
      setLogic(mainRes.logic); setFundamentals(mainRes.fundamentals);
      setPosition(mainRes.position); setRisk(mainRes.risk);
      setTechnical(techRes.data); setHistory(histRes.data||[]);
      try {
        const entry={code:mainRes.basic.code,name:mainRes.basic.name};
        const prev:{code:string;name:string}[]=JSON.parse(localStorage.getItem('recent_searches')||'[]');
        localStorage.setItem('recent_searches',JSON.stringify([entry,...prev.filter(x=>x.code!==entry.code)].slice(0,6)));
      } catch {}
      // Load news
      setNewsLoading(true);
      fetch(`/api/stocks/${mainRes.basic.code}/news`).then(r=>r.json()).then(d=>setNews(d.news||[])).catch(()=>{}).finally(()=>setNewsLoading(false));
      // Load AI
      const hSaved = localStorage.getItem(`holdings_${mainRes.basic.code}`);
      const hData = hSaved ? JSON.parse(hSaved) as Holdings : null;
      loadAi(mainRes.basic.code, hData?.avgCost, hData?.shares);
    } catch { setError('网络错误，请检查连接后重试'); }
    finally { setLoading(false); }
  }, [code, loadAi]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!chartRef.current || !history.length) return;
    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth, height: 260,
      layout: { background:{type:ColorType.Solid,color:'#07121f'}, textColor:'#64748b', fontSize:10 },
      grid: { vertLines:{color:'#1e293b'}, horzLines:{color:'#1e293b'} },
      rightPriceScale: { borderColor:'#1e293b' },
      timeScale: { borderColor:'#1e293b', timeVisible:false },
    });
    const candles = chart.addCandlestickSeries({upColor:'#e84444',downColor:'#22c55e',borderVisible:false,wickUpColor:'#e84444',wickDownColor:'#22c55e'});
    candles.setData(history.map(h=>({time:h.date as any,open:h.open,high:h.high,low:h.low,close:h.close})));
    const vol = chart.addHistogramSeries({priceScaleId:'',color:'#eee'});
    vol.setData(history.map(h=>({time:h.date as any,value:h.volume,color:h.close>=h.open?'#e8444430':'#22c55e30'})));
    const resize=()=>chartRef.current&&chart.applyOptions({width:chartRef.current.clientWidth});
    window.addEventListener('resize',resize);
    return()=>{window.removeEventListener('resize',resize);chart.remove();};
  }, [history]);

  if(loading) return <Skeleton />;
  if(error||!basic) return (
    <main className="min-h-screen bg-[#07121f] flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <p className="text-slate-200 text-lg">{error||'分析失败'}</p>
        <button onClick={()=>router.push('/')} className="rounded-2xl border border-slate-700 bg-slate-800 px-6 py-3 text-slate-300 text-sm">← 返回</button>
      </div>
    </main>
  );

  const up = basic.changePercent >= 0;
  const priceColor = up ? 'text-rose-400' : 'text-emerald-400';
  const limitUp = Math.round(basic.prevClose*1.1*100)/100;
  const limitDown = Math.round(basic.prevClose*0.9*100)/100;
  const highNum = parseFloat(savedHigh), lowNum = parseFloat(savedLow);
  const highTriggered = savedHigh && !isNaN(highNum) && basic.price >= highNum;
  const lowTriggered = savedLow && !isNaN(lowNum) && basic.price <= lowNum;

  // Holdings calculations
  const h = holdings;
  const curPrice = basic.price;
  const avgCost = h?.avgCost ?? 0;
  const shares = h?.shares ?? 0;
  const pnl = h ? (curPrice - avgCost) * shares : 0;
  const pnlPct = h ? ((curPrice - avgCost) / avgCost) * 100 : 0;
  const marketValue = h ? curPrice * shares : 0;
  const hardStop = avgCost; // 保本止损
  const trailStops = [
    { label: '追踪 -10%（紧）', price: curPrice * 0.90, recommended: false },
    { label: '追踪 -15%（推荐）', price: curPrice * 0.85, recommended: true },
    { label: '追踪 -20%（宽）', price: curPrice * 0.80, recommended: false },
  ];
  const R = avgCost * 0.10; // 1R = 10% of cost
  const rTargets = [2,3,4,5,6,8].map(n => ({ n, price: avgCost + n * R }));
  const lastAchieved = [...rTargets].reverse().find(t => curPrice >= t.price);
  const nextTarget = rTargets.find(t => curPrice < t.price);

  return (
    <main className="min-h-screen bg-[#07121f] pb-28">
      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">

        {/* Alert banners */}
        {highTriggered && <div className="rounded-2xl border border-emerald-500 bg-emerald-900/40 px-4 py-2.5 text-sm text-emerald-300">🎯 目标价 ¥{highNum.toFixed(2)} 已触达！当前 ¥{curPrice.toFixed(2)}</div>}
        {lowTriggered && <div className="rounded-2xl border border-rose-500 bg-rose-900/40 px-4 py-2.5 text-sm text-rose-300">⚠️ 预警价 ¥{lowNum.toFixed(2)} 已触达！当前 ¥{curPrice.toFixed(2)}</div>}

        {/* ─── 顶部标题栏 ─── */}
        <section className="rounded-3xl border border-slate-700 bg-[#0d1c2e] p-5 shadow-soft">
          <button onClick={()=>router.push('/')} className="text-xs text-slate-500 hover:text-slate-300 mb-3 transition-colors">← 重新搜索</button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{basic.industry}</p>
              <h2 className="text-2xl font-bold text-white mt-0.5">{basic.name}</h2>
              <p className="text-slate-400 text-sm mt-0.5">{basic.code}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-3xl font-bold tracking-tight ${priceColor}`}>{fmtY(basic.price)}</p>
              <p className={`text-sm font-medium mt-0.5 ${priceColor}`}>{up?'+':''}{basic.changePercent.toFixed(2)}%　{up?'+':''}{basic.change.toFixed(2)}</p>
              <div className="flex gap-2 mt-2.5 justify-end">
                <button onClick={load} className="rounded-xl bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-xs text-slate-200 font-medium transition-colors">刷新</button>
                <button onClick={toggleWatchlist} className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${inWatchlist ? 'border-amber-600 bg-amber-900/40 text-amber-400' : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-amber-600 hover:text-amber-400'}`}>
                  {inWatchlist ? '★ 已自选' : '☆ 加自选'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 关键指标网格 ─── */}
        <section className="rounded-3xl border border-slate-700 bg-[#0d1c2e] p-4">
          <div className="grid grid-cols-4 gap-2">
            {[
              {label:'涨停价',value:fmtY(limitUp),color:'text-rose-400'},
              {label:'跌停价',value:fmtY(limitDown),color:'text-emerald-400'},
              {label:'今日最高',value:fmtY(basic.high)},
              {label:'今日最低',value:fmtY(basic.low)},
              {label:'市值',value:fmtCap(basic.marketCap)},
              {label:'换手率',value:`${basic.turnoverRate.toFixed(2)}%`},
              {label:'量比',value:basic.volumeRatio.toFixed(2)},
              {label:'PE',value:basic.pe!=null?basic.pe.toFixed(1):'--'},
            ].map(item=>(
              <div key={item.label} className="rounded-2xl border border-slate-700/50 bg-[#111b2d] p-2.5 text-center">
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className={`mt-1 font-semibold text-sm ${item.color||'text-slate-200'}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── K线图 ─── */}
        <section className="rounded-3xl border border-slate-700 bg-[#0d1c2e] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-200">价格走势（日线）</h3>
            <p className="text-xs text-slate-500">红涨绿跌 · 近 90 天</p>
          </div>
          {history.length ? (
            <div ref={chartRef} className="rounded-2xl overflow-hidden" style={{height:260}} />
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-500 text-sm">K 线数据加载中…</div>
          )}
        </section>

        {/* ─── 技术指标 + 综合分析 ─── */}
        <div className="grid gap-4 md:grid-cols-[1.4fr_0.6fr]">
          {/* 技术指标 */}
          <section className="rounded-3xl border border-slate-700 bg-[#0d1c2e] p-5">
            <h3 className="text-base font-semibold text-white mb-4">技术指标</h3>
            <div className="space-y-3">
              {technical && technical.ma5!=null && technical.ma20!=null && (() => {
                const p=basic.price,m5=technical.ma5!,m20=technical.ma20!,m60=technical.ma60;
                const isUp=p>m5&&m5>m20&&(!m60||m20>m60),isDn=p<m5&&m5<m20&&(!m60||m20<m60);
                const info=isUp?{text:'多头排列',desc:'短中期均线向上，趋势健康',color:'text-emerald-400',border:'border-emerald-800',bg:'bg-emerald-950/40'}:isDn?{text:'空头排列',desc:'三线向下，注意止损',color:'text-rose-400',border:'border-rose-800',bg:'bg-rose-950/40'}:{text:'均线混乱',desc:'方向不明确，建议观望',color:'text-slate-300',border:'border-slate-700',bg:'bg-slate-800/60'};
                return (
                  <div className={`rounded-2xl border ${info.border} ${info.bg} p-3`}>
                    <div className="flex items-start justify-between"><p className={`text-sm font-bold ${info.color}`}>{info.text}</p><span className="text-xs text-slate-500">均线系统</span></div>
                    <p className="text-xs text-slate-400 mt-0.5">{info.desc}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>MA5 <span className="text-slate-300 font-medium">{fmtY(m5)}</span></span>
                      {technical.ma20&&<span>MA20 <span className="text-slate-300 font-medium">{fmtY(technical.ma20)}</span></span>}
                      {technical.ma60&&<span>MA60 <span className="text-slate-300 font-medium">{fmtY(technical.ma60)}</span></span>}
                    </div>
                  </div>
                );
              })()}
              {technical?.rsi!=null&&(()=>{const r=rsiInfo(technical.rsi!);return(<div className={`rounded-2xl border ${r.border} ${r.bg} p-3`}><div className="flex items-center justify-between"><span className="text-xs text-slate-500">RSI</span><span className="text-xs text-slate-400">{technical.rsi!.toFixed(1)}</span></div><p className={`text-sm font-bold ${r.color} mt-1`}>{r.text}</p><p className="text-xs text-slate-400 mt-0.5">{r.desc}</p></div>)})()}
              {technical?.macd.macd!=null&&(()=>{const m=macdInfo(technical.macd.macd!);return(<div className={`rounded-2xl border ${m.border} ${m.bg} p-3`}><div className="flex items-center justify-between"><span className="text-xs text-slate-500">MACD</span><span className="text-xs text-slate-400">{technical.macd.macd!.toFixed(3)}</span></div><p className={`text-sm font-bold ${m.color} mt-1`}>{m.text}</p><p className="text-xs text-slate-400 mt-0.5">{m.desc}</p></div>)})()}
              {technical?.signals.length ? (
                <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-3">
                  <p className="text-xs text-slate-400 mb-2">综合技术信号</p>
                  <ul className="space-y-1.5">{technical.signals.map((s,i)=><li key={i} className="flex items-start gap-2 text-xs text-slate-300"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-teal-400 shrink-0"/>{s}</li>)}</ul>
                </div>
              ) : null}
            </div>
          </section>

          {/* 综合分析快览 */}
          <section className="rounded-3xl border border-slate-700 bg-[#0d1c2e] p-5">
            <h3 className="text-base font-semibold text-white mb-4">综合分析</h3>
            <div className="space-y-2.5">
              {[
                fund&&{label:'主力资金',sig:fund.signal,title:fund.title},
                volume&&{label:'量能状态',sig:volume.signal,title:volume.title},
                sector&&{label:'赛道热度',sig:sector.isHot?'good' as const:'neutral' as const,title:sector.isHot?`🔥 ${sector.theme}`:'❄️ 非热门'},
                logic&&{label:'投资逻辑',sig:logic.signal,title:logic.title},
                risk&&{label:'风险评估',sig:risk.signal,title:risk.title},
              ].filter(Boolean).map((item,i)=>item&&(
                <div key={i} className={`rounded-2xl border ${sigCard(item.sig)} p-3`}>
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className={`text-xs font-semibold mt-0.5 leading-snug ${sigText(item.sig)}`}>{item.title}</p>
                </div>
              ))}
              {momAdvice&&(
                <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-3">
                  <p className="text-xs text-slate-500 mb-1">综合建议</p>
                  <p className="text-lg">{momAdvice.emoji}</p>
                  <p className={`text-xs leading-relaxed mt-1 ${momAdvice.colorClass}`}>{momAdvice.text}</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ─── 持仓管理卡片 ─── */}
        <section className="rounded-3xl border border-slate-700 bg-[#0d1c2e] p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">持仓管理</p>
            <button onClick={()=>setShowHoldForm(!showHoldForm)}
              className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
              {h ? (showHoldForm ? '取消' : '修改') : (showHoldForm ? '取消' : '+ 录入持仓')}
            </button>
          </div>

          {/* Holdings form */}
          {showHoldForm && (
            <div className="space-y-2.5 rounded-2xl border border-slate-700 bg-slate-800/50 p-4">
              <input type="number" inputMode="numeric" value={hShares} onChange={e=>setHShares(e.target.value)} placeholder="持股数量（股）"
                className="w-full rounded-xl bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-500" />
              <input type="number" inputMode="decimal" value={hCost} onChange={e=>setHCost(e.target.value)} placeholder="持仓均价（元）"
                className="w-full rounded-xl bg-slate-700 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-500" />
              <div className="flex gap-2">
                <button onClick={saveHoldings} className="flex-1 rounded-xl bg-sky-600 hover:bg-sky-500 py-2.5 text-sm font-semibold text-white transition-colors">保存持仓</button>
                {h && <button onClick={clearHoldings} className="rounded-xl border border-slate-600 px-4 py-2.5 text-xs text-slate-400 hover:text-rose-400 transition-colors">清除</button>}
              </div>
            </div>
          )}

          {/* No holdings */}
          {!h && !showHoldForm && (
            <div className="rounded-2xl border border-dashed border-slate-700 p-5 text-center">
              <p className="text-sm text-slate-500">录入持仓数量和成本价</p>
              <p className="text-xs text-slate-600 mt-1">即可查看止盈止损和盈亏分析</p>
            </div>
          )}

          {/* Holdings data */}
          {h && !showHoldForm && (
            <>
              {/* Price + Cost */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-800 p-3">
                  <p className="text-xs text-slate-400 mb-1">当前价</p>
                  <p className={`text-xl font-bold ${priceColor}`}>{fmtY(curPrice)}</p>
                  <p className={`text-xs mt-0.5 ${priceColor}`}>{up?'+':''}{basic.changePercent.toFixed(2)}%</p>
                </div>
                <div className="rounded-2xl bg-slate-800 p-3">
                  <p className="text-xs text-slate-400 mb-1">成本价</p>
                  <p className="text-xl font-bold text-slate-200">{fmtY(avgCost)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">× {shares.toLocaleString()} 股</p>
                </div>
              </div>

              {/* P&L */}
              <div className="rounded-2xl bg-slate-800 p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">未实现盈亏</p>
                  <p className={`text-lg font-bold ${pnl>=0?'text-rose-400':'text-emerald-400'}`}>{fmtAmt(pnl)}</p>
                  <p className={`text-xs ${pnl>=0?'text-rose-500':'text-emerald-500'}`}>{pnl>=0?'+':''}{pnlPct.toFixed(2)}%</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-0.5">持仓市值</p>
                  <p className="text-base font-semibold text-slate-200">¥{marketValue.toLocaleString('zh-CN',{maximumFractionDigits:0})}</p>
                </div>
              </div>

              {/* 止盈止损 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">止盈止损</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pnlPct>=0?'bg-emerald-900/60 text-emerald-300':'bg-rose-900/60 text-rose-300'}`}>
                    {pnlPct>=0?'+':''}{pnlPct.toFixed(1)}% 浮盈
                  </span>
                </div>

                {/* 止损位 */}
                <div>
                  <p className="text-xs text-rose-400 mb-1.5">🛡 止损位</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between rounded-xl bg-rose-950/50 border border-rose-800 px-3 py-2">
                      <span className="text-xs text-rose-300 font-semibold">保本止损（成本价）</span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-white">{fmtY(hardStop)}</span>
                        <span className="text-xs text-rose-400 ml-1.5">跌破清仓</span>
                      </div>
                    </div>
                    {trailStops.map(ts=>(
                      <div key={ts.label} className={`flex items-center justify-between rounded-xl px-3 py-2 border ${ts.recommended?'bg-rose-900/30 border-rose-700':'bg-slate-800/40 border-slate-700'}`}>
                        <span className={`text-xs ${ts.recommended?'text-rose-300 font-semibold':'text-slate-400'}`}>{ts.recommended?'⭐ ':''}{ts.label}</span>
                        <span className="text-sm font-bold text-white">{fmtY(ts.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 止盈 R-multiples */}
                <div>
                  <p className="text-xs text-emerald-400 mb-1.5">
                    🎯 止盈目标
                    <span className="text-slate-500 font-normal ml-1">R = ¥{R.toFixed(2)}/股</span>
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {rTargets.map(({n,price})=>{
                      const achieved=curPrice>=price;
                      return (
                        <div key={n} className={`rounded-xl p-2 text-center border ${achieved?'bg-emerald-950/60 border-emerald-700':'bg-slate-800/50 border-slate-700'}`}>
                          <p className={`text-xs font-bold ${achieved?'text-emerald-400':'text-slate-500'}`}>{achieved?'✅':'▷'} {n}R</p>
                          <p className={`text-xs font-semibold mt-0.5 ${achieved?'text-white':'text-slate-400'}`}>{fmtY(price)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 当前建议 */}
                {pnlPct>0&&(lastAchieved||nextTarget)&&(
                  <div className="rounded-xl bg-sky-950/50 border border-sky-800 px-3 py-2.5 space-y-0.5">
                    <p className="text-xs font-semibold text-sky-300">💡 当前建议</p>
                    {lastAchieved&&lastAchieved.n>=4&&<p className="text-xs text-slate-300">已达 {lastAchieved.n}R，考虑减仓 1/3 锁定利润</p>}
                    {nextTarget&&<p className="text-xs text-slate-400">下一目标 {nextTarget.n}R {fmtY(nextTarget.price)}，还差 +{((nextTarget.price-curPrice)/curPrice*100).toFixed(1)}%</p>}
                  </div>
                )}
              </div>

              {/* 到价提醒 */}
              <div>
                <p className="text-xs font-semibold text-slate-300 mb-2.5 uppercase tracking-wide">到价提醒</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">目标价（涨到提醒）</p>
                    <input type="number" value={alertHigh} onChange={e=>setAlertHigh(e.target.value)} placeholder="如 15.00"
                      className={`w-full rounded-xl bg-slate-800 border px-3 py-2 text-sm text-white outline-none ${savedHigh?(highTriggered?'border-emerald-500':'border-teal-700'):'border-slate-700'} focus:border-teal-500`} />
                    {savedHigh&&<p className={`text-xs mt-1 ${highTriggered?'text-emerald-400 font-semibold':'text-slate-500'}`}>{highTriggered?'已触达!':'距目标 +'+((highNum-basic.price)/basic.price*100).toFixed(1)+'%'}</p>}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">预警价（跌到提醒）</p>
                    <input type="number" value={alertLow} onChange={e=>setAlertLow(e.target.value)} placeholder="如 9.50"
                      className={`w-full rounded-xl bg-slate-800 border px-3 py-2 text-sm text-white outline-none ${savedLow?(lowTriggered?'border-rose-500':'border-orange-700'):'border-slate-700'} focus:border-teal-500`} />
                    {savedLow&&<p className={`text-xs mt-1 ${lowTriggered?'text-rose-400 font-semibold':'text-slate-500'}`}>{lowTriggered?'已触达!':'距预警 -'+((basic.price-lowNum)/basic.price*100).toFixed(1)+'%'}</p>}
                  </div>
                </div>
                <button onClick={saveAlert} className="mt-2 w-full rounded-xl bg-slate-700 hover:bg-slate-600 py-2 text-xs text-slate-300 transition-colors">保存提醒</button>
              </div>
            </>
          )}

          {/* 到价提醒（无持仓时也可设置） */}
          {!h && !showHoldForm && (
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2.5 uppercase tracking-wide">到价提醒</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-slate-400 mb-1">目标价（涨到提醒）</p>
                  <input type="number" value={alertHigh} onChange={e=>setAlertHigh(e.target.value)} placeholder="如 15.00"
                    className={`w-full rounded-xl bg-slate-800 border px-3 py-2 text-sm text-white outline-none ${savedHigh?'border-teal-700':'border-slate-700'} focus:border-teal-500`} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">预警价（跌到提醒）</p>
                  <input type="number" value={alertLow} onChange={e=>setAlertLow(e.target.value)} placeholder="如 9.50"
                    className={`w-full rounded-xl bg-slate-800 border px-3 py-2 text-sm text-white outline-none ${savedLow?'border-orange-700':'border-slate-700'} focus:border-teal-500`} />
                </div>
              </div>
              <button onClick={saveAlert} className="mt-2 w-full rounded-xl bg-slate-700 hover:bg-slate-600 py-2 text-xs text-slate-300 transition-colors">保存提醒</button>
            </div>
          )}

          {/* ─── AI 分析 (可折叠) ─── */}
          <div className="rounded-2xl bg-[#0a1628] border border-sky-900/60 overflow-hidden">
            <button onClick={()=>{setAiExpanded(!aiExpanded);if(!aiExpanded&&!aiText)loadAi(basic.code,avgCost||undefined,shares||undefined);}}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-800/50 transition-colors">
              <span className="text-xs font-semibold text-sky-300 uppercase tracking-wide">🤖 DeepSeek AI 分析</span>
              <span className="text-xs text-slate-500">{aiExpanded?'收起 ▲':'展开 ▼'}</span>
            </button>
            {aiExpanded&&(
              <div className="px-3 pb-3">
                {aiLoading&&<p className="text-xs text-slate-400 animate-pulse">正在生成分析，请稍候…</p>}
                {!aiLoading&&!aiText&&<p className="text-xs text-slate-500">分析加载失败，请重试。</p>}
                {aiText&&(
                  <>
                    <p className="text-sm text-slate-200 leading-7 whitespace-pre-line">{aiText}</p>
                    {aiAnalyzedAt&&<p className="text-xs text-slate-600 mt-2">✨ {aiAnalyzedAt}</p>}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ─── 今日相关公告 ─── */}
          <div>
            <p className="text-xs font-semibold text-slate-300 mb-2.5 uppercase tracking-wide">今日相关公告</p>
            {newsLoading&&<p className="text-xs text-slate-500 animate-pulse">加载中...</p>}
            {!newsLoading&&news.length===0&&<p className="text-xs text-slate-600">暂无最新公告</p>}
            <div className="space-y-2">
              {news.map((item,i)=>(
                <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                  className="block rounded-xl bg-slate-800 border border-slate-700 p-2.5 hover:bg-slate-700 transition-colors">
                  <p className="text-xs text-slate-200 leading-relaxed">{item.title}</p>
                  {item.publishTime&&<p className="text-xs text-slate-500 mt-1">{item.source} · {item.publishTime}</p>}
                </a>
              ))}
            </div>
          </div>
        </section>

        <p className="text-center text-xs text-slate-700 pb-4">以上分析仅供参考，不构成投资建议。股市有风险，投资需谨慎。</p>
      </div>
    </main>
  );
}
