import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import logo from '../assets/acb-emblem.jpeg';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const navIcon = (id) => ({
    dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
    complaints: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
    verification: 'M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
    fir: 'M9 2h6v3H9zM8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2M9 13h6M9 17h6',
    trap: 'M12 2v4M12 18v4M2 12h4M18 12h4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    remand: 'M12 3v18M5 7h14M7 7l-3 7h6zM17 7l-3 7h6zM7 21h10',
    investigation: 'M21 21l-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z',
    reports: 'M3 3v18h18M8 17V9M13 17V5M18 17v-6',
    admin: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
    processor: 'M9 2h6v3H9zM8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2M9 13h6M9 17h6',
    speech: 'M12 1c-6.338 0-12 4.226-12 10.007 0 2.05.738 4.063 2.047 5.625.055 3.107 1.745 5.744 4.549 7.368-1.225-.691-2.435-1.726-3.325-3.073-2.682 1.974-6.271 3.073-10.271 3.073 6.338 0 12-4.226 12-10.007s-5.662-10.007-12-10.007z',
    evidence: 'M4 19V5c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2zm6-11h4v2h-4v-2zm0 4h4v2h-4v-2z',
    court: 'M3 21h18M6 18V9h12v9M4 9h16L12 3zM10 13h4',
    prosecution: 'M9 2h6v3H9zM8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2M9 13h6M9 17h6',
  })[id];

  const currentPath = location.pathname;
  const pathParts = currentPath.split('/').filter(Boolean);
  const phaseRoutes = ['complaints', 'verification', 'approval', 'trap', 'remand', 'investigation', 'evidence', 'court', 'prosecution'];
  const activePhase = pathParts[0] && phaseRoutes.includes(pathParts[0]) ? pathParts[0] : null;

  const workspaceNav = [
    { id: 'dashboard', label: 'Dashboard', path: '/' },
    { id: 'complaints', label: 'Complaints', path: '/complaints', badge: '37' },
    { id: 'processor', label: 'Document Processor', path: '/document-processor' },
    { id: 'reports', label: 'Case Reports', path: '/case-reports' },
    { id: 'speech', label: 'Speech Intelligence', path: '/speech-intelligence' },
    { id: 'settings', label: 'Settings', path: '/settings', iconPath: 'M19 11.5A8.5 8.5 0 0 0 11.5 3H7a5 5 0 0 0-5 5v6a5 5 0 0 0 5 5h4.5a8.5 8.5 0 0 0 7.5-8.5M12 8v4m0 4v-4' },
  ];

  const phaseNav = [
    { id: 'verification', label: 'Verification', route: 'verification', locked: false },
    { id: 'fir', label: 'FIR / Approval', route: 'approval', locked: false },
    { id: 'trap', label: 'Trap Operations', route: 'trap', locked: false },
    { id: 'remand', label: 'Remand', route: 'remand', locked: false },
    { id: 'investigation', label: 'Investigation', route: 'investigation', locked: false },
    { id: 'evidence', label: 'Evidence', route: 'evidence', locked: true },
    { id: 'court', label: 'Court', route: 'court', locked: true },
    { id: 'prosecution', label: 'Prosecution', route: 'prosecution', locked: false },
  ];

  const systemNav = [
    { id: 'reports', label: 'Reports Generator', path: '/reports' },
    { id: 'admin', label: 'Administration', path: '/administration' },
  ];

  const navItemStyle = (isActive) => ({
    position: 'relative',
    width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 14px', margin: '2px 0', border: 'none', background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
    color: isActive ? '#fff' : '#8B9BB4', borderRadius: '10px',
    fontSize: '13.5px', fontWeight: isActive ? 600 : 500, textAlign: 'left',
    transition: 'background 120ms ease, color 120ms ease',
    cursor: 'pointer',
    textDecoration: 'none'
  });

  return (
    <aside style={{ width: '280px', flexShrink: 0, background: '#0E141F', display: 'flex', flexDirection: 'column', borderRight: '1px solid #1C2433' }}>
      <div style={{ height: '64px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px', padding: '0 18px', borderBottom: '1px solid #1A2230' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', boxShadow: '0 0 0 1px rgba(0,200,83,0.4)' }}>
          <img src={logo} alt="ACB" style={{ width: '38px', height: '38px', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#0E141F', display: 'none' }}>🔎</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '0.3px', lineHeight: 1.2 }}>ACB · TELANGANA</div>
          <div style={{ fontSize: '10.5px', fontWeight: 500, color: '#7C8AA0', letterSpacing: '0.4px', textTransform: 'uppercase', marginTop: '1px' }}>Trap Case Management</div>
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '14px 12px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1px', color: '#5A687E', textTransform: 'uppercase', padding: '6px 10px 8px' }}>Workspace</div>
        {workspaceNav.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <button key={item.id} onClick={() => navigate(item.path)} style={navItemStyle(isActive)}>
              <span style={{ position: 'absolute', left: 0, top: '8px', bottom: '8px', width: '3px', borderRadius: '0 3px 3px 0', background: '#00C853', opacity: isActive ? 1 : 0 }}></span>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d={item.iconPath || navIcon(item.id)}></path>
              </svg>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && <span style={{ fontSize: '10.5px', fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", background: 'rgba(0,200,83,0.16)', color: '#3DDC84', padding: '1px 7px', borderRadius: '20px' }}>{item.badge}</span>}
            </button>
          );
        })}

        <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1px', color: '#5A687E', textTransform: 'uppercase', padding: '16px 10px 8px' }}>Case Phases</div>
        {phaseNav.map((item) => {
          const isActive = activePhase === item.route;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (!item.locked) {
                  navigate(`/${item.route}`);
                }
              }}
              style={{
                ...navItemStyle(isActive),
                fontSize: '13px',
                padding: '8px 11px',
                opacity: item.locked ? 0.65 : 1,
                cursor: item.locked ? 'not-allowed' : 'pointer',
              }}
            >
              <span style={{ position: 'absolute', left: 0, top: '7px', bottom: '7px', width: '3px', borderRadius: '0 3px 3px 0', background: '#00C853', opacity: isActive ? 1 : 0 }}></span>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={navIcon(item.id)}></path></svg>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.locked ? (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M7 11V8a5 5 0 0 1 10 0v3"></path>
                  <rect x="5" y="11" width="14" height="10" rx="2"></rect>
                </svg>
              ) : (
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#94A3B8', flexShrink: 0 }}></span>
              )}
            </button>
          );
        })}

        <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1px', color: '#5A687E', textTransform: 'uppercase', padding: '16px 10px 8px' }}>System</div>
        {systemNav.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <button key={item.id} onClick={() => navigate(item.path)} style={navItemStyle(isActive)}>
              <span style={{ position: 'absolute', left: 0, top: '8px', bottom: '8px', width: '3px', borderRadius: '0 3px 3px 0', background: '#00C853', opacity: isActive ? 1 : 0 }}></span>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={navIcon(item.id)}></path></svg>
              <span style={{ flex: 1 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ flexShrink: 0, padding: '12px', borderTop: '1px solid #1A2230', display: 'flex', alignItems: 'center', gap: '11px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'linear-gradient(135deg,#007A33,#00C853)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>PR</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#E6EBF2', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Insp. D. Prakash Reddy</div>
          <div style={{ fontSize: '10.5px', color: '#7C8AA0', marginTop: '1px' }}>CIU · Warangal Range</div>
        </div>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#7C8AA0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"></path></svg>
      </div>
    </aside>
  );
}
