import PhaseCasesPage from '../components/PhaseCasesPage';

export default function RemandPage() {
  return (
    <PhaseCasesPage
      phase="remand"
      title="Remand"
      subtitle="Auto-generate Remand Diaries from Trap Operations data. Track judicial custody timelines and bail application statuses."
      eyebrow="Post-Arrest Legal Process"
      statusOptions={[
        { val: 'pending', lbl: 'Pending' },
        { val: 'diary_generated', lbl: 'Diary Generated' },
        { val: 'custody_active', lbl: 'Custody Active' },
        { val: 'bail_applied', lbl: 'Bail Applied' },
      ]}
    />
  );
}
