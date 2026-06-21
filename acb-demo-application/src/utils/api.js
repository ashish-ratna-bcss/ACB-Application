export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

async function request(path, options = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail?.message || body.detail || JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === 'string' ? detail : 'Request failed');
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getDashboardKpis: () => request('/dashboard/kpis'),
  getComplaints: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/complaints${q ? `?${q}` : ''}`);
  },
  createComplaint: (body) => request('/complaints', { method: 'POST', body: JSON.stringify(body) }),
  submitComplaint: (id) => request(`/complaints/${id}/submit`, { method: 'POST' }),
  getCasesByPhase: (phase, params = {}) => {
    const q = new URLSearchParams({ phase, ...params }).toString();
    return request(`/workflow/cases?${q}`);
  },
  getCaseWorkflow: (caseId, viewPhase) => {
    const q = viewPhase ? `?viewPhase=${encodeURIComponent(viewPhase)}` : '';
    return request(`/workflow/cases/${encodeURIComponent(caseId)}${q}`);
  },
  transitionCase: (caseId, body) =>
    request(`/workflow/cases/${encodeURIComponent(caseId)}/transition`, { method: 'POST', body: JSON.stringify(body) }),
  updateCheckpoint: (caseId, body) =>
    request(`/workflow/cases/${encodeURIComponent(caseId)}/checkpoints`, { method: 'PATCH', body: JSON.stringify(body) }),
  patchPhaseData: (caseId, body) =>
    request(`/workflow/cases/${encodeURIComponent(caseId)}/phase-data`, { method: 'PATCH', body: JSON.stringify(body) }),
  recordApproval: (caseId, body) =>
    request(`/workflow/cases/${encodeURIComponent(caseId)}/approvals`, { method: 'POST', body: JSON.stringify(body) }),
  linkArtifact: (caseId, body) =>
    request(`/workflow/cases/${encodeURIComponent(caseId)}/artifacts`, { method: 'POST', body: JSON.stringify(body) }),
  getSettings: () => request('/settings'),
  patchSettings: (body) => request('/settings', { method: 'PATCH', body: JSON.stringify(body) }),
  getPhaseDefinitions: () => request('/workflow/phases'),
  getReportTemplates: (phase, includeStructure = false) => {
    const params = new URLSearchParams();
    if (phase) params.set('phase', phase);
    if (includeStructure) params.set('includeStructure', 'true');
    const q = params.toString();
    return request(`/report-templates${q ? `?${q}` : ''}`);
  },
  getReportTemplatesByPhase: (phase) => request(`/report-templates/by-phase/${encodeURIComponent(phase)}`),
  getReportTemplate: (id) => request(`/report-templates/${encodeURIComponent(id)}`),
  getPhaseReportMeta: () => request('/report-templates/phases'),
  getProcessingFlow: () => request('/workflow/processing-flow'),
  getCaseComplaints: (caseId) => request(`/complaints/by-case/${encodeURIComponent(caseId)}`),
  addFurtherComplaint: (caseId, body) =>
    request(`/complaints/by-case/${encodeURIComponent(caseId)}/further`, { method: 'POST', body: JSON.stringify(body) }),
};
