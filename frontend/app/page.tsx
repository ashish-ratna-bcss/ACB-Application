"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Eye,
  EyeOff,
  Lock,
  User,
  ChevronRight,
  Cpu,
} from "lucide-react";

const DEMO_CREDENTIALS = [
  {
    email: "officer@acb.gov.in",
    password: "acb@2024",
    role: "Investigation Officer",
  },
  { email: "admin@acb.gov.in", password: "admin@2024", role: "Admin" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid credentials");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(cred: { email: string; password: string }) {
    setEmail(cred.email);
    setPassword(cred.password);
    setError("");
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="login-gradient flex-1 hidden lg:flex flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative grid */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Floating orbs */}
        <div
          className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, #06B6D4, transparent)",
            animation: "float 7s ease-in-out infinite",
          }}
        />
        <div
          className="absolute bottom-1/3 left-1/4 w-48 h-48 rounded-full opacity-15"
          style={{
            background: "radial-gradient(circle, #3B82F6, transparent)",
            animation: "float 5s ease-in-out infinite reverse",
          }}
        />

        {/* Logo */}
        <div className="relative z-10 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-14 h-14 flex items-center justify-center">
              <img
                src="/acb_logo.webp"
                alt="ACB Logo"
                className="w-14 h-14 object-contain"
              />
            </div>
            <div>
              <div className="text-white font-bold text-lg leading-tight">
                Anti-Corruption Bureau
              </div>
              <div className="text-blue-300 text-xs">
                Government of Telangana
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div
          className="relative z-10 animate-slide-up"
          style={{ animationDelay: "0.2s" }}
        >
          {/* AI Brain illustration */}
          <div className="mb-8">
            <div
              className="w-32 h-32 rounded-3xl flex items-center justify-center mx-auto mb-6 ai-glow-pulse"
              style={{
                background:
                  "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(37,99,235,0.2))",
                border: "1px solid rgba(6,182,212,0.3)",
              }}
            >
              <img src="/Logo.png" alt="ACB" className="w-24 h-24 object-contain" />
            </div>

            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              AI-powered
              <br />
              <span className="text-cyan-400">
                Investigation Agent Platform
              </span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed max-w-md">
              Automate investigation workflows with AI-powered document
              extraction, intelligent draft generation, and seamless case
              management.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3">
            {[
              "AI Document Extraction",
              "Smart Draft Generation",
              "Case Management",
              "PDF Export",
              "Activity Logs",
            ].map((feature) => (
              <div
                key={feature}
                className="glass px-4 py-2 rounded-full text-sm text-slate-300 flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                {feature}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-slate-500 text-xs">
          © 2024 Anti-Corruption Bureau, Telangana. Secure Government Portal.
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-[480px] flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-sm animate-slide-in-right">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #06B6D4, #2563EB)",
              }}
            >
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-navy-900 text-base">
                Anti-Corruption Bureau
              </div>
              <div className="text-slate-500 text-xs">
                Government of Telangana
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              Welcome back
            </h2>
            <p className="text-slate-500 text-sm">
              Sign in to the investigation platform
            </p>
          </div>

          {/* Demo credentials */}
          <div className="mb-6 p-4 rounded-xl border border-blue-100 bg-blue-50">
            <p className="text-xs font-600 text-blue-700 mb-3 font-semibold uppercase tracking-wide">
              Demo Access
            </p>
            <div className="space-y-2">
              {DEMO_CREDENTIALS.map((cred) => (
                <button
                  key={cred.email}
                  onClick={() => fillDemo(cred)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-blue-100 text-xs hover:border-blue-300 transition-colors group"
                >
                  <div className="text-left">
                    <div className="font-semibold text-slate-700">
                      {cred.role}
                    </div>
                    <div className="text-slate-400">{cred.email}</div>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-blue-400 group-hover:translate-x-1 transition-transform"
                  />
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email field */}
            <div>
              <label className="form-label">Email / Username</label>
              <div
                className="flex items-center gap-3 border-2 rounded-xl px-4 py-3 bg-white transition-all"
                style={{
                  borderColor: focusedField === "email" ? "#3B82F6" : "#E2E8F0",
                  boxShadow:
                    focusedField === "email"
                      ? "0 0 0 3px rgba(59,130,246,0.1)"
                      : "none",
                }}
              >
                <User size={16} className="text-slate-400 flex-shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="officer@acb.gov.in"
                  className="flex-1 outline-none text-sm text-slate-800 bg-transparent placeholder-slate-400 font-medium"
                  required
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label className="form-label">Password</label>
              <div
                className="flex items-center gap-3 border-2 rounded-xl px-4 py-3 bg-white transition-all"
                style={{
                  borderColor:
                    focusedField === "password" ? "#3B82F6" : "#E2E8F0",
                  boxShadow:
                    focusedField === "password"
                      ? "0 0 0 3px rgba(59,130,246,0.1)"
                      : "none",
                }}
              >
                <Lock size={16} className="text-slate-400 flex-shrink-0" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter your password"
                  className="flex-1 outline-none text-sm text-slate-800 bg-transparent placeholder-slate-400 font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm animate-fade-in">
                <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">!</span>
                </div>
                {error}
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" className="rounded" />
                Remember me
              </label>
              <button
                type="button"
                className="text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary justify-center py-3 text-base"
              style={{ borderRadius: "12px" }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Shield size={16} />
                  Sign In Securely
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
            <p>Protected by Government Security Standards</p>
            <p className="mt-1">All activities are logged and monitored</p>
          </div>
        </div>
      </div>
    </div>
  );
}
