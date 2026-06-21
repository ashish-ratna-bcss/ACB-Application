import PhaseCasesPage from '../components/PhaseCasesPage';

export default function EvidencePage() {
  return (
    <PhaseCasesPage
      phase="evidence"
      title="Evidence"
      subtitle="Digital chain-of-custody vault. Log uploads, views, and modifications. Link operational files to Qdrant embeddings for semantic search auditing."
      eyebrow="Chain of Custody"
      statusOptions={[
        { val: 'logged', lbl: 'Logged' },
        { val: 'secured', lbl: 'Secured' },
        { val: 'archived', lbl: 'Archived' },
      ]}
    />
  );
}
