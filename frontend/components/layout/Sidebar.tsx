'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield, LayoutDashboard, FolderOpen,
  Settings, LogOut, Cpu, ChevronRight,
  Scale, BookOpen, FileOutput, FolderSearch, AudioLines
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { href: '/cases', label: 'Cases', icon: <FolderOpen size={18} />, badge: '5' },
  { href: '/generate-report', label: 'Document Processor', icon: <FileOutput size={18} /> },
  { href: '/view-reports', label: 'Case Reports', icon: <FolderSearch size={18} /> },
  { href: '/speech', label: 'Speech Intelligence', icon: <AudioLines size={18} /> },
  { href: '/settings', label: 'Settings', icon: <Settings size={18} /> },
];

export default function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  return (
    <div className="sidebar sidebar-scroll overflow-y-auto">
      {/* Logo */}
      <div className="sidebar-logo">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #06B6D4, #2563EB)' }}
        >
          <Shield size={18} className="text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-slate-800 font-bold text-sm leading-tight truncate">ACB</div>
          <div className="text-slate-400 text-xs truncate">Investigation Platform</div>
        </div>
      </div>

      {/* AI Indicator */}
      <div className="mx-4 mt-4 mb-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.12)' }}>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Cpu size={14} className="text-blue-500" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border border-white" />
          </div>
          <span className="text-blue-600 text-xs font-semibold">AI Engine Active</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <div className="section-header mb-2">NAVIGATION</div>
        {NAV_ITEMS.map(item => (
          <Link key={item.href} href={item.href}>
            <div className={`nav-item ${isActive(item.href) ? 'active' : ''}`}>
              <span className="nav-icon flex-shrink-0">{item.icon}</span>
              <span className="flex-1 text-sm">{item.label}</span>
              {item.badge && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(37,99,235,0.1)', color: '#2563EB' }}
                >
                  {item.badge}
                </span>
              )}
              {isActive(item.href) && <ChevronRight size={14} className="opacity-50" />}
            </div>
          </Link>
        ))}

        <div className="section-header mt-4 mb-2">QUICK LINKS</div>
        {[
          { href: '/cases/new', label: 'New Case', icon: <Scale size={18} /> },
          { href: '/cases', label: 'Evidence Library', icon: <BookOpen size={18} /> },
        ].map(item => (
          <Link key={item.href} href={item.href}>
            <div className="nav-item">
              <span className="nav-icon flex-shrink-0">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </div>
          </Link>
        ))}
      </nav>

      {/* User & Logout */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-2 cursor-pointer hover:bg-slate-50 transition-colors">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
            style={{ background: 'linear-gradient(135deg, #2563EB, #06B6D4)' }}
          >
            RK
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-slate-800 text-sm font-semibold truncate">Insp. Rajesh Kumar</div>
            <div className="text-slate-400 text-xs truncate">Investigation Officer</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="nav-item w-full hover:bg-red-50 transition-colors"
          style={{ margin: 0, color: '#EF4444' }}
        >
          <LogOut size={16} />
          <span className="text-sm">Sign Out</span>
        </button>
      </div>
    </div>
  );
}
