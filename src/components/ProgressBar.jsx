import './ProgressBar.css';

export default function ProgressBar({ value, max, label, variant = 'primary', animated = false }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div className="progress-bar-wrapper">
      {label && (
        <div className="progress-bar-label">
          <span>{label}</span>
          <span className="progress-bar-pct">{pct}%</span>
        </div>
      )}
      <div className="progress-bar-track" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
        <div
          className={`progress-bar-fill progress-bar-fill--${variant} ${animated ? 'animated' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
