import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layout/Layout';
import {
  DashboardPage,
  ReportsPage,
  AdministrationPage,
  DocumentProcessorPage,
  CaseReportsPage,
  SpeechIntelligencePage,
  SettingsPage,
  ComplaintsPage,
  VerificationPage,
  ApprovalPage,
  TrapPage,
  RemandPage,
  InvestigationPage,
  EvidencePage,
  CourtPage,
  ProsecutionPage,
  LoginPage
} from './pages';
import { AuthProvider } from './context/AuthContext';

function RequireAuth({ children }) {
  if (!sessionStorage.getItem('acb_auth')) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <AuthProvider>
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<DashboardPage />} />
          <Route path="/" element={<DashboardPage />} />
          <Route path="/document-processor" element={<DocumentProcessorPage />} />
          <Route path="/case-reports" element={<CaseReportsPage />} />
          <Route path="/speech-intelligence" element={<SpeechIntelligencePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/complaints" element={<ComplaintsPage />} />
          <Route path="/verification" element={<VerificationPage />} />
          <Route path="/approval" element={<ApprovalPage />} />
          <Route path="/trap" element={<TrapPage />} />
          <Route path="/remand" element={<RemandPage />} />
          <Route path="/investigation" element={<InvestigationPage />} />
          <Route path="/evidence" element={<EvidencePage />} />
          <Route path="/court" element={<CourtPage />} />
          <Route path="/prosecution" element={<ProsecutionPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/administration" element={<AdministrationPage />} />
        </Route>
      </Routes>
    </Router>
    </AuthProvider>
  );
}

export default App;
