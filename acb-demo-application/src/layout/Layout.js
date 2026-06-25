import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import PageTransitionOverlay from '../components/PageTransitionOverlay';

export default function Layout() {
  useEffect(() => {
    document.documentElement.removeAttribute('data-theme');
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', background: 'var(--bg)', color: 'var(--text)' }}>
      <PageTransitionOverlay />
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header />
        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '24px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
