import { type ClassValue, clsx } from 'clsx';
import type { CaseStatus, CaseType, DraftType } from './types';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return dateString; }
}

export function formatDateTime(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateString; }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getStatusConfig(status: CaseStatus): { label: string; color: string; bg: string } {
  const configs: Record<CaseStatus, { label: string; color: string; bg: string }> = {
    draft: { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-100' },
    active: { label: 'Active', color: 'text-green-700', bg: 'bg-green-100' },
    under_review: { label: 'Under Review', color: 'text-yellow-700', bg: 'bg-yellow-100' },
    closed: { label: 'Closed', color: 'text-red-700', bg: 'bg-red-100' },
    finalized: { label: 'Finalized', color: 'text-blue-700', bg: 'bg-blue-100' },
  };
  return configs[status] || { label: status, color: 'text-gray-600', bg: 'bg-gray-100' };
}

export function getCaseTypeLabel(type: CaseType): string {
  const labels: Record<CaseType, string> = {
    bribery: 'Bribery',
    corruption: 'Corruption',
    fraud: 'Fraud',
    misappropriation: 'Misappropriation',
    abuse_of_power: 'Abuse of Power',
    other: 'Other',
  };
  return labels[type] || type;
}

export function getDraftTypeLabel(type: DraftType): string {
  const labels: Record<DraftType, string> = {
    fir: 'FIR (First Information Report)',
    preliminary_report: 'Preliminary Report',
    remand_report: 'Remand Report',
    final_report: 'Final Investigation Report',
    charge_sheet: 'Charge Sheet',
  };
  return labels[type] || type;
}

export function getRelativeTime(dateString: string): string {
  const now = Date.now();
  const date = new Date(dateString).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(dateString);
}
