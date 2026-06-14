import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { extractionStore, documentsStore, logsStore } from '@/lib/store';
import { performOCRExtraction } from '@/lib/ai-service';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const caseId = searchParams.get('caseId');
  const docId = searchParams.get('docId');

  if (docId) {
    const doc = documentsStore.getAll().find(d => d.id === docId);
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(doc);
  }

  if (caseId) {
    const extraction = extractionStore.getByCaseId(caseId);
    if (!extraction) return NextResponse.json({ error: 'No extraction found' }, { status: 404 });
    return NextResponse.json(extraction);
  }

  return NextResponse.json({ error: 'caseId or docId required' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { searchParams } = new URL(req.url);

    const caseId = body.caseId || searchParams.get('caseId');
    const docId = body.docId || searchParams.get('docId');

    const userCookie = req.cookies.get('acb_user')?.value;
    const user = userCookie ? JSON.parse(userCookie) : { id: 'user-001', name: 'Insp. Rajesh Kumar' };

    if (docId) {
      documentsStore.updateStatus(docId, 'processing');
      setTimeout(() => documentsStore.updateStatus(docId, 'extracted', 'Mock extracted text'), 2000);
      return NextResponse.json({ status: 'processing' });
    }

    if (!caseId) return NextResponse.json({ error: 'caseId required' }, { status: 400 });

    const caseRes = await fetch(`${BACKEND}/cases/${caseId}`, { cache: 'no-store' }).catch(() => null);
    const caseData = caseRes?.ok ? await caseRes.json() : null;

    const docs = documentsStore.getByCaseId(caseId);
    const docTexts = docs.map(d => d.extractedText || '').filter(Boolean);

    const extracted = await performOCRExtraction(docTexts, {
      accusedName: caseData?.accusedName,
      location: caseData?.location,
      incidentDate: caseData?.incidentDate,
      amountInvolved: caseData?.amountInvolved,
    });

    const result = extractionStore.upsert({
      caseId,
      documentIds: docs.map(d => d.id),
      ...extracted,
      extractedAt: new Date().toISOString(),
      status: 'completed',
    });

    docs.forEach(d => documentsStore.updateStatus(d.id, 'extracted'));

    logsStore.add({
      caseId,
      caseTitle: caseData?.title || caseId,
      action: 'AI Extraction Complete',
      description: `AI extracted data from ${docs.length} document(s) with ${extracted.confidence}% confidence`,
      userId: user.id,
      userName: user.name,
      type: 'extraction',
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Extraction error:', err);
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    const all = extractionStore.getAll();
    const idx = all.findIndex(e => e.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const updated = extractionStore.upsert({ ...all[idx], ...updates });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
