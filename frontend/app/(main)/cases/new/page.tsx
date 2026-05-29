"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  CheckCircle,
  User,
  Building,
  FileText,
  MapPin,
} from "lucide-react";
import TopNav from "@/components/layout/TopNav";
import type { CaseType } from "@/lib/types";

const CASE_TYPES: { value: CaseType; label: string }[] = [
  { value: "bribery", label: "Bribery" },
  { value: "corruption", label: "Corruption" },
  { value: "fraud", label: "Fraud" },
  { value: "misappropriation", label: "Misappropriation" },
  { value: "abuse_of_power", label: "Abuse of Power" },
  { value: "other", label: "Other" },
];

const DEPARTMENTS = [
  "Revenue Department",
  "Public Works Department",
  "Finance Department",
  "Municipal Corporation",
  "Police Department",
  "Health Department",
  "Education Department",
  "Social Welfare Department",
  "Transport Department",
  "Agriculture Department",
  "Other",
];

interface FormData {
  title: string;
  type: CaseType;
  firNumber: string;
  officerDepartment: string;
  accusedName: string;
  accusedDesignation: string;
  accusedDepartment: string;
  accusedContact: string;
  complaintSummary: string;
  incidentDate: string;
  location: string;
  amountInvolved: string;
}

const INITIAL: FormData = {
  title: "",
  type: "bribery",
  firNumber: "",
  officerDepartment: "ACB – Hyderabad Unit",
  accusedName: "",
  accusedDesignation: "",
  accusedDepartment: "",
  accusedContact: "",
  complaintSummary: "",
  incidentDate: "",
  location: "",
  amountInvolved: "",
};

const SECTIONS = [
  { id: "case", label: "Case Information", icon: <FileText size={16} /> },
  { id: "accused", label: "Accused Details", icon: <User size={16} /> },
  { id: "complaint", label: "Complaint Details", icon: <MapPin size={16} /> },
];

export default function NewCasePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [activeSection, setActiveSection] = useState("case");

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const newErrors: Partial<FormData> = {};
    if (!form.title.trim()) newErrors.title = "Case title is required";
    if (!form.firNumber.trim()) newErrors.firNumber = "FIR number is required";
    if (!form.accusedName.trim())
      newErrors.accusedName = "Accused name is required";
    if (!form.accusedDesignation.trim())
      newErrors.accusedDesignation = "Designation is required";
    if (!form.accusedDepartment.trim())
      newErrors.accusedDepartment = "Department is required";
    if (!form.complaintSummary.trim())
      newErrors.complaintSummary = "Complaint summary is required";
    if (!form.incidentDate)
      newErrors.incidentDate = "Incident date is required";
    if (!form.location.trim()) newErrors.location = "Location is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amountInvolved: parseFloat(form.amountInvolved) || 0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push(`/cases/${data.id}`), 1500);
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopNav title="Create New Case" />
        <div className="flex items-center justify-center flex-1">
          <div className="text-center animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={40} className="text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              Case Created Successfully
            </h2>
            <p className="text-slate-500">Redirecting to case details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav
        title="Create New Case"
        subtitle="Register a new investigation case"
      />

      <div className="p-6 max-w-4xl mx-auto w-full animate-fade-in">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Cases
        </button>

        {/* Section Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 border border-slate-200 w-fit">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSection === s.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Case Information */}
            {activeSection === "case" && (
              <div className="content-card p-6 animate-fade-in">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl metric-icon-blue flex items-center justify-center">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">
                      Case Information
                    </h3>
                    <p className="text-xs text-slate-500">
                      Basic case details and classification
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="form-label">
                      Case Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => update("title", e.target.value)}
                      placeholder="e.g., Bribery Case – Revenue Department Official"
                      className={`form-input ${errors.title ? "border-red-400" : ""}`}
                    />
                    {errors.title && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.title}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="form-label">
                      Case Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.type}
                      onChange={(e) => update("type", e.target.value)}
                      className="form-select"
                    >
                      {CASE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">
                      FIR Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.firNumber}
                      onChange={(e) => update("firNumber", e.target.value)}
                      placeholder="e.g., FIR/2024/ACB/001"
                      className={`form-input ${errors.firNumber ? "border-red-400" : ""}`}
                    />
                    {errors.firNumber && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.firNumber}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="form-label">
                      Investigating Department
                    </label>
                    <select
                      value={form.officerDepartment}
                      onChange={(e) =>
                        update("officerDepartment", e.target.value)
                      }
                      className="form-select"
                    >
                      <option>ACB – Hyderabad Unit</option>
                      <option>ACB – Warangal Unit</option>
                      <option>ACB – Vijayawada Unit</option>
                      <option>ACB – Headquarters</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end mt-6">
                  <button
                    type="button"
                    onClick={() => setActiveSection("accused")}
                    className="btn-primary"
                  >
                    Next: Accused Details →
                  </button>
                </div>
              </div>
            )}

            {/* Accused Information */}
            {activeSection === "accused" && (
              <div className="content-card p-6 animate-fade-in">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl metric-icon-red flex items-center justify-center">
                    <User size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">
                      Accused Information
                    </h3>
                    <p className="text-xs text-slate-500">
                      Details of the accused government official
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">
                      Accused Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.accusedName}
                      onChange={(e) => update("accusedName", e.target.value)}
                      placeholder="e.g., Ramesh Kumar Sharma"
                      className={`form-input ${errors.accusedName ? "border-red-400" : ""}`}
                    />
                    {errors.accusedName && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.accusedName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="form-label">
                      Designation / Post <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.accusedDesignation}
                      onChange={(e) =>
                        update("accusedDesignation", e.target.value)
                      }
                      placeholder="e.g., Sub-Registrar"
                      className={`form-input ${errors.accusedDesignation ? "border-red-400" : ""}`}
                    />
                    {errors.accusedDesignation && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.accusedDesignation}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="form-label">
                      Accused Department <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.accusedDepartment}
                      onChange={(e) =>
                        update("accusedDepartment", e.target.value)
                      }
                      className={`form-select ${errors.accusedDepartment ? "border-red-400" : ""}`}
                    >
                      <option value="">Select Department</option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    {errors.accusedDepartment && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.accusedDepartment}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="form-label">Contact Number</label>
                    <input
                      type="text"
                      value={form.accusedContact}
                      onChange={(e) => update("accusedContact", e.target.value)}
                      placeholder="+91-9876543210"
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="flex justify-between mt-6">
                  <button
                    type="button"
                    onClick={() => setActiveSection("case")}
                    className="btn-secondary"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection("complaint")}
                    className="btn-primary"
                  >
                    Next: Complaint Details →
                  </button>
                </div>
              </div>
            )}

            {/* Complaint Details */}
            {activeSection === "complaint" && (
              <div className="content-card p-6 animate-fade-in">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl metric-icon-amber flex items-center justify-center">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">
                      Complaint Details
                    </h3>
                    <p className="text-xs text-slate-500">
                      Incident information and complaint summary
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="form-label">
                      Complaint Summary <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={form.complaintSummary}
                      onChange={(e) =>
                        update("complaintSummary", e.target.value)
                      }
                      placeholder="Describe the nature of the complaint, sequence of events, and how the accused demanded/accepted the bribe..."
                      rows={5}
                      className={`form-input resize-none ${errors.complaintSummary ? "border-red-400" : ""}`}
                    />
                    {errors.complaintSummary && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.complaintSummary}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="form-label">
                      Incident Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.incidentDate}
                      onChange={(e) => update("incidentDate", e.target.value)}
                      className={`form-input ${errors.incidentDate ? "border-red-400" : ""}`}
                    />
                    {errors.incidentDate && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.incidentDate}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="form-label">Amount Involved (₹)</label>
                    <input
                      type="number"
                      value={form.amountInvolved}
                      onChange={(e) => update("amountInvolved", e.target.value)}
                      placeholder="e.g., 250000"
                      className="form-input"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="form-label">
                      Incident Location <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) => update("location", e.target.value)}
                      placeholder="e.g., Sub-Registrar Office, Banjara Hills, Hyderabad"
                      className={`form-input ${errors.location ? "border-red-400" : ""}`}
                    />
                    {errors.location && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.location}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-between mt-6">
                  <button
                    type="button"
                    onClick={() => setActiveSection("accused")}
                    className="btn-secondary"
                  >
                    ← Back
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        setLoading(true);
                        const res = await fetch("/api/cases", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            ...form,
                            amountInvolved:
                              parseFloat(form.amountInvolved) || 0,
                            status: "draft",
                          }),
                        });
                        if (res.ok) {
                          const d = await res.json();
                          router.push(`/cases/${d.id}`);
                        }
                        setLoading(false);
                      }}
                      className="btn-secondary"
                      disabled={loading}
                    >
                      <Save size={16} /> Save Draft
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                          Creating...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} /> Create Case
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mt-6">
          {SECTIONS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`step-dot text-xs font-bold ${
                  activeSection === s.id
                    ? "bg-blue-600 text-white"
                    : SECTIONS.findIndex((x) => x.id === activeSection) > i
                      ? "bg-green-500 text-white"
                      : "bg-slate-200 text-slate-400"
                }`}
              >
                {SECTIONS.findIndex((x) => x.id === activeSection) > i
                  ? "✓"
                  : i + 1}
              </div>
              <span
                className={`text-xs font-medium ${activeSection === s.id ? "text-blue-600" : "text-slate-400"}`}
              >
                {s.label}
              </span>
              {i < SECTIONS.length - 1 && (
                <div className="w-8 h-0.5 bg-slate-200" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
