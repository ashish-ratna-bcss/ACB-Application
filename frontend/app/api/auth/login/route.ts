import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const USERS = [
  { id: 'user-001', email: 'officer@acb.gov.in', password: 'acb@2024', name: 'Insp. Rajesh Kumar', role: 'investigation_officer', department: 'ACB – Hyderabad Unit', badge: 'ACB/HYD/1024', designation: 'Investigation Officer' },
  { id: 'user-002', email: 'admin@acb.gov.in', password: 'admin@2024', name: 'Admin User', role: 'admin', department: 'ACB – Headquarters', badge: 'ACB/HQ/001', designation: 'System Administrator' },
];

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const user = USERS.find(u => u.email === email && u.password === password);

  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials. Please check your email and password.' }, { status: 401 });
  }

  const { password: _, ...safeUser } = user;

  const response = NextResponse.json({ user: safeUser, message: 'Login successful' });
  response.cookies.set('acb_user', JSON.stringify(safeUser), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  return response;
}
