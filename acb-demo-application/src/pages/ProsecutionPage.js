import PhaseCasesPage from '../components/PhaseCasesPage';

export default function ProsecutionPage() {
  return (
    <PhaseCasesPage
      phase="prosecution"
      title="Prosecution"
      subtitle="Track charge sheet filing, ongoing trial narrative, and record final judicial outcomes (conviction, acquittal, dismissal) for Dashboard KPIs."
      eyebrow="Final Resolution"
      statusOptions={[
        { val: 'preparing', lbl: 'Preparing' },
        { val: 'filed', lbl: 'Filed' },
        { val: 'trial', lbl: 'Trial' },
        { val: 'convicted', lbl: 'Convicted' },
        { val: 'acquitted', lbl: 'Acquitted' },
        { val: 'dismissed', lbl: 'Dismissed' },
      ]}
    />
  );
}
