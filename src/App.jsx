import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import QuizForm from './pages/QuizForm';
import QuizPlayer from './pages/QuizPlayer';
import QuizResults from './pages/QuizResults';
import Explore from './pages/Explore';
import PrivateQuizAccess from './pages/PrivateQuizAccess';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';

export default function App() {
  return (
    <ErrorBoundary>
    <ThemeProvider>
    <AuthProvider>
    <ToastProvider>
    <BrowserRouter basename="/quizly">
      <Navbar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Routes>
          {/* Public discovery & taking */}
          <Route path="/explore" element={<Explore />} />
          <Route path="/quiz/private/:token" element={<PrivateQuizAccess />} />
          <Route path="/quiz/:id" element={<QuizPlayer />} />
          <Route path="/results/:id" element={<QuizResults />} />

          {/* Auth routes */}
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/sign-up" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Protected routes */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/create" element={<ProtectedRoute><QuizForm /></ProtectedRoute>} />
          <Route path="/edit/:id" element={<ProtectedRoute><QuizForm /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </BrowserRouter>
    </ToastProvider>
    </AuthProvider>
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
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Link to="/explore" className="btn btn-primary">Explore Quizzes</Link>
            <Link to="/" className="btn btn-secondary">Go to Dashboard</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
