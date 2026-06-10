# ACB Investigation Platform — Demo Guide

**Audience:** ACB Department Officials  
**Date:** 6 June 2026

---

## 1. Problem Statement _(30 seconds)_

- Manual document review and preparatioon takes hours or days per case
- Officers read through hundreds of pages to extract key facts
- This platform reduces that to **minutes using AI**

---

## 2. Dashboard — System Overview

- Live stats: total cases, pages processed, AI confidence score
- Processing trend chart — demonstrates scale and reliability
- Recent cases table — quick health check of all active cases
- **Live demo:** Ask the chatbot a question about an existing case — show instant, source-cited answer

---

## 3. Document Processor — Upload Flow

- Upload a real case PDF live during demo
- Show pipeline stages executing in real time:
  - Uploading → Extracting → Detecting → Embedding
- Zero manual effort — fully automated from upload to structured data

---

## 4. AI Extraction Results

- Extracted sub-documents: FIR, witness statements, charge sheets, orders, etc.
- Auto-detected fields:
  - Key persons (accused, witnesses, officers)
  - Key dates and timeline
  - Key findings and actions
  - Organizations involved
- Confidence scores on every extraction — proves reliability

---

## 5. RAG Chatbot — Live Q&A

Ask live questions against real case documents:

- _"What was the bribe amount?"_
- _"Who are the key accused persons?"_
- _"List all witnesses mentioned."_
- _"What government posts are involved?"_

Each answer cites the exact source document and page number — **not guesswork, grounded in evidence.**

---

## 6. AI Draft Report Generation

- One click → structured investigation report generated
- Covers: case summary, accused details, evidence, timeline, findings
- Designed for officer review and sign-off — accelerates work, does not replace judgment
- Reports saved and accessible anytime from Case Reports page

---

## 7. Key Differentiators

| Feature                          | Benefit                                                        |
| -------------------------------- | -------------------------------------------------------------- |
| Fully on-premise deployment      | Case data never leaves ACB servers                             |
| RAG-based answers                | Responses grounded in actual documents, no hallucination       |
| Multi-document support           | Handles entire case folders, not just single files             |
| Automatic sub-document detection | FIR, charge sheet, orders detected and separated automatically |
| AI confidence scoring            | Every extraction rated for reliability                         |
| Draft report generation          | Structured reports ready for officer review in minutes         |

---

## 8. Closing — Impact Summary

- **Current load:** X cases, Y pages processed
- **Time saved:** Estimated Z hours per case × case volume = massive ROI
- **Next step:** Pilot with a live case batch from your department

---

## Demo Tips

- Have a **real case PDF ready** to upload live — nothing beats a live demo
- Pre-load one completed case so extraction results are ready to show instantly
- Use the chatbot live — let officials ask their own questions
- Keep problem statement short — they already know the pain point

---

## 9. Competitive Advantage — Why We Beat Others

**Technical Differentiators**

| What | Why It Beats Competitors |
|---|---|
| **100% On-Premise** | Runs on local servers via Ollama — no data sent to OpenAI/cloud. Critical for government classified cases. Competitors rely on cloud APIs. |
| **RAG with Source Citations** | Every chatbot answer cites exact document + page number. Not a black box. Officers can verify. Generic tools just give answers. |
| **Sub-Document Detection** | Automatically splits a 500-page merged case PDF into FIR, charge sheet, witness statements, orders — with confidence scores. Competitors treat it as one blob. |
| **End-to-End Pipeline** | Single upload → structured data → searchable → draft report. Competitors solve only one piece. |
| **Domain-Specific AI** | Tuned for ACB workflows: understands FIR, trap cases, disproportionate assets, DA cases. Generic tools need heavy customization. |
| **AI Draft Report** | Generates a structured investigation report from extracted evidence automatically. Most competitors stop at search. |

**What to Say in Demo**

> *"Unlike generic document tools, this was built ground-up for ACB workflows. Your case data never leaves your server. The AI reads actual evidence — not the internet — so every answer is legally traceable to a source document."*

---

## 10. Future Roadmap *(Signal Long-Term Vision)*

- **Telugu/Hindi OCR support** — regional language documents
- **Audit trail** — who accessed which case, when
- **Role-based access** — IO, SP, DIG permission levels
- **Court-ready export** — PDF reports with exhibit numbering
- **Bulk case import** — migrate legacy case files into the platform
