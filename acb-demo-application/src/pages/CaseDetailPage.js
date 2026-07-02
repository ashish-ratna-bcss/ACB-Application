import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../utils/api';
import CaseDetailsPanel from '../components/CaseDetailsPanel';

const ROUTE_TO_PHASE = {
  complaints: 'complaint',
  verification: 'verification',
  'fir-approval': 'approval',
  trap: 'trap',
  remand: 'remand',
  investigation: 'investigation',
  evidence: 'evidence',
  court: 'court',
  prosecution: 'prosecution',
};

export default function CaseDetailPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const pathParts = location.pathname.split('/').filter(Boolean);
  const phaseRoute = pathParts[0];
  const phase = ROUTE_TO_PHASE[phaseRoute] || 'complaint';

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    api.getCaseWorkflow(caseId)
      .then((wf) => {
        setCaseData({
          id: wf.caseId,
          trackingId: wf.trackingId,
          accused: wf.accused,
          designation: wf.designation,
          department: wf.department,
          location: wf.location,
          priority: wf.priority,
          amount: wf.amount,
          dspName: wf.dspName,
          firNumber: wf.firNumber,
          complainantName: wf.complaints?.[0]?.complainantName || wf.complainantName || '—'
        });
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [caseId]);

  const handleClose = () => {
    navigate(`/${phaseRoute}`);
  };

  const handleWorkflowChange = () => {
    if (!caseId) return;
    api.getCaseWorkflow(caseId)
      .then((wf) => {
        const expectedRoute = Object.keys(ROUTE_TO_PHASE).find(key => ROUTE_TO_PHASE[key] === wf.currentPhase);
        if (expectedRoute && expectedRoute !== phaseRoute) {
          navigate(`/${expectedRoute}/${caseId}`, { replace: true });
        } else {
          setCaseData({
            id: wf.caseId,
            trackingId: wf.trackingId,
            accused: wf.accused,
            designation: wf.designation,
            department: wf.department,
            location: wf.location,
            priority: wf.priority,
            amount: wf.amount,
            dspName: wf.dspName,
            firNumber: wf.firNumber,
            complainantName: wf.complaints?.[0]?.complainantName || wf.complainantName || '—'
          });
        }
      });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 40px', color: 'var(--text-3)' }}>
        <div style={{ fontSize: '15px', fontWeight: 600 }}>Loading case details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B', borderRadius: '12px', padding: '24px', margin: '40px auto', maxWidth: '600px', boxShadow: 'var(--shadow)' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Error Loading Case</h3>
        <p style={{ margin: '0 0 20px 0', fontSize: '14.5px' }}>{error}</p>
        <button onClick={handleClose} style={{ padding: '10px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
          Back to Phase Queue
        </button>
      </div>
    );
  }

  return (
    <CaseDetailsPanel
      caseData={caseData}
      phase={phase}
      onClose={handleClose}
      onWorkflowChange={handleWorkflowChange}
    />
  );
}
