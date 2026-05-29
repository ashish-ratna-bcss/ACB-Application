import { NextResponse } from 'next/server';
import { casesStore, draftsStore, logsStore } from '@/lib/store';
import type { DashboardStats } from '@/lib/types';

export async function GET() {
  const cases = casesStore.getAll();
  const drafts = draftsStore.getAll();
  const logs = logsStore.getAll();

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const casesThisMonth = cases.filter(c => {
    const d = new Date(c.createdAt);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  }).length;

  const exportLogs = logs.filter(l => l.type === 'export');

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const monthlyData = months.map((month, i) => ({
    month,
    cases: cases.filter(c => new Date(c.createdAt).getMonth() === i).length,
    drafts: drafts.filter(d => new Date(d.generatedAt).getMonth() === i).length,
  })).filter((_, i) => i <= now.getMonth());

  const typeCount = cases.reduce<Record<string, number>>((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {});
  const casesByType = Object.entries(typeCount).map(([type, count]) => ({ type, count }));

  const statusCount = cases.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});
  const casesByStatus = Object.entries(statusCount).map(([status, count]) => ({ status, count }));

  const stats: DashboardStats = {
    totalCases: cases.length,
    draftsGenerated: drafts.length,
    pendingReviews: cases.filter(c => c.status === 'under_review').length,
    reportsExported: exportLogs.length + 3,
    activeCases: cases.filter(c => c.status === 'active').length,
    casesThisMonth,
    monthlyData,
    casesByType,
    casesByStatus,
  };

  return NextResponse.json(stats);
}
