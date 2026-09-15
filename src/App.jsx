import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import QuizForm from './pages/QuizForm';
import QuizPlayer from './pages/QuizPlayer';
import QuizResults from './pages/QuizResults';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';

export default function App() {
  return (
    <ErrorBoundary>
    <ThemeProvider>
    <BrowserRouter>
      <Navbar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/create" element={<QuizForm />} />
          <Route path="/edit/:id" element={<QuizForm />} />
          <Route path="/quiz/:id" element={<QuizPlayer />} />
          <Route path="/results/:id" element={<QuizResults />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </BrowserRouter>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

function NotFound() {
  return (
    <div className="page-container">
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>Page Not Found</h3>
          <p>The page you're looking for doesn't exist.</p>
          <a href="/" className="btn btn-primary">Go to Dashboard</a>
        </div>
      </div>
    </div>
  );
}
