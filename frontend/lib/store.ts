import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  CaseDocument, ExtractionData, Draft, ActivityLog,
  DraftType, DocumentStatus
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

const SEED_LOGS: ActivityLog[] = [
  { id: uuidv4(), caseId: 'case-001', caseTitle: 'Bribery Case – Revenue Department Official', action: 'Draft Generated', description: 'AI generated FIR draft for case ACB/2024/001', userId: 'user-001', userName: 'Insp. Rajesh Kumar', timestamp: '2024-01-20T14:30:00.000Z', type: 'draft' },
  { id: uuidv4(), caseId: 'case-002', caseTitle: 'Corruption in PWD Contract Allotment', action: 'Document Uploaded', description: '3 evidence documents uploaded and OCR processed', userId: 'user-001', userName: 'Insp. Rajesh Kumar', timestamp: '2024-01-22T11:00:00.000Z', type: 'upload' },
  { id: uuidv4(), caseId: 'case-004', caseTitle: 'Bribery in Building Permit Issuance', action: 'Report Exported', description: 'Final investigation report exported as PDF', userId: 'user-001', userName: 'Insp. Rajesh Kumar', timestamp: '2024-01-28T16:00:00.000Z', type: 'export' },
  { id: uuidv4(), caseId: 'case-003', caseTitle: 'Misappropriation of Government Funds', action: 'Case Created', description: 'New case created and assigned to Investigation Officer', userId: 'user-001', userName: 'Insp. Rajesh Kumar', timestamp: '2024-01-05T08:00:00.000Z', type: 'create' },
  { id: uuidv4(), caseId: 'case-005', caseTitle: 'Fraud in Welfare Scheme Distribution', action: 'AI Extraction', description: 'AI extracted case data from 2 uploaded documents with 93% confidence', userId: 'user-001', userName: 'Insp. Rajesh Kumar', timestamp: '2024-01-27T10:00:00.000Z', type: 'extraction' },
];

function initLogs(): ActivityLog[] {
  const existing = readJSON<ActivityLog[]>('logs.json', []);
  if (existing.length === 0) { writeJSON('logs.json', SEED_LOGS); return SEED_LOGS; }
  return existing;
}

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
