import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logsStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const caseId = searchParams.get('caseId');

  if (caseId) return NextResponse.json(logsStore.getByCaseId(caseId));
  return NextResponse.json(logsStore.getRecent(20));
}
