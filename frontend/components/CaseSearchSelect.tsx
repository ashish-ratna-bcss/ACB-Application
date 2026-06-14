"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export interface CaseOption {
  id: string;
  caseNumber: string;
  title: string;
}

interface Props {
  cases: CaseOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  dark?: boolean;  // true = trigger styled for dark backgrounds
}

export default function CaseSearchSelect({
  cases,
  value,
  onChange,
  placeholder = "— Select case —",
  disabled = false,
  className = "",
  dark = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = cases.find((c) => c.id === value);

  const filtered = query.trim()
    ? cases.filter(
        (c) =>
          c.caseNumber.toLowerCase().includes(query.toLowerCase()) ||
          c.title.toLowerCase().includes(query.toLowerCase()) ||
          c.id.toLowerCase().includes(query.toLowerCase())
      )
    : cases;

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
    else setQuery("");
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function select(id: string) {
    onChange(id);
    setOpen(false);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition ${
          dark
            ? "bg-white/10 border-white/15 text-white"
            : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        <span className={`truncate ${selected ? (dark ? "text-white" : "text-slate-800") : (dark ? "text-slate-400" : "text-slate-400")}`}>
          {selected ? `${selected.caseNumber} — ${selected.title}` : placeholder}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {value && (
            <span
              onClick={clear}
              className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl overflow-hidden shadow-xl border border-slate-200 bg-white">
          {/* Search input */}
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <Search size={13} className="text-slate-400 flex-shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or case number…"
                className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none min-w-0"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">
                No cases match &ldquo;{query}&rdquo;
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0 ${
                    value === c.id ? "bg-blue-50 text-blue-700" : "text-slate-700"
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                    style={{ background: "linear-gradient(135deg,#2563EB,#06B6D4)" }}
                  >
                    {c.caseNumber.slice(-2)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{c.caseNumber}</div>
                    <div className="text-xs text-slate-500 truncate">{c.title}</div>
                  </div>
                  {value === c.id && (
                    <span className="ml-auto text-xs text-blue-600 font-semibold flex-shrink-0">✓</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
