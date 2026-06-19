import { useState } from 'react';

const tabs = [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'security', label: 'Security', icon: '🔒' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'ai', label: 'AI Settings', icon: '🧠' },
];

const profileFields = [
  { label: 'Full Name', value: 'Insp. Rajesh Kumar' },
  { label: 'Badge Number', value: 'ACB/HYD/1024' },
  { label: 'Email', value: 'officer@acb.gov.in' },
  { label: 'Department', value: 'ACB – Hyderabad Unit' },
  { label: 'Designation', value: 'Investigation Officer' },
  { label: 'Mobile', value: '+91-9876543210' },
];

const securityInfo = [
  { label: 'Last Login', value: 'Today, 09:15 AM' },
  { label: 'Login IP', value: '192.168.1.100' },
  { label: 'Session Status', value: 'Active' },
  { label: 'Account Status', value: 'Active & Verified' },
];

const notificationItems = [
  { label: 'Case Updates', desc: 'Get notified when case status changes', defaultChecked: true },
  { label: 'AI Extraction Complete', desc: 'Notification when AI finishes extracting document data', defaultChecked: true },
  { label: 'Draft Generated', desc: 'Notify when AI generates a new draft', defaultChecked: true },
  { label: 'Review Reminders', desc: 'Remind about pending reviews', defaultChecked: false },
  { label: 'Export Confirmation', desc: 'Confirm when PDFs are exported', defaultChecked: true },
  { label: 'System Alerts', desc: 'Important system-wide notifications', defaultChecked: true },
];

const inputStyle = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  fontSize: '12px',
  padding: '10px 11px',
};

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--text-2)',
};

function SaveButton({ saved, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: '1px solid #059669',
        background: 'linear-gradient(135deg,#16A34A,#059669)',
        color: '#FFFFFF',
        borderRadius: '10px',
        fontSize: '12px',
        fontWeight: 700,
        padding: '10px 12px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <span>{saved ? '✅' : '💾'}</span>
      <span>{saved ? 'Saved!' : label}</span>
    </button>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <label style={{ position: 'relative', width: '40px', height: '22px', display: 'inline-block' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '999px',
          border: `1px solid ${checked ? '#059669' : 'var(--border)'}`,
          background: checked ? 'rgba(22,163,74,0.2)' : 'var(--surface-3)',
          transition: 'all 160ms ease',
        }}
      />
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '20px' : '2px',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: checked ? '#16A34A' : '#9CA3AF',
          transition: 'all 160ms ease',
        }}
      />
    </label>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [saved, setSaved] = useState(false);
  const [notif, setNotif] = useState(
    Object.fromEntries(notificationItems.map((item) => [item.label, item.defaultChecked]))
  );

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', display: 'grid', gap: '12px' }}>
      <section
        style={{
          background: 'linear-gradient(135deg,#0E141F 0%,#182735 100%)',
          border: '1px solid #1E3447',
          borderRadius: '14px',
          boxShadow: 'var(--shadow)',
          padding: '20px 22px',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '27px', color: '#F8FAFC' }}>Settings</h1>
        <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#BFD0DF' }}>Manage your account and preferences</p>
      </section>

      <section style={{ border: '1px solid var(--border)', borderRadius: '14px', background: 'var(--surface)', boxShadow: 'var(--shadow)', padding: '14px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: '12px', padding: '6px', width: 'fit-content', background: 'var(--surface-2)' }}>
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  border: '1px solid',
                  borderColor: active ? '#059669' : 'transparent',
                  borderRadius: '9px',
                  background: active ? 'linear-gradient(135deg,#16A34A,#059669)' : 'transparent',
                  color: active ? '#FFFFFF' : 'var(--text-3)',
                  padding: '8px 11px',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === 'profile' ? (
          <div style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#FFFFFF', background: 'linear-gradient(135deg,#16A34A,#059669)' }}>RK</div>
                <div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)' }}>Insp. Rajesh Kumar</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Investigation Officer · ACB Hyderabad</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>Badge: ACB/HYD/1024</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '10px' }}>
                {profileFields.map((field) => (
                  <div key={field.label}>
                    <label style={labelStyle}>{field.label}</label>
                    <input type="text" defaultValue={field.value} style={inputStyle} />
                  </div>
                ))}
              </div>
            </div>
            <SaveButton saved={saved} onClick={save} label="Save Changes" />
          </div>
        ) : null}

        {activeTab === 'security' ? (
          <div style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text)' }}>🔒 Change Password</h3>
              <div style={{ marginTop: '10px', display: 'grid', gap: '10px' }}>
                {['Current Password', 'New Password', 'Confirm New Password'].map((field) => (
                  <div key={field}>
                    <label style={labelStyle}>{field}</label>
                    <input type="password" placeholder="••••••••" style={inputStyle} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '12px' }}>
                <SaveButton saved={saved} onClick={save} label="Update Password" />
              </div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text)' }}>🛡️ Security Information</h3>
              <div style={{ marginTop: '10px', display: 'grid', gap: '0' }}>
                {securityInfo.map((item) => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '9px 0', borderBottom: '1px solid var(--border-2)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{item.label}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-2)', fontWeight: 700 }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'notifications' ? (
          <div style={{ marginTop: '14px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text)' }}>Notification Preferences</h3>
            <div style={{ marginTop: '10px', display: 'grid', gap: '0' }}>
              {notificationItems.map((item) => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border-2)' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-2)', fontWeight: 700 }}>{item.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>{item.desc}</div>
                  </div>
                  <Toggle
                    checked={Boolean(notif[item.label])}
                    onChange={() => setNotif((prev) => ({ ...prev, [item.label]: !prev[item.label] }))}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: '12px' }}>
              <SaveButton saved={saved} onClick={save} label="Save Preferences" />
            </div>
          </div>
        ) : null}

        {activeTab === 'ai' ? (
          <div style={{ marginTop: '14px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text)' }}>🧠 AI Configuration</h3>
            <div style={{ marginTop: '10px', display: 'grid', gap: '10px' }}>
              <div>
                <label style={labelStyle}>OpenAI API Key</label>
                <input type="password" defaultValue="sk-••••••••••••••••••" style={inputStyle} />
                <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-3)' }}>
                  Used for AI extraction and draft generation. Leave blank to use mock AI.
                </div>
              </div>
              <div>
                <label style={labelStyle}>Default Draft Language</label>
                <select defaultValue="english" style={inputStyle}>
                  <option value="english">English</option>
                  <option value="telugu">Telugu</option>
                  <option value="hindi">Hindi</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>AI Confidence Threshold</label>
                <input type="range" min="50" max="100" defaultValue="80" style={{ width: '100%', accentColor: '#16A34A' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px', color: 'var(--text-3)' }}>
                  <span>50%</span>
                  <span>80% (current)</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '12px', border: '1px solid rgba(22,163,74,0.24)', borderRadius: '10px', background: 'rgba(22,163,74,0.08)', padding: '10px' }}>
              <div style={{ fontSize: '12px', color: '#166534', fontWeight: 700 }}>AI Status</div>
              <div style={{ marginTop: '4px', fontSize: '11px', color: '#14532D' }}>
                AI engine is active. Using mock responses (no API key configured). Add an OpenAI API key to enable real AI extraction.
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <SaveButton saved={saved} onClick={save} label="Save AI Settings" />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
