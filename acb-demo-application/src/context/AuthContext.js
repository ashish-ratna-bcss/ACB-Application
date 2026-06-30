import React, { createContext, useContext, useState } from 'react';

export const USERS = {
  'io@bcss': {
    role: 'io',
    name: 'Insp. D. Prakash Reddy',
    unit: 'CIU · Warangal Range',
    designation: 'Inspector / Trap Officer',
    initials: 'PR',
    color: '#007A33',
    actorId: 'io-001',
  },
  'dsp@bcss': {
    role: 'dsp',
    name: 'DSP Ramesh Kumar',
    unit: 'ACB · Warangal Division',
    designation: 'Dy. Superintendent of Police',
    initials: 'RK',
    color: '#1D4ED8',
    actorId: 'dsp-001',
  },
  'ho@bcss': {
    role: 'ho',
    name: 'Jt. Director V.K. Sharma',
    unit: 'ACB · Head Office · Hyderabad',
    designation: 'Joint Director (Operations)',
    initials: 'VS',
    color: '#7C3AED',
    actorId: 'ho-001',
  },
  'admin@bcss': {
    role: 'admin',
    name: 'System Administrator',
    unit: 'ACB · Administration',
    designation: 'System Admin',
    initials: 'SA',
    color: '#DC2626',
    actorId: 'admin-001',
  },
};

const DEMO_PASSWORD = 'password';

const SESSION_KEY = 'acb_user';

const AuthContext = createContext(null);

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadSession);

  function login(username, password) {
    const userInfo = USERS[username.toLowerCase()];
    if (!userInfo || password !== DEMO_PASSWORD) {
      throw new Error('Invalid credentials');
    }
    const session = { ...userInfo, username: username.toLowerCase() };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    // keep legacy key for RequireAuth guard
    sessionStorage.setItem('acb_auth', '1');
    setUser(session);
    return session;
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('acb_auth');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
