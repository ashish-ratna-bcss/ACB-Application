import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Header() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState('light');
  const [search, setSearch] = useState('');

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  };

  const handleLogout = () => {
    sessionStorage.removeItem('acb_auth');
    navigate('/login');
  };
  const themeIcon = theme === 'dark'
    ? 'M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5L19 19M3 12h2M19 12h2M5 19l1.5-1.5M17.5 6.5L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z'
    : 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z';

  return (
    <header style={{ height: '64px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '16px', padding: '0 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', zIndex: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img src="/acb-logo.png" alt="ACB Logo" style={{ width: '40px', height: '40px', objectFit: 'contain', background: '#fff' }} />
        <div style={{ minWidth: 0, flexShrink: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', color: 'var(--text-3)', textTransform: 'uppercase' }}>Anti-Corruption Bureau</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, marginTop: '1px', whiteSpace: 'nowrap' }}>Case Management System</div>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '440px' }}>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)' }}><path d="M21 21l-4.3-4.3"></path><circle cx="11" cy="11" r="7"></circle></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cases…" style={{ width: '100%', height: '38px', padding: '0 14px 0 38px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
          <span style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', fontSize: '10.5px', fontFamily: "'JetBrains Mono',monospace", color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: '5px', padding: '1px 5px' }}>⌘K</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <button onClick={toggleTheme} title="Toggle theme" style={{ width: '38px', height: '38px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={themeIcon}></path></svg>
        </button>
        <button title="Notifications" style={{ position: 'relative', width: '38px', height: '38px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"></path></svg>
        </button>
        <button onClick={handleLogout} title="Logout" style={{ width: '38px', height: '38px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 3l3 3-3 3M19 6h-8a2 2 0 0 0-2 2v2"></path></svg>
        </button>
      </div>
    </header>
  );
}
