import { NextRequest, NextResponse } from 'next/server';
import { fetchKlineHistory, normalizeCode } from '@/lib/astock';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const history = await fetchKlineHistory(normalizeCode(code), 90);
  return NextResponse.json({ data: history });
}
