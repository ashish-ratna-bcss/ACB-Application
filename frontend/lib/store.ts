import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  Case, CaseDocument, ExtractionData, Draft, ActivityLog,
  CreateCasePayload, DraftType, DocumentStatus
} from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
}

function readJSON<T>(file: string, fallback: T): T {
  ensureDir();
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) { writeJSON(file, fallback); return fallback; }
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) as T; } catch { return fallback; }
}

function writeJSON<T>(file: string, data: T): void {
  ensureDir();
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf-8');
}

function now(): string { return new Date().toISOString(); }

function genCaseNumber(index: number): string {
  return `ACB/${new Date().getFullYear()}/${String(index).padStart(3, '0')}`;
}

const SEED_CASES: Case[] = [
  {
    id: 'case-001', caseNumber: 'ACB/2024/001', title: 'Bribery Case – Revenue Department Official',
    type: 'bribery', firNumber: 'FIR/2024/REV/001', status: 'active',
    officerId: 'user-001', officerName: 'Insp. Rajesh Kumar', officerDepartment: 'ACB – Hyderabad Unit',
    accusedName: 'Ramesh Kumar Sharma', accusedDesignation: 'Sub-Registrar',
    accusedDepartment: 'Revenue Department, GHMC', accusedContact: '+91-9876543210',
    complaintSummary: 'Accused demanded ₹2,50,000 as bribe for processing property registration documents, threatening delay without payment.',
    incidentDate: '2024-01-15', location: 'Sub-Registrar Office, Banjara Hills, Hyderabad',
    amountInvolved: 250000, createdAt: '2024-01-16T09:00:00.000Z', updatedAt: '2024-01-20T14:30:00.000Z',
    documentsCount: 3, draftsCount: 2, tags: ['bribery', 'revenue', 'property'],
  },
  {
    id: 'case-002', caseNumber: 'ACB/2024/002', title: 'Corruption in PWD Contract Allotment',
    type: 'corruption', firNumber: 'FIR/2024/PWD/002', status: 'under_review',
    officerId: 'user-001', officerName: 'Insp. Rajesh Kumar', officerDepartment: 'ACB – Hyderabad Unit',
    accusedName: 'Suresh Babu Naidu', accusedDesignation: 'Executive Engineer',
    accusedDepartment: 'Public Works Department', accusedContact: '+91-9765432109',
    complaintSummary: 'Accused allegedly accepted ₹15,00,000 for awarding road construction contract worth ₹2 crore to a specific firm.',
    incidentDate: '2024-01-08', location: 'PWD Divisional Office, Secunderabad',
    amountInvolved: 1500000, createdAt: '2024-01-10T10:00:00.000Z', updatedAt: '2024-01-22T11:00:00.000Z',
    documentsCount: 5, draftsCount: 3, tags: ['corruption', 'PWD', 'contract'],
  },
  {
    id: 'case-003', caseNumber: 'ACB/2024/003', title: 'Misappropriation of Government Funds',
    type: 'misappropriation', firNumber: 'FIR/2024/FIN/003', status: 'draft',
    officerId: 'user-001', officerName: 'Insp. Rajesh Kumar', officerDepartment: 'ACB – Hyderabad Unit',
    accusedName: 'Priya Venkatesh Rao', accusedDesignation: 'Assistant Accounts Officer',
    accusedDepartment: 'Finance Department, Telangana', accusedContact: '+91-9654321098',
    complaintSummary: 'Accused allegedly misappropriated ₹8,50,000 from district development funds over a period of 6 months.',
    incidentDate: '2023-12-01', location: 'Finance Department, Secretariat, Hyderabad',
    amountInvolved: 850000, createdAt: '2024-01-05T08:00:00.000Z', updatedAt: '2024-01-05T08:00:00.000Z',
    documentsCount: 1, draftsCount: 0, tags: ['misappropriation', 'finance', 'funds'],
  },
  {
    id: 'case-004', caseNumber: 'ACB/2024/004', title: 'Bribery in Building Permit Issuance',
    type: 'bribery', firNumber: 'FIR/2024/GHMC/004', status: 'finalized',
    officerId: 'user-001', officerName: 'Insp. Rajesh Kumar', officerDepartment: 'ACB – Hyderabad Unit',
    accusedName: 'Mohan Reddy Pillai', accusedDesignation: 'Building Inspector',
    accusedDepartment: 'GHMC – Town Planning', accusedContact: '+91-9543210987',
    complaintSummary: 'Accused demanded ₹75,000 to approve building permit that did not conform to approved plans.',
    incidentDate: '2024-01-20', location: 'GHMC Office, Kukatpally, Hyderabad',
    amountInvolved: 75000, createdAt: '2024-01-21T12:00:00.000Z', updatedAt: '2024-01-28T16:00:00.000Z',
    documentsCount: 4, draftsCount: 2, tags: ['bribery', 'GHMC', 'permit'],
  },
  {
    id: 'case-005', caseNumber: 'ACB/2024/005', title: 'Fraud in Welfare Scheme Distribution',
    type: 'fraud', firNumber: 'FIR/2024/WEL/005', status: 'active',
    officerId: 'user-001', officerName: 'Insp. Rajesh Kumar', officerDepartment: 'ACB – Hyderabad Unit',
    accusedName: 'Lakshmi Prasad Iyer', accusedDesignation: 'District Welfare Officer',
    accusedDepartment: 'Social Welfare Department', accusedContact: '+91-9432109876',
    complaintSummary: 'Accused created fictitious beneficiaries and siphoned ₹12,00,000 from a government welfare scheme.',
    incidentDate: '2024-01-25', location: 'District Welfare Office, Nalgonda',
    amountInvolved: 1200000, createdAt: '2024-01-26T09:30:00.000Z', updatedAt: '2024-01-27T10:00:00.000Z',
    documentsCount: 2, draftsCount: 1, tags: ['fraud', 'welfare', 'fictitious'],
  },
];

const SEED_LOGS: ActivityLog[] = [
  { id: uuidv4(), caseId: 'case-001', caseTitle: 'Bribery Case – Revenue Department Official', action: 'Draft Generated', description: 'AI generated FIR draft for case ACB/2024/001', userId: 'user-001', userName: 'Insp. Rajesh Kumar', timestamp: '2024-01-20T14:30:00.000Z', type: 'draft' },
  { id: uuidv4(), caseId: 'case-002', caseTitle: 'Corruption in PWD Contract Allotment', action: 'Document Uploaded', description: '3 evidence documents uploaded and OCR processed', userId: 'user-001', userName: 'Insp. Rajesh Kumar', timestamp: '2024-01-22T11:00:00.000Z', type: 'upload' },
  { id: uuidv4(), caseId: 'case-004', caseTitle: 'Bribery in Building Permit Issuance', action: 'Report Exported', description: 'Final investigation report exported as PDF', userId: 'user-001', userName: 'Insp. Rajesh Kumar', timestamp: '2024-01-28T16:00:00.000Z', type: 'export' },
  { id: uuidv4(), caseId: 'case-003', caseTitle: 'Misappropriation of Government Funds', action: 'Case Created', description: 'New case created and assigned to Investigation Officer', userId: 'user-001', userName: 'Insp. Rajesh Kumar', timestamp: '2024-01-05T08:00:00.000Z', type: 'create' },
  { id: uuidv4(), caseId: 'case-005', caseTitle: 'Fraud in Welfare Scheme Distribution', action: 'AI Extraction', description: 'AI extracted case data from 2 uploaded documents with 93% confidence', userId: 'user-001', userName: 'Insp. Rajesh Kumar', timestamp: '2024-01-27T10:00:00.000Z', type: 'extraction' },
];

function initCases(): Case[] {
  const existing = readJSON<Case[]>('cases.json', []);
  if (existing.length === 0) { writeJSON('cases.json', SEED_CASES); return SEED_CASES; }
  return existing;
}

function initLogs(): ActivityLog[] {
  const existing = readJSON<ActivityLog[]>('logs.json', []);
  if (existing.length === 0) { writeJSON('logs.json', SEED_LOGS); return SEED_LOGS; }
  return existing;
}

export const casesStore = {
  getAll(): Case[] { return initCases(); },

  getById(id: string): Case | undefined {
    return this.getAll().find(c => c.id === id);
  },

  create(payload: CreateCasePayload, officerName: string, officerId: string): Case {
    const cases = this.getAll();
    const newCase: Case = {
      id: uuidv4(),
      caseNumber: genCaseNumber(cases.length + 1),
      ...payload,
      officerId,
      officerName,
      status: 'active',
      createdAt: now(),
      updatedAt: now(),
      documentsCount: 0,
      draftsCount: 0,
      tags: [],
    };
    cases.push(newCase);
    writeJSON('cases.json', cases);
    logsStore.add({ caseId: newCase.id, caseTitle: newCase.title, action: 'Case Created', description: `New case ${newCase.caseNumber} created`, userId: officerId, userName: officerName, type: 'create' });
    return newCase;
  },

  update(id: string, updates: Partial<Case>): Case | null {
    const cases = this.getAll();
    const idx = cases.findIndex(c => c.id === id);
    if (idx === -1) return null;
    cases[idx] = { ...cases[idx], ...updates, updatedAt: now() };
    writeJSON('cases.json', cases);
    return cases[idx];
  },

  incrementDocuments(id: string): void {
    const c = this.getById(id);
    if (c) this.update(id, { documentsCount: c.documentsCount + 1 });
  },

  incrementDrafts(id: string): void {
    const c = this.getById(id);
    if (c) this.update(id, { draftsCount: c.draftsCount + 1 });
  },
};

export const documentsStore = {
  getAll(): CaseDocument[] { return readJSON<CaseDocument[]>('documents.json', []); },

  getByCaseId(caseId: string): CaseDocument[] {
    return this.getAll().filter(d => d.caseId === caseId);
  },

  add(doc: Omit<CaseDocument, 'id'>): CaseDocument {
    const docs = this.getAll();
    const newDoc: CaseDocument = { id: uuidv4(), ...doc };
    docs.push(newDoc);
    writeJSON('documents.json', docs);
    casesStore.incrementDocuments(doc.caseId);
    return newDoc;
  },

  updateStatus(id: string, status: DocumentStatus, extractedText?: string): void {
    const docs = this.getAll();
    const idx = docs.findIndex(d => d.id === id);
    if (idx !== -1) {
      docs[idx].ocrStatus = status;
      if (extractedText) docs[idx].extractedText = extractedText;
      writeJSON('documents.json', docs);
    }
  },
};

export const extractionStore = {
  getAll(): ExtractionData[] { return readJSON<ExtractionData[]>('extractions.json', []); },

  getByCaseId(caseId: string): ExtractionData | undefined {
    return this.getAll().find(e => e.caseId === caseId);
  },

  upsert(data: Omit<ExtractionData, 'id'>): ExtractionData {
    const all = this.getAll();
    const existing = all.findIndex(e => e.caseId === data.caseId);
    if (existing !== -1) {
      all[existing] = { id: all[existing].id, ...data };
      writeJSON('extractions.json', all);
      return all[existing];
    }
    const newData: ExtractionData = { id: uuidv4(), ...data };
    all.push(newData);
    writeJSON('extractions.json', all);
    return newData;
  },
};

export const draftsStore = {
  getAll(): Draft[] { return readJSON<Draft[]>('drafts.json', []); },

  getByCaseId(caseId: string): Draft[] {
    return this.getAll().filter(d => d.caseId === caseId);
  },

  getById(id: string): Draft | undefined {
    return this.getAll().find(d => d.id === id);
  },

  create(data: { caseId: string; type: DraftType; title: string; content: string }): Draft {
    const drafts = this.getAll();
    const newDraft: Draft = {
      id: uuidv4(),
      ...data,
      status: 'generated',
      generatedAt: now(),
      updatedAt: now(),
      comments: [],
    };
    drafts.push(newDraft);
    writeJSON('drafts.json', drafts);
    casesStore.incrementDrafts(data.caseId);
    return newDraft;
  },

  update(id: string, updates: Partial<Draft>): Draft | null {
    const drafts = this.getAll();
    const idx = drafts.findIndex(d => d.id === id);
    if (idx === -1) return null;
    drafts[idx] = { ...drafts[idx], ...updates, updatedAt: now() };
    writeJSON('drafts.json', drafts);
    return drafts[idx];
  },

  addComment(id: string, text: string, author: string): Draft | null {
    const draft = this.getById(id);
    if (!draft) return null;
    const comment = { id: uuidv4(), text, author, createdAt: now(), resolved: false };
    return this.update(id, { comments: [...draft.comments, comment] });
  },
};

export const logsStore = {
  getAll(): ActivityLog[] { return initLogs(); },

  getRecent(limit = 20): ActivityLog[] {
    return this.getAll()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  },

  getByCaseId(caseId: string): ActivityLog[] {
    return this.getAll().filter(l => l.caseId === caseId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  add(log: Omit<ActivityLog, 'id' | 'timestamp'>): ActivityLog {
    const logs = this.getAll();
    const newLog: ActivityLog = { id: uuidv4(), timestamp: now(), ...log };
    logs.push(newLog);
    writeJSON('logs.json', logs);
    return newLog;
  },
};
