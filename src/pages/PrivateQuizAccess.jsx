import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getQuizByShareToken } from '../data/quizService';

export default function PrivateQuizAccess() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function lookupQuiz() {
      setLoading(true);
      setError(null);
      try {
        const quiz = await getQuizByShareToken(token);
        if (!isMounted) return;

        if (quiz && quiz.id) {
          // Pass the preloaded quiz in history state so QuizPlayer doesn't need to re-query RLS
          navigate(`/quiz/${quiz.id}`, { replace: true, state: { preloadedQuiz: quiz, fromShareToken: true } });
        } else {
          setError('not_found');
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'not_found');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    lookupQuiz();

    return () => {
      isMounted = false;
    };
  }, [token, navigate]);

  if (loading) {
    return (
      <div className="page-container-narrow" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 16 }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Accessing private quiz…</p>
      </div>
    );
  }

  return (
    <div className="page-container-narrow">
      <div className="card animate-in">
        <div className="empty-state">
          <div className="empty-state-icon">🔒</div>
          <h3>Quiz Not Available</h3>
          <p>
            This private quiz could not be found. The link may have expired, been regenerated, or the quiz was deleted by the creator.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Link to="/explore" className="btn btn-primary">
              Explore Public Quizzes
            </Link>
            <Link to="/" className="btn btn-secondary">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
