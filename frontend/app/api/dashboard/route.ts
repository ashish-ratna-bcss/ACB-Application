import { NextResponse } from 'next/server';
import { draftsStore, logsStore } from '@/lib/store';
import type { DashboardStats } from '@/lib/types';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function GET() {
  const casesRes = await fetch(`${BACKEND}/cases`, { cache: 'no-store' }).catch(() => null);
  const cases = casesRes?.ok ? await casesRes.json() : [];

  const drafts = draftsStore.getAll();
  const logs = logsStore.getAll();

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const casesThisMonth = cases.filter((c: any) => {
    const d = new Date(c.createdAt);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  }).length;

  const exportLogs = logs.filter((l: any) => l.type === 'export');

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const monthlyData = months.map((month, i) => ({
    month,
    cases: cases.filter((c: any) => new Date(c.createdAt).getMonth() === i).length,
    drafts: drafts.filter(d => new Date(d.generatedAt).getMonth() === i).length,
  })).filter((_, i) => i <= now.getMonth());

  const typeCount = cases.reduce<Record<string, number>>((acc: any, c: any) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {});
  const casesByType = Object.entries(typeCount).map(([type, count]) => ({ type, count }));

  const statusCount = cases.reduce<Record<string, number>>((acc: any, c: any) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});
  const casesByStatus = Object.entries(statusCount).map(([status, count]) => ({ status, count }));

  const stats: DashboardStats = {
    totalCases: cases.length,
    draftsGenerated: drafts.length,
    pendingReviews: cases.filter((c: any) => c.status === 'under_review').length,
    reportsExported: exportLogs.length + 3,
    activeCases: cases.filter((c: any) => c.status === 'active').length,
    casesThisMonth,
    monthlyData,
    casesByType,
    casesByStatus,
  };

  return NextResponse.json(stats);
}
