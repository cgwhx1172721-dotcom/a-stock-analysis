const EM_UT = 'bd1d9ddb04089700cf9c27f6f7426281';
const EM_HEADERS = {
  'Referer': 'https://finance.eastmoney.com/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

export function normalizeCode(input: string): string {
  return input.trim().replace(/\.(SS|SZ|BJ)$/i, '').replace(/\D/g, '').padStart(6, '0');
}

export function getSecId(code: string): string {
  const c = normalizeCode(code);
  if (/^[69]/.test(c)) return `1.${c}`; // 上海
  return `0.${c}`;                        // 深圳
}

export function getLimitPrice(price: number, changePercent: number): { up: number; down: number } {
  const base = price / (1 + changePercent / 100);
  return { up: Math.round(base * 1.1 * 100) / 100, down: Math.round(base * 0.9 * 100) / 100 };
}

export interface StockBasic {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  change: number;
  volumeRatio: number;
  turnoverRate: number;
  marketCap: number;
  industry: string;
  prevClose: number;
  high: number;
  low: number;
  pe: number | null;
  pb: number | null;
}

export interface KlinePoint {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  changePercent: number;
  turnoverRate: number;
}

export interface FundFlowDay {
  date: string;
  mainNetInflow: number;
  superLargeNetInflow: number;
  largeNetInflow: number;
}

export async function fetchStockBasic(code: string): Promise<StockBasic | null> {
  const secid = getSecId(code);
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f57,f58,f43,f44,f45,f60,f169,f170,f116,f168,f10,f50,f127,f9,f23&ut=${EM_UT}&_=${Date.now()}`;
  try {
    const res = await fetch(url, { headers: EM_HEADERS, cache: 'no-store' });
    const json = await res.json();
    const d = json?.data;
    if (!d || !d.f58 || d.f58 === '-') return null;
    const vrRaw = Number(d.f10) || Number(d.f50) || 0;
    return {
      code: String(d.f57 || code),
      name: String(d.f58),
      price: Number(d.f43 || 0) / 100,
      changePercent: Number(d.f170 || 0) / 100,
      change: Number(d.f169 || 0) / 100,
      volumeRatio: vrRaw / 100,
      turnoverRate: Number(d.f168 || 0) / 100,
      marketCap: Number(d.f116 || 0),
      industry: String(d.f127 || '未知'),
      prevClose: Number(d.f60 || 0) / 100,
      high: Number(d.f44 || 0) / 100,
      low: Number(d.f45 || 0) / 100,
      pe: d.f9 && d.f9 !== '-' ? Number(d.f9) / 100 : null,
      pb: d.f23 && d.f23 !== '-' ? Number(d.f23) / 100 : null,
    };
  } catch { return null; }
}

export async function fetchKlineHistory(code: string, limit = 90): Promise<KlinePoint[]> {
  const secid = getSecId(code);
  const url = `https://push2.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&end=20261231&lmt=${limit}&ut=${EM_UT}&_=${Date.now()}`;
  try {
    const res = await fetch(url, { headers: EM_HEADERS, cache: 'no-store' });
    const json = await res.json();
    const klines: string[] = json?.data?.klines || [];
    return klines.map(line => {
      const p = line.split(',');
      return {
        date: p[0],
        open: Number(p[1]),
        close: Number(p[2]),
        high: Number(p[3]),
        low: Number(p[4]),
        volume: Number(p[5]),
        changePercent: Number(p[8]),
        turnoverRate: Number(p[10]),
      };
    });
  } catch { return []; }
}

export async function fetchFundFlowDays(code: string, days = 5): Promise<FundFlowDay[]> {
  const secid = getSecId(code);
  const urls = [
    `https://push2.eastmoney.com/api/qt/stock/fflow/kline/get?secid=${secid}&lmt=0&klt=101&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56&ut=${EM_UT}&_=${Date.now()}`,
    `https://push2.eastmoney.com/api/qt/stock/fflow/daykline/get?secid=${secid}&lmt=0&klt=101&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56&ut=${EM_UT}&_=${Date.now()}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: EM_HEADERS, cache: 'no-store' });
      const json = await res.json();
      const klines: string[] = json?.data?.klines || [];
      if (!klines.length) continue;
      return klines.slice(-days).map(line => {
        const p = line.split(',');
        return { date: p[0], mainNetInflow: Number(p[1]) || 0, superLargeNetInflow: Number(p[2]) || 0, largeNetInflow: Number(p[3]) || 0 };
      });
    } catch { /* try next */ }
  }
  return [];
}
