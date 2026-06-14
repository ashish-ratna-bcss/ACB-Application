import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(req: NextRequest) {
  try {
    const caseId = req.nextUrl.searchParams.get('case_id') || '';
    const res = await fetch(`${BACKEND}/media-records?case_id=${encodeURIComponent(caseId)}`, {
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(Array.isArray(data) ? data : [], { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${BACKEND}/media-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to save media record' }, { status: 500 });
  }
}
