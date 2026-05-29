import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logsStore, casesStore, draftsStore } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const { caseId, draftId, filename } = await req.json();
    const userCookie = req.cookies.get('acb_user')?.value;
    const user = userCookie ? JSON.parse(userCookie) : { id: 'user-001', name: 'Insp. Rajesh Kumar' };

    const caseData = casesStore.getById(caseId);

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
    if (caseData) casesStore.update(caseId, { status: 'finalized' });

    return NextResponse.json({ success: true, filename });
  } catch {
    return NextResponse.json({ error: 'Export logging failed' }, { status: 500 });
  }
}
