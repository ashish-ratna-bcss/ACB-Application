import PhaseCasesPage from '../components/PhaseCasesPage';

export default function CourtPage() {
  return (
    <PhaseCasesPage
      phase="court"
      title="Court"
      subtitle="Litigation tracker for hearing dates, bench details, witness summons statuses, and court orders."
      eyebrow="Litigation Tracker"
      statusOptions={[
        { val: 'pre_trial', lbl: 'Pre-Trial' },
        { val: 'hearing', lbl: 'Hearing' },
        { val: 'closed', lbl: 'Closed' },
      ]}
      detailColumnLabel="Court / Bench"
    />
  );
}
