import { useState, useEffect } from 'react';
import type { TimelinePoint } from '../utils/gitHistoryProcessor';
import './Timeline.css';

interface TimelineProps {
  timeline: TimelinePoint[];
  currentPosition: number;
  onChange: (position: number) => void;
  isPlaying?: boolean;
  onPlayPause?: () => void;
}

/**
 * Timeline component for navigating through git history
 * Allows scrubbing through commits to see code evolution
 */
export function Timeline({ 
  timeline, 
  currentPosition, 
  onChange,
  isPlaying = false,
  onPlayPause
}: TimelineProps) {
  const [isDragging, setIsDragging] = useState(false);
  
  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying || currentPosition >= timeline.length - 1) return;
    
    const interval = setInterval(() => {
      onChange(Math.min(currentPosition + 1, timeline.length - 1));
    }, 1000); // Advance every second
    
    return () => clearInterval(interval);
  }, [isPlaying, currentPosition, timeline.length, onChange]);
  
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const position = parseInt(e.target.value, 10);
    onChange(position);
  };
  
  const handlePrevious = () => {
    onChange(Math.max(0, currentPosition - 1));
  };
  
  const handleNext = () => {
    onChange(Math.min(timeline.length - 1, currentPosition + 1));
  };
  
  const currentPoint = timeline[currentPosition];
  
  if (timeline.length === 0) {
    return (
      <div className="timeline-container">
        <div className="timeline-empty">No git history available</div>
      </div>
    );
  }
  
  return (
    <div className="timeline-container">
      <div className="timeline-controls">
        <button 
          className="timeline-button"
          onClick={handlePrevious}
          disabled={currentPosition === 0}
          title="Previous commit"
        >
          ⏮
        </button>
        
        {onPlayPause && (
          <button 
            className="timeline-button play-button"
            onClick={onPlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
        )}
        
        <button 
          className="timeline-button"
          onClick={handleNext}
          disabled={currentPosition === timeline.length - 1}
          title="Next commit"
        >
          ⏭
        </button>
      </div>
      
      <div className="timeline-slider-container">
        <input
          type="range"
          min="0"
          max={timeline.length - 1}
          value={currentPosition}
          onChange={handleSliderChange}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          className="timeline-slider"
        />
        <div className="timeline-progress" style={{ width: `${(currentPosition / (timeline.length - 1)) * 100}%` }} />
      </div>
      
      {currentPoint && (
        <div className="timeline-info">
          <div className="timeline-position">
            Commit {currentPosition + 1} of {timeline.length}
          </div>
          <div className="timeline-date">
            {currentPoint.date.toLocaleDateString()} {currentPoint.date.toLocaleTimeString()}
          </div>
          <div className="timeline-message">{currentPoint.message}</div>
          <div className="timeline-meta">
            <span className="timeline-author">{currentPoint.author}</span>
            <span className="timeline-files">{currentPoint.filesChanged} files changed</span>
          </div>
        </div>
      )}
    </div>
  );
}
