import PhaseCasesPage from '../components/PhaseCasesPage';

export default function TrapPage() {
  return (
    <PhaseCasesPage
      phase="trap"
      title="Trap Operations"
      subtitle="Record operational trap details: mediator assignments, phenolphthalein test results, seizure inventories, and on-the-spot arrest memos."
      eyebrow="Tactical Execution"
      statusOptions={[
        { val: 'planning', lbl: 'Planning' },
        { val: 'scheduled', lbl: 'Scheduled' },
        { val: 'executed', lbl: 'Executed' },
      ]}
      primaryAction={(
        <button style={{ border: '1px solid #00A84A', background: '#00C853', color: '#052E16', fontSize: '13px', fontWeight: 700, borderRadius: '10px', padding: '10px 14px' }}>
          Schedule Trap
        </button>
      )}
    />
  );
}
