import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { draftsStore } from '@/lib/store';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { text } = await req.json();
    const userCookie = req.cookies.get('acb_user')?.value;
    const user = userCookie ? JSON.parse(userCookie) : { name: 'Insp. Rajesh Kumar' };
    const updated = draftsStore.addComment(params.id, text, user.name);
    if (!updated) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
}
