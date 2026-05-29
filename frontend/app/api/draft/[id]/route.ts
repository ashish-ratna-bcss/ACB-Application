import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { draftsStore } from '@/lib/store';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const draft = draftsStore.getById(params.id);
  if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(draft);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const updated = draftsStore.update(params.id, body);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
