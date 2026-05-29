import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { casesStore } from '@/lib/store';

export async function GET() {
  try {
    const cases = casesStore.getAll();
    return NextResponse.json(cases);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch cases' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userCookie = req.cookies.get('acb_user')?.value;
    const user = userCookie ? JSON.parse(userCookie) : { id: 'user-001', name: 'Insp. Rajesh Kumar' };
    const newCase = casesStore.create(body, user.name, user.id);
    return NextResponse.json(newCase, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create case' }, { status: 500 });
  }
}
