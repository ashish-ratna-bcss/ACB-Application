'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell, ChevronDown, Plus, Shield } from 'lucide-react';

interface TopNavProps {
  title?: string;
  subtitle?: string;
}

const NOTIFICATIONS = [
  { id: 1, text: 'AI extraction completed for Case ACB/2024/005', time: '5m ago', type: 'ai', read: false },
  { id: 2, text: 'Case ACB/2024/001 draft is ready for review', time: '2h ago', type: 'draft', read: false },
  { id: 3, text: 'Report exported successfully', time: '1d ago', type: 'export', read: true },
];

export default function TopNav({ title, subtitle }: TopNavProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const unreadCount = NOTIFICATIONS.filter(n => !n.read).length;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) router.push(`/cases?q=${encodeURIComponent(searchQuery)}`);
  }

  return (
    <div className="topnav gap-4">
      {/* Page title */}
      <div className="flex-1 min-w-0">
        {title && (
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight truncate">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
        )}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch}>
        <div className="search-bar">
          <Search size={15} className="text-slate-400 flex-shrink-0" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search cases, officers..."
            aria-label="Search"
          />
        </div>
      </form>

      {/* New Case button */}
      <button
        onClick={() => router.push('/cases/new')}
        className="btn-primary text-sm py-2"
        style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px' }}
      >
        <Plus size={14} />
        New Case
      </button>

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}
          className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <Bell size={18} className="text-slate-600" />
          {unreadCount > 0 && (
            <span
              className="absolute top-1 right-1 w-4 h-4 text-xs rounded-full flex items-center justify-center text-white font-bold"
              style={{ background: '#EF4444', fontSize: '10px' }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {showNotifications && (
          <div
            className="absolute right-0 top-full mt-2 w-80 content-card z-50 py-2 animate-fade-in"
            onMouseLeave={() => setShowNotifications(false)}
          >
            <div className="px-4 py-2 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 text-sm">Notifications</span>
                <span className="text-xs text-blue-600 cursor-pointer hover:underline">Mark all read</span>
              </div>
            </div>
            {NOTIFICATIONS.map(n => (
              <div
                key={n.id}
                className={`px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 ${!n.read ? 'bg-blue-50/50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: n.type === 'ai' ? 'rgba(6,182,212,0.1)' : n.type === 'draft' ? 'rgba(37,99,235,0.1)' : 'rgba(16,185,129,0.1)',
                    }}
                  >
                    <Shield size={13} className={n.type === 'ai' ? 'text-cyan-500' : n.type === 'draft' ? 'text-blue-500' : 'text-green-500'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 leading-relaxed">{n.text}</p>
                    <span className="text-xs text-slate-400 mt-1">{n.time}</span>
                  </div>
                  {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User avatar */}
      <div className="relative">
        <button
          onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
          className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ background: 'linear-gradient(135deg, #2563EB, #06B6D4)' }}
          >
            RK
          </div>
          <div className="hidden md:block text-left">
            <div className="text-sm font-semibold text-slate-700 leading-tight">Insp. Rajesh Kumar</div>
            <div className="text-xs text-slate-400">Investigation Officer</div>
          </div>
          <ChevronDown size={14} className="text-slate-400 hidden md:block" />
        </button>

        {showUserMenu && (
          <div
            className="absolute right-0 top-full mt-2 w-48 content-card z-50 py-2 animate-fade-in"
            onMouseLeave={() => setShowUserMenu(false)}
          >
            {[
              { label: 'My Profile', href: '/settings' },
              { label: 'My Cases', href: '/cases' },
              { label: 'Settings', href: '/settings' },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => { router.push(item.href); setShowUserMenu(false); }}
                className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
              >
                {item.label}
              </button>
            ))}
            <div className="border-t border-slate-100 mt-1 pt-1">
              <button
                onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/'; }}
                className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
