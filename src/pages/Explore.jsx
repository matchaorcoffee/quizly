import { useState, useEffect, useCallback } from 'react';
import { getPublicQuizzes, deleteQuiz, duplicateQuiz } from '../data/quizService';
import { useAuth } from '../context/AuthContext';
import QuizCard from '../components/QuizCard';
import SearchBar from '../components/SearchBar';
import FilterControls from '../components/FilterControls';
import ConfirmationModal from '../components/ConfirmationModal';
import { useNavigate } from 'react-router-dom';
import './Explore.css';

function applyFilters(quizzes, search, category, difficulty, sort) {
  let result = [...quizzes];

  if (search.trim()) {
    const q = search.toLowerCase();
    result = result.filter(
      (quiz) =>
        quiz.title.toLowerCase().includes(q) ||
        (quiz.description || '').toLowerCase().includes(q) ||
        (quiz.creatorName || '').toLowerCase().includes(q)
    );
  }

  if (category !== 'All') {
    result = result.filter((quiz) => quiz.category === category);
  }

  if (difficulty !== 'All') {
    result = result.filter((quiz) => quiz.difficulty === difficulty);
  }

  if (sort === 'newest') {
    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sort === 'oldest') {
    result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else if (sort === 'alpha') {
    result.sort((a, b) => a.title.localeCompare(b.title));
  }

  return result;
}

export default function Explore() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [sort, setSort] = useState('newest');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadQuizzes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getPublicQuizzes();
      setQuizzes(data);
    } catch (err) {
      setError(err.message || 'Failed to load public quizzes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  const handleDelete = (id) => setDeleteTarget(id);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteQuiz(deleteTarget);
      setDeleteTarget(null);
      await loadQuizzes();
    } catch (err) {
      setError(err.message || 'Failed to delete quiz.');
      setDeleteTarget(null);
    }
  };

  const handleDuplicate = async (id) => {
    try {
      await duplicateQuiz(id);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to duplicate quiz.');
    }
  };

  const filtered = applyFilters(quizzes, search, category, difficulty, sort);
  const hasFilters = search || category !== 'All' || difficulty !== 'All';

  return (
    <div className="page-container">
      {/* Hero */}
      <section className="explore-hero">
        <div>
          <h1 className="explore-hero-title">Explore Public Quizzes 🌎</h1>
          <p className="explore-hero-sub">
            Discover and play community quizzes shared by creators worldwide.
          </p>
        </div>
        {user && (
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/create')}>
            + Create a Quiz
          </button>
        )}
      </section>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }} role="alert">
          {error}
        </div>
      )}

      {/* Controls */}
      <section className="explore-controls">
        <SearchBar value={search} onChange={setSearch} placeholder="Search quizzes by title, description, or creator…" />
        <FilterControls
          category={category}
          difficulty={difficulty}
          sort={sort}
          onCategory={setCategory}
          onDifficulty={setDifficulty}
          onSort={setSort}
        />
      </section>

      {/* Header */}
      <div className="explore-list-header">
        <h2 className="explore-section-title">
          Community Quizzes
          {!loading && quizzes.length > 0 && (
            <span className="explore-count">{filtered.length} of {quizzes.length}</span>
          )}
        </h2>
      </div>

      {/* Grid or Empty */}
      {loading ? (
        <div className="explore-loading">
          <div className="explore-spinner" />
          <p>Loading public quizzes…</p>
        </div>
      ) : filtered.length > 0 ? (
        <div className="quiz-grid">
          {filtered.map((quiz) => (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              currentUserId={user?.id}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      ) : (
        <div className="card">
          {quizzes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🌎</div>
              <h3>No public quizzes yet</h3>
              <p>Be the first to share a public quiz with the Quizly community!</p>
              {user ? (
                <button className="btn btn-primary" onClick={() => navigate('/create')}>
                  + Create a Public Quiz
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => navigate('/sign-up')}>
                  Sign Up to Create
                </button>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <h3>No matches found</h3>
              <p>
                {hasFilters
                  ? 'Try adjusting your search or filters.'
                  : 'No public quizzes match your current filters.'}
              </p>
              <button
                className="btn btn-secondary"
                onClick={() => { setSearch(''); setCategory('All'); setDifficulty('All'); }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deleteTarget}
        title="Delete Quiz"
        message="Are you sure you want to delete this quiz? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
