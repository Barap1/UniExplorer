import './Progress.css';

export interface ProgressProps {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
}

export const Progress = ({ value, max = 100, label, showPercent = false }: ProgressProps) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="progress-container">
      {(label || showPercent) && (
        <div className="progress-header">
          {label && <span className="progress-label">{label}</span>}
          {showPercent && <span className="progress-percentage">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
};
