import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const caseId = (body.caseId as string | undefined)?.trim();
    const fileName = (body.fileName as string | undefined)?.trim();

    if (!caseId || !/^[A-Z0-9-]+$/.test(caseId)) {
      return NextResponse.json({ error: 'Invalid Case ID' }, { status: 400 });
    }
    if (!fileName) {
      return NextResponse.json({ error: 'File name is required' }, { status: 400 });
    }

    // Simulate AI processing delay
    await new Promise(r => setTimeout(r, 800));

    const now = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

    const report = {
      caseId,
      fileName,
      generatedAt: now,
      summary: `This investigation report pertains to Case ID ${caseId}, compiled from the uploaded document "${fileName}". Based on AI-assisted analysis, the document contains evidence relevant to the registered case. The extracted content has been structured into key sections for investigative review by the assigned officer.`,
      sections: [
        {
          title: 'Document Overview',
          content: `The uploaded document "${fileName}" has been scanned and indexed on the secure server. The document appears to contain investigative records, correspondence, or evidence material directly linked to Case ${caseId}. All pages have been processed for text extraction and metadata analysis.`,
        },
        {
          title: 'Key Observations',
          content: `The AI engine identified several key data points within the document including dates, named entities, financial figures, and official designations. These observations have been cross-referenced against the registered case details for ${caseId}. Preliminary analysis indicates consistency with the nature of the complaint on record.`,
        },
        {
          title: 'Evidence Assessment',
          content: `Document integrity checks have been completed. The content is assessed as primary evidentiary material. Key exhibits referenced within the document have been tagged for further forensic examination. The investigating officer is advised to verify the chain of custody for the physical document.`,
        },
        {
          title: 'Recommended Actions',
          content: `Based on the AI analysis, the following actions are recommended: (1) Cross-examine named witnesses referenced in the document, (2) Obtain certified copies of all cited official records, (3) Initiate financial scrutiny of transactions mentioned therein, (4) Escalate findings to the Supervisory Officer for further directions under the PC Act provisions.`,
        },
        {
          title: 'Compliance & Legal References',
          content: `This report has been generated in compliance with ACB Standard Operating Procedures. Relevant legal provisions include Sections 7, 11, 13 of the Prevention of Corruption Act, 1988 (as amended in 2018). All information contained herein is classified and intended solely for authorised personnel involved in Case ${caseId}.`,
        },
      ],
    };

    return NextResponse.json(report, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
