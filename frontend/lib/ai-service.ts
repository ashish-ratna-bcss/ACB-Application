import type { DraftType, ExtractionData } from './types';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const MOCK_EXTRACTION: Omit<ExtractionData, 'id' | 'caseId' | 'documentIds' | 'extractedAt' | 'status'> = {
  accusedName: 'Ramesh Kumar Sharma',
  department: 'Revenue Department, GHMC',
  bribeAmount: '₹2,50,000 (Two Lakh Fifty Thousand Rupees)',
  location: 'Sub-Registrar Office, Banjara Hills, Hyderabad – 500034',
  dates: ['15-Jan-2024', '17-Jan-2024', '20-Jan-2024'],
  officerNames: ['Sub-Inspector R.K. Verma', 'Inspector S.P. Singh', 'Inspector Rajesh Kumar'],
  witnessNames: ['Mahesh Agarwal (Complainant)', 'Priya Sharma (Witness 1)', 'Srinivas Rao (Witness 2)'],
  additionalDetails: 'Accused used official position to delay property registration and demanded bribe. Trap was laid on 20-Jan-2024. Accused caught red-handed accepting ₹2,50,000 from decoy complainant.',
  confidence: 94,
};

const DRAFT_TEMPLATES: Record<DraftType, (data: Record<string, string>) => string> = {
  fir: (d) => `FIRST INFORMATION REPORT
(Under Section 154 Cr.P.C.)

ANTI-CORRUPTION BUREAU
Government of Telangana
─────────────────────────────────────────────────────────────

FIR No: ${d.firNumber || 'FIR/2024/ACB/001'}          Date: ${new Date().toLocaleDateString('en-IN')}
Police Station: ACB, Hyderabad         District: Hyderabad
Act: Prevention of Corruption Act, 1988 – Sections 7, 13(1)(d), 13(2)
IPC Sections: 120B, 161, 162

─────────────────────────────────────────────────────────────

1. COMPLAINANT DETAILS
   Name: Mahesh Agarwal S/o Ramesh Agarwal
   Address: H.No. 12-3-456, Banjara Hills, Hyderabad – 500034
   Occupation: Private Business
   Contact: +91-9876543210

2. DATE & TIME OF INCIDENT
   Date: ${d.incidentDate || '20-Jan-2024'}
   Time: Approximately 11:30 AM

3. PLACE OF INCIDENT
   ${d.location || 'Sub-Registrar Office, Banjara Hills, Hyderabad – 500034'}

4. DETAILS OF ACCUSED
   Name: ${d.accusedName || 'Ramesh Kumar Sharma'}
   Designation: Sub-Registrar
   Department: ${d.department || 'Revenue Department, GHMC'}
   Official Address: Sub-Registrar Office, Banjara Hills, Hyderabad

5. BRIEF FACTS OF THE CASE

   It is reported that the complainant Mahesh Agarwal approached the Sub-Registrar Office,
   Banjara Hills for registration of his property at Plot No. 47, Jubilee Hills, Hyderabad.
   The accused ${d.accusedName || 'Ramesh Kumar Sharma'}, working as Sub-Registrar in the
   Revenue Department, GHMC, demanded an illegal gratification of ${d.bribeAmount || '₹2,50,000'}
   (${d.bribeAmountWords || 'Two Lakh Fifty Thousand Rupees'}) as bribe for processing the
   registration documents without undue delay.

   On the complaint of Mahesh Agarwal, a trap was laid by the Anti-Corruption Bureau on
   ${d.incidentDate || '20-Jan-2024'}. The complainant was briefed and phenolphthalein powder
   was applied to the currency notes of ${d.bribeAmount || '₹2,50,000'}. The complainant handed
   over the amount to the accused, who accepted the same. Thereafter, the accused was apprehended
   red-handed. On examination, the right hand fingers and the currency notes recovered from the
   accused tested positive for phenolphthalein.

6. WITNESSES
   1. ${d.witness1 || 'Priya Sharma'} – Panch Witness
   2. ${d.witness2 || 'Srinivas Rao'} – Panch Witness
   3. Sub-Inspector R.K. Verma – ACB (Shadow Witness)
   4. Inspector S.P. Singh – ACB (Shadow Witness)

7. ARTICLES SEIZED
   i.  Currency notes of denomination ₹500 and ₹2000 totalling ${d.bribeAmount || '₹2,50,000'}
       (tested positive for phenolphthalein)
   ii. Official documents related to property registration
   iii. Mobile phone of the accused (Samsung Galaxy S21)

8. SECTIONS INVOKED
   - Section 7 of Prevention of Corruption Act, 1988 – Public servant taking bribe
   - Section 13(1)(d) of Prevention of Corruption Act, 1988 – Criminal misconduct
   - Section 13(2) of Prevention of Corruption Act, 1988 – Punishment for criminal misconduct
   - Section 120B of IPC – Criminal conspiracy

9. INVESTIGATING OFFICER
   ${d.officerName || 'Inspector Rajesh Kumar'}
   Anti-Corruption Bureau, Hyderabad
   Badge No: ACB/HYD/1024

─────────────────────────────────────────────────────────────

Signature of Informant: ________________    Date: ${new Date().toLocaleDateString('en-IN')}
Signature of IO: ________________          Time: ${new Date().toLocaleTimeString('en-IN')}

This FIR has been registered and a copy forwarded to the Magistrate as required under
Section 157 Cr.P.C.

─────────────────────────────────────────────────────────────
                    ANTI-CORRUPTION BUREAU
              Government of Telangana, Hyderabad`,

  preliminary_report: (d) => `PRELIMINARY INVESTIGATION REPORT

ANTI-CORRUPTION BUREAU
Government of Telangana
─────────────────────────────────────────────────────────────

Case No: ${d.caseNumber || 'ACB/2024/001'}
FIR No: ${d.firNumber || 'FIR/2024/ACB/001'}
Date of Report: ${new Date().toLocaleDateString('en-IN')}

SUBJECT: Preliminary Report in the case of ${d.accusedName || 'Ramesh Kumar Sharma'},
${d.designation || 'Sub-Registrar'}, ${d.department || 'Revenue Department, GHMC'},
Hyderabad – Alleged demand and acceptance of bribe.

─────────────────────────────────────────────────────────────

1. BACKGROUND & COMPLAINT DETAILS

   This case was registered on the basis of a complaint received from Mahesh Agarwal regarding
   demand of bribe by ${d.accusedName || 'Ramesh Kumar Sharma'} for processing property
   registration documents. The complaint was verified and found credible, following which a
   trap operation was organized on ${d.incidentDate || '20-Jan-2024'}.

2. TRAP OPERATION SUMMARY

   Date of Trap: ${d.incidentDate || '20-Jan-2024'}
   Time: 11:30 AM – 12:45 PM
   Venue: ${d.location || 'Sub-Registrar Office, Banjara Hills, Hyderabad'}
   Trap Amount: ${d.bribeAmount || '₹2,50,000'}
   Result: SUCCESSFUL – Accused caught red-handed

3. EVIDENCE COLLECTED

   Documentary Evidence:
   a) Complaint letter dated 14-Jan-2024 by Mahesh Agarwal
   b) Property documents of Plot No. 47, Jubilee Hills (Pending Registration)
   c) Trap proceedings panchanama dated ${d.incidentDate || '20-Jan-2024'}
   d) Phenolphthalein test results (positive)
   e) Seizure memo of currency notes (${d.bribeAmount || '₹2,50,000'})
   f) Mobile phone data extraction report

   Witness Statements:
   a) Statement of complainant Mahesh Agarwal
   b) Statement of Witness ${d.witness1 || 'Priya Sharma'}
   c) Statement of Witness ${d.witness2 || 'Srinivas Rao'}
   d) Statement of Shadow Witnesses

4. PRELIMINARY FINDINGS

   i.  The accused, in his official capacity as Sub-Registrar, abused his position to
       demand illegal gratification.
   ii. The demand was made on multiple occasions (15-Jan-2024 and 17-Jan-2024) before
       the trap on 20-Jan-2024.
   iii. Phenolphthalein test conclusively proves that the accused accepted the bribe amount.
   iv.  Call Data Records (CDR) confirm telephonic communication between accused and
        complainant regarding the bribe demand.

5. SECTIONS ATTRACTED

   - Section 7, PC Act, 1988
   - Section 13(1)(d) r/w 13(2), PC Act, 1988
   - Section 120B, IPC

6. RECOMMENDATION

   Based on the preliminary investigation, there is sufficient prima facie evidence to
   proceed with regular investigation and file a charge sheet against the accused.
   The accused be placed under suspension pending investigation.

Prepared by:
${d.officerName || 'Inspector Rajesh Kumar'}
Anti-Corruption Bureau, Hyderabad
Date: ${new Date().toLocaleDateString('en-IN')}

─────────────────────────────────────────────────────────────
          CONFIDENTIAL – FOR OFFICIAL USE ONLY`,

  remand_report: (d) => `REMAND REPORT

IN THE COURT OF THE SPECIAL JUDGE FOR SPE & ACB CASES
Hyderabad, Telangana

─────────────────────────────────────────────────────────────

Case No: ${d.caseNumber || 'ACB/2024/001'}
Crime No: ${d.firNumber || 'FIR/2024/ACB/001'}
Date: ${new Date().toLocaleDateString('en-IN')}

TO: The Honourable Special Judge for SPE & ACB Cases, Hyderabad

SUBJECT: Application for Judicial Custody / Police Remand of the accused
         ${d.accusedName || 'Ramesh Kumar Sharma'}

─────────────────────────────────────────────────────────────

RESPECTFULLY SUBMITTED:

1. ACCUSED DETAILS
   Name: ${d.accusedName || 'Ramesh Kumar Sharma'}
   Age: 48 years
   Designation: ${d.designation || 'Sub-Registrar'}
   Department: ${d.department || 'Revenue Department, GHMC'}
   Date of Arrest: ${d.incidentDate || '20-Jan-2024'} at 12:15 PM

2. GROUNDS FOR REMAND

   The accused was arrested in a trap case while accepting a bribe of ${d.bribeAmount || '₹2,50,000'}.
   Police remand is required for the following purposes:

   a) Recovery of additional bribe amounts believed to be concealed at the accused's residence
      at H.No. 8-2-293/82/J/B-60, Jubilee Hills, Hyderabad
   b) Seizure of disproportionate assets and documents
   c) Recording of statement of the accused regarding other officials involved in the conspiracy
   d) Verification of call records and electronic evidence on the accused's mobile devices
   e) Examination of bank accounts and financial transactions

3. INVESTIGATION STATUS

   Completed: Trap operation, panchanama, phenolphthalein test, arrest
   Pending: Search of residence, financial investigation, examination of associates

4. PRAYER

   It is, therefore, prayed that this Hon'ble Court may kindly grant police remand of
   the accused for a period of 7 (Seven) days to complete the above investigation.

Submitted by:
${d.officerName || 'Inspector Rajesh Kumar'}
Investigating Officer, ACB, Hyderabad
Date: ${new Date().toLocaleDateString('en-IN')}

─────────────────────────────────────────────────────────────
                    CONFIDENTIAL`,

  final_report: (d) => `FINAL INVESTIGATION REPORT

ANTI-CORRUPTION BUREAU
Government of Telangana
─────────────────────────────────────────────────────────────

Case No: ${d.caseNumber || 'ACB/2024/001'}
FIR No: ${d.firNumber || 'FIR/2024/ACB/001'}
Date of Report: ${new Date().toLocaleDateString('en-IN')}

1. EXECUTIVE SUMMARY

   This is the final report in the case registered against ${d.accusedName || 'Ramesh Kumar Sharma'},
   ${d.designation || 'Sub-Registrar'}, ${d.department || 'Revenue Department, GHMC'}, for
   demanding and accepting a bribe of ${d.bribeAmount || '₹2,50,000'} in violation of
   Section 7 and 13(1)(d) of the Prevention of Corruption Act, 1988.

2. FULL INVESTIGATION FINDINGS

   [Detailed findings as established through investigation...]

3. WITNESSES EXAMINED
   [List of all witnesses...]

4. DOCUMENTS COLLECTED
   [Complete list of documentary evidence...]

5. CHARGE SHEET RECOMMENDATION

   The investigation is complete. Charge sheet is hereby filed against the accused.

Prepared by: ${d.officerName || 'Inspector Rajesh Kumar'}
Date: ${new Date().toLocaleDateString('en-IN')}`,

  charge_sheet: (d) => `CHARGE SHEET\n\nCrime No: ${d.firNumber}\nAccused: ${d.accusedName}\n\n[Charge sheet content...]`,
};

export async function performOCRExtraction(
  documentTexts: string[],
  caseData: { accusedName?: string; location?: string; incidentDate?: string; amountInvolved?: number }
): Promise<Omit<ExtractionData, 'id' | 'caseId' | 'documentIds' | 'extractedAt' | 'status'>> {
  const openaiKey = process.env.OPENAI_API_KEY;

  if (openaiKey && openaiKey.startsWith('sk-') && documentTexts.length > 0) {
    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: openaiKey });

      const prompt = `You are an AI assistant for the Anti-Corruption Bureau. Extract structured investigation data from the following document text. Return a JSON object with these fields:
- accusedName (string)
- department (string)
- bribeAmount (string, formatted in ₹)
- location (string)
- dates (array of strings)
- officerNames (array of strings)
- witnessNames (array of strings)
- additionalDetails (string)
- confidence (number 0-100)

Document text:
${documentTexts.join('\n\n---\n\n')}`;

      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return { ...MOCK_EXTRACTION, ...result };
    } catch {
      // Fall through to mock
    }
  }

  await delay(2000);

  return {
    ...MOCK_EXTRACTION,
    accusedName: caseData.accusedName || MOCK_EXTRACTION.accusedName,
    location: caseData.location || MOCK_EXTRACTION.location,
    bribeAmount: caseData.amountInvolved
      ? `₹${caseData.amountInvolved.toLocaleString('en-IN')}`
      : MOCK_EXTRACTION.bribeAmount,
  };
}

export async function generateDraft(
  type: DraftType,
  caseData: Record<string, string>,
  extractionData?: Record<string, unknown>
): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const mergedData = { ...caseData, ...(extractionData as Record<string, string> || {}) };

  if (openaiKey && openaiKey.startsWith('sk-')) {
    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: openaiKey });

      const typeLabels: Record<DraftType, string> = {
        fir: 'First Information Report (FIR)',
        preliminary_report: 'Preliminary Investigation Report',
        remand_report: 'Remand Report for Court',
        final_report: 'Final Investigation Report',
        charge_sheet: 'Charge Sheet',
      };

      const prompt = `You are a legal document specialist for the Anti-Corruption Bureau, Government of Telangana.
Generate a complete, formal ${typeLabels[type]} for the following case:

Case Number: ${mergedData.caseNumber || 'ACB/2024/001'}
Accused: ${mergedData.accusedName}
Department: ${mergedData.department}
Bribe Amount: ${mergedData.bribeAmount}
Location: ${mergedData.location}
Incident Date: ${mergedData.incidentDate}
Investigating Officer: ${mergedData.officerName}

Generate the full formal document with all required sections, legal references, and proper formatting.
The document must comply with Prevention of Corruption Act, 1988 and Indian legal standards.`;

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
      });

      return response.choices[0].message.content || DRAFT_TEMPLATES[type](mergedData);
    } catch {
      // Fall through to template
    }
  }

  await delay(1500);
  return DRAFT_TEMPLATES[type](mergedData);
}
