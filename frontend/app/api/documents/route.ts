import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { documentsStore } from '@/lib/store';
import path from 'path';
import fs from 'fs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const caseId = searchParams.get('caseId');
  if (!caseId) return NextResponse.json({ error: 'caseId required' }, { status: 400 });
  return NextResponse.json(documentsStore.getByCaseId(caseId));
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const caseId = formData.get('caseId') as string;

    if (!file || !caseId) return NextResponse.json({ error: 'file and caseId required' }, { status: 400 });

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', caseId);
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const ext = path.extname(file.name);
    const uniqueName = `${Date.now()}${ext}`;
    const filePath = path.join(uploadsDir, uniqueName);

    const bytes = await file.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(bytes));

    const doc = documentsStore.add({
      caseId,
      fileName: uniqueName,
      originalName: file.name,
      fileType: ext.replace('.', '').toUpperCase(),
      fileSize: file.size,
      uploadDate: new Date().toISOString(),
      ocrStatus: 'uploaded',
      filePath: `/uploads/${caseId}/${uniqueName}`,
      mimeType: file.type,
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
