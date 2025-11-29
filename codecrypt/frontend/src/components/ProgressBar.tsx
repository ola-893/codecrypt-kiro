/**
 * ProgressBar component for displaying resurrection progress
 */

import { useEffect, useState } from 'react';
import './ProgressBar.css';

interface ProgressBarProps {
  progress: number; // 0 to 1
  label?: string;
  showPercentage?: boolean;
}

export function ProgressBar({ 
  progress, 
  label = 'Resurrection Progress', 
  showPercentage = true 
}: ProgressBarProps) {
  const [displayProgress, setDisplayProgress] = useState(0);

  // Animate progress bar
  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayProgress(progress);
    }, 100);

    return () => clearTimeout(timer);
  }, [progress]);

  const percentage = Math.round(displayProgress * 100);
  const isComplete = percentage >= 100;

  return (
    <div className="progress-bar">
      <div className="progress-bar__header">
        <span className="progress-bar__label">{label}</span>
        {showPercentage && (
          <span className="progress-bar__percentage">{percentage}%</span>
        )}
      </div>
      <div className="progress-bar__track">
        <div 
          className={`progress-bar__fill ${isComplete ? 'progress-bar__fill--complete' : ''}`}
          style={{ width: `${percentage}%` }}
        >
          <div className="progress-bar__glow" />
        </div>
      </div>
      {isComplete && (
        <div className="progress-bar__complete-message">
          ✨ Resurrection Complete! ✨
        </div>
      )}
    </div>
  );
}
