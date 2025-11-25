import React from 'react';
import { HashRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import Navigation from './components/Navigation';
import { ErrorProvider } from './contexts/ErrorContext';
import { KnowledgeBaseProvider } from './contexts/KnowledgeBaseContext';
import InterviewPage from './pages/InterviewPage';
import KnowledgeBase from './pages/KnowledgeBase';
import Settings from './pages/Settings';
import RealtimeTranscriptionDemo from './components/RealtimeTranscriptionDemo';
import PiPWindow from './components/PiPWindow';
import { InterviewProvider } from './contexts/InterviewContext';

const Shell: React.FC = () => {
  const location = useLocation();
  if (location.pathname === '/pip_window') {
    return (
      <div className="min-h-screen">
        <Routes>
          <Route path="/pip_window" element={<PiPWindow />} />
        </Routes>
      </div>
    );
  }
  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <main className="flex-grow container mx-auto p-4">
        <Routes>
          <Route path="/main_window" element={<InterviewPage />} />
          <Route path="/knowledge" element={<KnowledgeBase />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/realtime-demo" element={<RealtimeTranscriptionDemo />} />
          <Route path="/pip_window" element={<PiPWindow />} />
          <Route path="/" element={<Navigate to="/main_window" replace />} />
          <Route path="*" element={<Navigate to="/main_window" replace />} />
        </Routes>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <InterviewProvider>
      <ErrorProvider>
        <KnowledgeBaseProvider>
          <Router>
            <Shell />
          </Router>
        </KnowledgeBaseProvider>
      </ErrorProvider>
    </InterviewProvider>
  );
};

export default App;
