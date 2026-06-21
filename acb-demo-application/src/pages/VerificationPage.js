import PhaseCasesPage from '../components/PhaseCasesPage';

export default function VerificationPage() {
  return (
    <PhaseCasesPage
      phase="verification"
      title="Verification"
      subtitle="Log complaint authenticity, attach Verbatim documents from Speech Intelligence, and compile the official Verification Report for DSP approval."
      eyebrow="Verification Phase"
      statusOptions={[
        { val: 'pending', lbl: 'Pending' },
        { val: 'in_progress', lbl: 'In Progress' },
        { val: 'report_submitted', lbl: 'Report Submitted' },
      ]}
    />
  );
}
