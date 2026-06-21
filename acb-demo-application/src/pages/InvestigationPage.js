import PhaseCasesPage from '../components/PhaseCasesPage';

export default function InvestigationPage() {
  return (
    <PhaseCasesPage
      phase="investigation"
      title="Investigation"
      subtitle="Collate witness statements, analyze financial trails from Document Processor extractions, and build the chronological narrative for the charge sheet."
      eyebrow="Deep-Dive Dossier"
      statusOptions={[
        { val: 'active', lbl: 'Active' },
        { val: 'evidence_collation', lbl: 'Evidence Collation' },
        { val: 'charge_sheet_prep', lbl: 'Charge Sheet Prep' },
      ]}
    />
  );
}
