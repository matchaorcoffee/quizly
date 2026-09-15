export const CATEGORIES = [
  'All',
  'General',
  'Programming',
  'Geography',
  'Language',
  'Science',
  'History',
  'Math',
  'Other',
];

export const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard'];
export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'alpha', label: 'A → Z' },
];

export default function FilterControls({ category, difficulty, sort, onCategory, onDifficulty, onSort }) {
  return (
    <div className="filter-controls">
      <div className="filter-group">
        <label className="filter-label">Category</label>
        <select
          className="form-select filter-select"
          value={category}
          onChange={(e) => onCategory(e.target.value)}
          aria-label="Filter by category"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="filter-group">
        <label className="filter-label">Difficulty</label>
        <select
          className="form-select filter-select"
          value={difficulty}
          onChange={(e) => onDifficulty(e.target.value)}
          aria-label="Filter by difficulty"
        >
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
      <div className="filter-group">
        <label className="filter-label">Sort by</label>
        <select
          className="form-select filter-select"
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          aria-label="Sort quizzes"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
