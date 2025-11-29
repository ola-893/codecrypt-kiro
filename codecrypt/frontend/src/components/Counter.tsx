/**
 * Counter component for displaying key statistics
 */

import { useEffect, useState } from 'react';
import './Counter.css';

interface CounterProps {
  label: string;
  value: number;
  icon?: string;
  color?: 'primary' | 'success' | 'warning' | 'danger';
}

export function Counter({ label, value, icon = '📊', color = 'primary' }: CounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Animate counter when value changes
  useEffect(() => {
    if (displayValue === value) return;

    setIsAnimating(true);
    const duration = 500; // Animation duration in ms
    const steps = 20;
    const increment = (value - displayValue) / steps;
    const stepDuration = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(value);
        setIsAnimating(false);
        clearInterval(timer);
      } else {
        setDisplayValue((prev) => Math.round(prev + increment));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [value, displayValue]);

  return (
    <div className={`counter counter--${color} ${isAnimating ? 'counter--animating' : ''}`}>
      <div className="counter__icon">{icon}</div>
      <div className="counter__content">
        <div className="counter__value">{displayValue}</div>
        <div className="counter__label">{label}</div>
      </div>
    </div>
  );
}
