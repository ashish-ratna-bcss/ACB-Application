import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth, USERS } from '../context/AuthContext';

const ROLE_LABELS = {
  io: 'Inspector / Trap Officer',
  dsp: 'Dy. Superintendent of Police',
  ho: 'Joint Director (Operations)',
  admin: 'System Administrator',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [transitioning, setTransitioning] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Enter username and password');
      return;
    }
    try {
      login(username, password);
      setTransitioning(true);
      setTimeout(() => navigate('/'), 2500);
    } catch {
      setError('Invalid username or password');
    }
  };

  // Post-login transition: animated logo
  if (transitioning) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        perspective: '1000px',
      }}>
        <motion.img
          src={`${process.env.PUBLIC_URL}/acb-logo.png`}
          alt="ACB Logo"
          initial={{ rotateY: -180, opacity: 0 }}
          animate={{ rotateY: 720, opacity: 1 }}
          exit={{ rotateY: 180, opacity: 0 }}
          transition={{ duration: 2, ease: 'easeInOut' }}
          style={{
            width: '200px',
            height: '200px',
            objectFit: 'contain',
          }}
        />
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#060C14',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* Subtle radial glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(37,99,235,0.14) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Login card */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 28,
        padding: '44px 40px',
        background: 'rgba(8,16,28,0.72)',
        borderRadius: 18,
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(18px)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
        minWidth: 360,
        maxWidth: 420,
        width: '100%',
      }}>
        {/* Branding */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 80, height: 80,
            padding: 3,
            background: 'linear-gradient(135deg, rgba(37,99,235,0.6), rgba(29,78,216,0.3))',
          }}>
            <img
              src={`${process.env.PUBLIC_URL}/acb-logo.png`}
              alt="ACB"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#F1F5F9', fontWeight: 700, fontSize: 21, letterSpacing: '-0.4px', lineHeight: 1.2 }}>
              ACB Intelligence Suite
            </div>
            <div style={{ color: '#8597AD', fontSize: 12.5, marginTop: 5, letterSpacing: '0.3px' }}>
              Anti-Corruption Bureau · Telangana
            </div>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleLogin}
          style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}
        >
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(''); }}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.05)',
              color: '#F1F5F9',
              fontSize: 14,
              outline: 'none',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'rgba(37,99,235,0.6)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.10)'; }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.05)',
              color: '#F1F5F9',
              fontSize: 14,
              outline: 'none',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'rgba(37,99,235,0.6)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.10)'; }}
          />
          {error && (
            <div style={{ color: '#F87171', fontSize: 12.5, marginTop: -4 }}>{error}</div>
          )}
          <button
            type="submit"
            style={{
              marginTop: 4,
              padding: '11px 0',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #1D4ED8, #2563EB)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14.5,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(37,99,235,0.35)',
            }}
          >
            Sign In
          </button>
        </form>

        {/* Demo credentials hint */}
        <div style={{ width: '100%', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#5A687E', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 7 }}>Demo Credentials</div>
          {Object.entries(USERS).map(([uname, info]) => (
            <button
              key={uname}
              type="button"
              onClick={() => { setUsername(uname); setPassword('password'); setError(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 0', borderRadius: 4 }}
            >
              <span style={{ width: 22, height: 22, borderRadius: 6, background: info.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{info.initials}</span>
              <span style={{ fontSize: 11, color: '#7C8AA0', textAlign: 'left' }}>
                <span style={{ color: '#A0B0C8', fontWeight: 600 }}>{uname}</span>
                <span style={{ marginLeft: 5, color: '#4A5568' }}>· {ROLE_LABELS[info.role]}</span>
              </span>
            </button>
          ))}
          <div style={{ fontSize: 10, color: '#3A4A5E', marginTop: 5 }}>Password: <span style={{ fontFamily: 'monospace', color: '#5A6A7E' }}>password</span> for all</div>
        </div>

        <div style={{ color: 'rgba(133,151,173,0.45)', fontSize: 11, textAlign: 'center' }}>
          Secure Government Portal · v2.0
        </div>
      </div>
    </div>
  );
}
