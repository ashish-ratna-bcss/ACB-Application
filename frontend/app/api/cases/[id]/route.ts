import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { casesStore } from '@/lib/store';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const c = casesStore.getById(params.id);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(c);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const updated = casesStore.update(params.id, body);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Failed to update case' }, { status: 500 });
  }
}
