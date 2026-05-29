export type CaseStatus = 'draft' | 'active' | 'under_review' | 'closed' | 'finalized';
export type CaseType = 'bribery' | 'corruption' | 'fraud' | 'misappropriation' | 'abuse_of_power' | 'other';
export type DocumentStatus = 'uploaded' | 'processing' | 'extracted' | 'failed';
export type DraftType = 'fir' | 'preliminary_report' | 'remand_report' | 'final_report' | 'charge_sheet';
export type UserRole = 'investigation_officer' | 'reviewer' | 'senior_officer' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  badge: string;
  designation: string;
}

export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  type: CaseType;
  firNumber: string;
  status: CaseStatus;
  officerId: string;
  officerName: string;
  officerDepartment: string;
  accusedName: string;
  accusedDesignation: string;
  accusedDepartment: string;
  accusedContact: string;
  complaintSummary: string;
  incidentDate: string;
  location: string;
  amountInvolved: number;
  createdAt: string;
  updatedAt: string;
  documentsCount: number;
  draftsCount: number;
  tags: string[];
}

export interface CaseDocument {
  id: string;
  caseId: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  ocrStatus: DocumentStatus;
  extractedText?: string;
  filePath: string;
  mimeType: string;
}

export interface ExtractionData {
  id: string;
  caseId: string;
  documentIds: string[];
  accusedName: string;
  department: string;
  bribeAmount: string;
  location: string;
  dates: string[];
  officerNames: string[];
  witnessNames: string[];
  additionalDetails: string;
  confidence: number;
  extractedAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface DraftComment {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  resolved: boolean;
}

export interface Draft {
  id: string;
  caseId: string;
  type: DraftType;
  title: string;
  content: string;
  status: 'generating' | 'generated' | 'reviewed' | 'finalized';
  generatedAt: string;
  updatedAt: string;
  comments: DraftComment[];
  exportedAt?: string;
}

export interface ActivityLog {
  id: string;
  caseId: string;
  caseTitle: string;
  action: string;
  description: string;
  userId: string;
  userName: string;
  timestamp: string;
  type: 'upload' | 'extraction' | 'draft' | 'export' | 'review' | 'create' | 'update' | 'finalize';
}

export interface DashboardStats {
  totalCases: number;
  draftsGenerated: number;
  pendingReviews: number;
  reportsExported: number;
  activeCases: number;
  casesThisMonth: number;
  monthlyData: { month: string; cases: number; drafts: number }[];
  casesByType: { type: string; count: number }[];
  casesByStatus: { status: string; count: number }[];
}

export interface CreateCasePayload {
  title: string;
  type: CaseType;
  firNumber: string;
  officerDepartment: string;
  accusedName: string;
  accusedDesignation: string;
  accusedDepartment: string;
  accusedContact: string;
  complaintSummary: string;
  incidentDate: string;
  location: string;
  amountInvolved: number;
}
