'use client';

import { useState } from 'react';
import { Shield, User, Bell, Lock, Cpu, Save, CheckCircle } from 'lucide-react';
import TopNav from '@/components/layout/TopNav';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User size={16} /> },
    { id: 'security', label: 'Security', icon: <Lock size={16} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
    { id: 'ai', label: 'AI Settings', icon: <Cpu size={16} /> },
  ];

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav title="Settings" subtitle="Manage your account and preferences" />

      <div className="p-6 max-w-3xl animate-fade-in">
        {/* Tab navigation */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 border border-slate-200 w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'profile' && (
          <div className="space-y-4 animate-fade-in">
            <div className="content-card p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold" style={{ background: 'linear-gradient(135deg, #2563EB, #06B6D4)' }}>RK</div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Insp. Rajesh Kumar</h3>
                  <p className="text-slate-500">Investigation Officer · ACB Hyderabad</p>
                  <p className="text-xs text-slate-400 mt-1">Badge: ACB/HYD/1024</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Full Name', value: 'Insp. Rajesh Kumar' },
                  { label: 'Badge Number', value: 'ACB/HYD/1024' },
                  { label: 'Email', value: 'officer@acb.gov.in' },
                  { label: 'Department', value: 'ACB – Hyderabad Unit' },
                  { label: 'Designation', value: 'Investigation Officer' },
                  { label: 'Mobile', value: '+91-9876543210' },
                ].map(f => (
                  <div key={f.label}>
                    <label className="form-label">{f.label}</label>
                    <input type="text" defaultValue={f.value} className="form-input" />
                  </div>
                ))}
              </div>
            </div>
            <button onClick={save} className="btn-primary">
              {saved ? <><CheckCircle size={16} /> Saved!</> : <><Save size={16} /> Save Changes</>}
            </button>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-4 animate-fade-in">
            <div className="content-card p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Lock size={18} className="text-blue-600" /> Change Password</h3>
              <div className="space-y-4">
                {['Current Password', 'New Password', 'Confirm New Password'].map(f => (
                  <div key={f}>
                    <label className="form-label">{f}</label>
                    <input type="password" className="form-input" placeholder="••••••••" />
                  </div>
                ))}
              </div>
              <button onClick={save} className="btn-primary mt-4"><Save size={16} /> Update Password</button>
            </div>
            <div className="content-card p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Shield size={18} className="text-green-600" /> Security Information</h3>
              <div className="space-y-3">
                {[
                  { label: 'Last Login', value: 'Today, 09:15 AM' },
                  { label: 'Login IP', value: '192.168.1.100' },
                  { label: 'Session Status', value: 'Active' },
                  { label: 'Account Status', value: 'Active & Verified' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-500">{item.label}</span>
                    <span className="text-sm font-semibold text-slate-700">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="content-card p-6 animate-fade-in">
            <h3 className="font-bold text-slate-800 mb-4">Notification Preferences</h3>
            <div className="space-y-4">
              {[
                { label: 'Case Updates', desc: 'Get notified when case status changes', defaultChecked: true },
                { label: 'AI Extraction Complete', desc: 'Notification when AI finishes extracting document data', defaultChecked: true },
                { label: 'Draft Generated', desc: 'Notify when AI generates a new draft', defaultChecked: true },
                { label: 'Review Reminders', desc: 'Remind about pending reviews', defaultChecked: false },
                { label: 'Export Confirmation', desc: 'Confirm when PDFs are exported', defaultChecked: true },
                { label: 'System Alerts', desc: 'Important system-wide notifications', defaultChecked: true },
              ].map(n => (
                <div key={n.label} className="flex items-center justify-between py-3 border-b border-slate-50">
                  <div>
                    <div className="text-sm font-semibold text-slate-700">{n.label}</div>
                    <div className="text-xs text-slate-400">{n.desc}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked={n.defaultChecked} className="sr-only peer" />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                  </label>
                </div>
              ))}
            </div>
            <button onClick={save} className="btn-primary mt-4"><Save size={16} /> Save Preferences</button>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-4 animate-fade-in">
            <div className="content-card p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Cpu size={18} className="text-cyan-600" /> AI Configuration</h3>
              <div className="space-y-4">
                <div>
                  <label className="form-label">OpenAI API Key</label>
                  <input type="password" defaultValue="sk-••••••••••••••••••" className="form-input" />
                  <p className="text-xs text-slate-400 mt-1">Used for AI extraction and draft generation. Leave blank to use mock AI.</p>
                </div>
                <div>
                  <label className="form-label">Default Draft Language</label>
                  <select className="form-select" defaultValue="english">
                    <option value="english">English</option>
                    <option value="telugu">Telugu</option>
                    <option value="hindi">Hindi</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">AI Confidence Threshold</label>
                  <input type="range" min="50" max="100" defaultValue="80" className="w-full" />
                  <div className="flex justify-between text-xs text-slate-400 mt-1"><span>50%</span><span>80% (current)</span><span>100%</span></div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-cyan-50 rounded-xl border border-cyan-100">
                <div className="flex items-center gap-2 text-cyan-700 text-sm font-semibold mb-1">
                  <Cpu size={14} /> AI Status
                </div>
                <p className="text-xs text-cyan-600">AI engine is active. Using mock responses (no API key configured). Add an OpenAI API key to enable real AI extraction.</p>
              </div>
              <button onClick={save} className="btn-primary mt-4"><Save size={16} /> Save AI Settings</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
