import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { isPhaseNavLocked } from '../utils/workflow';
import logo from '../assets/acb-emblem.jpeg';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [complaintCount, setComplaintCount] = useState(null);
  const [phaseCounts, setPhaseCounts] = useState({});

  useEffect(() => {
    api.getDashboardKpis()
      .then((d) => {
        setComplaintCount(d?.operational?.totalComplaints ?? null);
        const counts = {};
        (d?.phaseDistribution || []).forEach((p) => { counts[p.phase] = p.count; });
        setPhaseCounts(counts);
      })
      .catch(() => {});
  }, [location.pathname]);

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
  const phaseRoutes = ['verification', 'approval', 'trap', 'remand', 'investigation', 'evidence', 'court', 'prosecution'];
  const activePhase = pathParts[0] && phaseRoutes.includes(pathParts[0]) ? pathParts[0] : null;

  const generalNav = [
    { id: 'dashboard', label: 'Dashboard', path: '/' },
    { id: 'settings', label: 'Settings', path: '/settings', iconPath: 'M19 11.5A8.5 8.5 0 0 0 11.5 3H7a5 5 0 0 0-5 5v6a5 5 0 0 0 5 5h4.5a8.5 8.5 0 0 0 7.5-8.5M12 8v4m0 4v-4' },
  ];

  const workspaceNav = [
    { id: 'processor', label: 'Document Processor', path: '/document-processor' },
    { id: 'reports', label: 'Case Reports', path: '/case-reports' },
    { id: 'speech', label: 'Speech Intelligence', path: '/speech-intelligence' },
  ];

  const phaseNav = [
    { id: 'complaints', label: 'Complaints', route: 'complaints', path: '/complaints', isComplaints: true, badge: complaintCount },
    { id: 'verification', label: 'Verification', route: 'verification' },
    { id: 'fir', label: 'FIR / Approval', route: 'approval' },
    { id: 'trap', label: 'Trap Operations', route: 'trap' },
    { id: 'remand', label: 'Remand', route: 'remand' },
    { id: 'investigation', label: 'Investigation', route: 'investigation' },
    { id: 'evidence', label: 'Evidence', route: 'evidence' },
    { id: 'court', label: 'Court', route: 'court' },
    { id: 'prosecution', label: 'Prosecution', route: 'prosecution' },
  ].map((item) => ({
    ...item,
    locked: item.isComplaints ? false : isPhaseNavLocked(item.route, phaseCounts),
    count: item.isComplaints ? null : phaseCounts[item.route],
  }));

  const systemNav = [
    { id: 'reports', label: 'Reports Generator', path: '/reports' },
    { id: 'admin', label: 'Administration', path: '/administration' },
  ];

  const navItemStyle = (isActive) => ({
    position: 'relative', width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 14px', margin: '2px 0', border: 'none', background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
    color: isActive ? '#fff' : '#8B9BB4', borderRadius: '10px', fontSize: '13.5px', fontWeight: isActive ? 600 : 500,
    textAlign: 'left', transition: 'background 120ms ease', cursor: 'pointer',
  });

  return (
    <aside style={{ width: '280px', flexShrink: 0, background: '#0E141F', display: 'flex', flexDirection: 'column', borderRight: '1px solid #1C2433' }}>
      <div style={{ height: '64px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px', padding: '0 18px', borderBottom: '1px solid #1A2230' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fff', overflow: 'hidden' }}>
          <img src={logo} alt="ACB" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>ACB · TELANGANA</div>
          <div style={{ fontSize: '10.5px', color: '#7C8AA0', textTransform: 'uppercase' }}>Trap Case Management</div>
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '14px 12px' }}>
        <NavSection title="General" items={generalNav} currentPath={currentPath} navigate={navigate} navIcon={navIcon} navItemStyle={navItemStyle} />
        <NavSection title="Case Phases" items={phaseNav} currentPath={currentPath} navigate={navigate} navIcon={navIcon} navItemStyle={navItemStyle} isPhase />
        <NavSection title="Workspace" items={workspaceNav} currentPath={currentPath} navigate={navigate} navIcon={navIcon} navItemStyle={navItemStyle} />
        <NavSection title="System" items={systemNav} currentPath={currentPath} navigate={navigate} navIcon={navIcon} navItemStyle={navItemStyle} />
      </nav>

      <div style={{ flexShrink: 0, padding: '12px', borderTop: '1px solid #1A2230', display: 'flex', alignItems: 'center', gap: '11px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'linear-gradient(135deg,#007A33,#00C853)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '13px' }}>PR</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#E6EBF2' }}>Insp. D. Prakash Reddy</div>
          <div style={{ fontSize: '10.5px', color: '#7C8AA0' }}>CIU · Warangal Range · IO</div>
        </div>
      </div>
    </aside>
  );
}

function NavSection({ title, items, currentPath, navigate, navIcon, navItemStyle, isPhase }) {
  return (
    <>
      <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1px', color: '#5A687E', textTransform: 'uppercase', padding: '6px 10px 8px' }}>{title}</div>
      {items.map((item) => {
        const path = item.path || `/${item.route}`;
        const isActive = isPhase ? currentPath === path : currentPath === item.path;
        return (
          <button
            key={item.id}
            onClick={() => { if (!item.locked) navigate(path); }}
            style={{ ...navItemStyle(isActive), opacity: item.locked ? 0.55 : 1, cursor: item.locked ? 'not-allowed' : 'pointer', fontSize: isPhase ? '13px' : undefined }}
          >
            <span style={{ position: 'absolute', left: 0, top: '8px', bottom: '8px', width: '3px', borderRadius: '0 3px 3px 0', background: '#00C853', opacity: isActive ? 1 : 0 }} />
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={item.iconPath || navIcon(item.id)} /></svg>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge ? <span style={{ fontSize: '10.5px', fontWeight: 700, background: 'rgba(0,200,83,0.16)', color: '#3DDC84', padding: '1px 7px', borderRadius: '20px' }}>{item.badge}</span> : null}
            {item.locked ? <span style={{ fontSize: '10px', color: '#94A3B8' }}>🔒</span> : item.count ? <span style={{ fontSize: '10px', color: '#94A3B8' }}>{item.count}</span> : null}
          </button>
        );
      })}
    </>
  );
}
