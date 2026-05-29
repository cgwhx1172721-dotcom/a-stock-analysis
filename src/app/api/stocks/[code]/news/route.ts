import { NextRequest, NextResponse } from 'next/server';
import { normalizeCode } from '@/lib/astock';

const EM_HEADERS = {
  Referer: 'https://finance.eastmoney.com/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await params;
  const code = normalizeCode(rawCode);

  try {
    const url = `https://np-anotice-stock.eastmoney.com/api/security/ann?type=0&page_size=5&page_index=1&stock_list=${code}&client_source=web&_=${Date.now()}`;
    const res = await fetch(url, { headers: EM_HEADERS, cache: 'no-store' });
    const json = await res.json();
    const list: Record<string, unknown>[] = json?.data?.list ?? [];
    const news = list.slice(0, 5).map(item => ({
      title: String(item.NOTICE_TITLE ?? ''),
      url: `https://data.eastmoney.com/notices/detail/${code}/${String(item.REPORT_DATE ?? '')}.html`,
      publishTime: String(item.NOTICE_DATE ?? item.REPORT_DATE ?? ''),
      source: '公告',
    })).filter(n => n.title);
    return NextResponse.json({ news });
  } catch {
    return NextResponse.json({ news: [] });
  }
}
