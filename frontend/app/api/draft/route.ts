import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { draftsStore, casesStore, extractionStore, logsStore } from '@/lib/store';
import { generateDraft } from '@/lib/ai-service';
import type { DraftType } from '@/lib/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const caseId = searchParams.get('caseId');

  if (caseId) return NextResponse.json(draftsStore.getByCaseId(caseId));
  return NextResponse.json(draftsStore.getAll());
}

export async function POST(req: NextRequest) {
  try {
    const { caseId, type } = await req.json() as { caseId: string; type: DraftType };
    const userCookie = req.cookies.get('acb_user')?.value;
    const user = userCookie ? JSON.parse(userCookie) : { id: 'user-001', name: 'Insp. Rajesh Kumar' };

    const caseData = casesStore.getById(caseId);
    if (!caseData) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    const extraction = extractionStore.getByCaseId(caseId);

    const caseContext: Record<string, string> = {
      caseNumber: caseData.caseNumber,
      firNumber: caseData.firNumber,
      officerName: caseData.officerName,
      accusedName: caseData.accusedName,
      department: caseData.accusedDepartment,
      designation: caseData.accusedDesignation,
      location: caseData.location,
      incidentDate: caseData.incidentDate,
      amountInvolved: String(caseData.amountInvolved),
      complaintSummary: caseData.complaintSummary,
    };

    const extractionContext: Record<string, unknown> = extraction ? {
      accusedName: extraction.accusedName,
      department: extraction.department,
      bribeAmount: extraction.bribeAmount,
      location: extraction.location,
      officerNames: extraction.officerNames,
      witnessNames: extraction.witnessNames,
      witness1: extraction.witnessNames[0],
      witness2: extraction.witnessNames[1],
    } : {};

    const typeLabels: Record<DraftType, string> = {
      fir: 'First Information Report (FIR)',
      preliminary_report: 'Preliminary Investigation Report',
      remand_report: 'Remand Report',
      final_report: 'Final Investigation Report',
      charge_sheet: 'Charge Sheet',
    };

    const content = await generateDraft(type, caseContext, extractionContext);

    const draft = draftsStore.create({
      caseId,
      type,
      title: `${typeLabels[type]} – ${caseData.caseNumber}`,
      content,
    });

    logsStore.add({
      caseId,
      caseTitle: caseData.title,
      action: 'Draft Generated',
      description: `AI generated ${typeLabels[type]} for case ${caseData.caseNumber}`,
      userId: user.id,
      userName: user.name,
      type: 'draft',
    });

    return NextResponse.json(draft, { status: 201 });
  } catch (err) {
    console.error('Draft generation error:', err);
    return NextResponse.json({ error: 'Draft generation failed' }, { status: 500 });
  }
}
