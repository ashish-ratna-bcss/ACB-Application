import PhaseCasesPage from '../components/PhaseCasesPage';

export default function ApprovalPage() {
  return (
    <PhaseCasesPage
      phase="approval"
      title="FIR / Approval"
      subtitle="Aggregate Draft Complaint, Verification Report, and Verbatim evidence for Head Office authorization. Track approval state and register FIR upon permission."
      eyebrow="Authorization Gate"
      statusOptions={[
        { val: 'pending', lbl: 'Pending' },
        { val: 'submitted', lbl: 'Submitted' },
        { val: 'approved', lbl: 'Approved' },
        { val: 'fir_registered', lbl: 'FIR Registered' },
      ]}
    />
  );
}
