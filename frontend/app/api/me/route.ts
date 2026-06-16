import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get('acb_user');
  if (!cookie) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  try {
    const user = JSON.parse(cookie.value);
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }
}
