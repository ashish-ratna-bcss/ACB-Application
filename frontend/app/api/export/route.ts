import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logsStore, draftsStore } from '@/lib/store';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function POST(req: NextRequest) {
  try {
    const { caseId, draftId, filename } = await req.json();
    const userCookie = req.cookies.get('acb_user')?.value;
    const user = userCookie ? JSON.parse(userCookie) : { id: 'user-001', name: 'Insp. Rajesh Kumar' };

    const caseRes = await fetch(`${BACKEND}/cases/${caseId}`, { cache: 'no-store' }).catch(() => null);
    const caseData = caseRes?.ok ? await caseRes.json() : null;

    logsStore.add({
      caseId,
      caseTitle: caseData?.title || caseId,
      action: 'Report Exported',
      description: `Final report exported as PDF: ${filename}`,
      userId: user.id,
      userName: user.name,
      type: 'export',
    });

    if (draftId) draftsStore.update(draftId, { status: 'finalized', exportedAt: new Date().toISOString() });

    if (caseData) {
      await fetch(`${BACKEND}/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'finalized' }),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, filename });
  } catch {
    return NextResponse.json({ error: 'Export logging failed' }, { status: 500 });
  }
}
