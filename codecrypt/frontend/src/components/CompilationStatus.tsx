/**
 * Compilation Status component for displaying resurrection proof
 */

import { CompilationResult, ResurrectionVerdict, ErrorCategory } from '../types';
import './CompilationStatus.css';

interface CompilationStatusProps {
  baseline: CompilationResult | null;
  final: CompilationResult | null;
  verdict: ResurrectionVerdict | null;
}

const ERROR_CATEGORY_LABELS: Record<ErrorCategory, string> = {
  type: 'Type Errors',
  import: 'Import Errors',
  syntax: 'Syntax Errors',
  dependency: 'Dependency Errors',
  config: 'Config Errors',
};

const ERROR_CATEGORY_ICONS: Record<ErrorCategory, string> = {
  type: '🔤',
  import: '📦',
  syntax: '⚠️',
  dependency: '🔗',
  config: '⚙️',
};

export function CompilationStatus({ baseline, final, verdict }: CompilationStatusProps) {
  // Show empty state if no compilation data
  if (!baseline && !final && !verdict) {
    return (
      <div className="compilation-status compilation-status--empty">
        <div className="compilation-status__icon">🔬</div>
        <div className="compilation-status__message">
          Awaiting compilation analysis...
        </div>
      </div>
    );
  }

  const getVerdictDisplay = () => {
    if (!verdict) {
      return {
        icon: '⏳',
        text: 'Resurrection in progress...',
        className: 'compilation-status__verdict--pending',
      };
    }

    if (verdict.resurrected) {
      return {
        icon: '🧟',
        text: 'RESURRECTED!',
        className: 'compilation-status__verdict--success',
      };
    }

    if (baseline?.success && final?.success) {
      return {
        icon: '✨',
        text: 'ALREADY ALIVE',
        className: 'compilation-status__verdict--alive',
      };
    }

    return {
      icon: '💀',
      text: 'NOT RESURRECTED',
      className: 'compilation-status__verdict--failed',
    };
  };

  const verdictDisplay = getVerdictDisplay();

  return (
    <div className="compilation-status">
      <div className="compilation-status__header">
        <h3 className="compilation-status__title">⚰️ Resurrection Proof</h3>
      </div>

      {/* Verdict Banner */}
      <div className={`compilation-status__verdict ${verdictDisplay.className}`}>
        <span className="compilation-status__verdict-icon">{verdictDisplay.icon}</span>
        <span className="compilation-status__verdict-text">{verdictDisplay.text}</span>
      </div>

      {/* Compilation Cards */}
      <div className="compilation-status__cards">
        {/* Baseline Card */}
        <div className="compilation-status__card">
          <div className="compilation-status__card-header">
            <span className="compilation-status__card-icon">📜</span>
            <span className="compilation-status__card-title">Baseline</span>
          </div>
          {baseline ? (
            <>
              <div className={`compilation-status__result ${baseline.success ? 'compilation-status__result--success' : 'compilation-status__result--failed'}`}>
                {baseline.success ? '✅ Compiles' : '❌ Failed'}
              </div>
              <div className="compilation-status__error-count">
                {baseline.errorCount} {baseline.errorCount === 1 ? 'error' : 'errors'}
              </div>
              {baseline.errorCount > 0 && (
                <div className="compilation-status__categories">
                  {(Object.keys(baseline.errorsByCategory) as ErrorCategory[])
                    .filter(cat => baseline.errorsByCategory[cat] > 0)
                    .map(category => (
                      <div key={category} className="compilation-status__category">
                        <span className="compilation-status__category-icon">
                          {ERROR_CATEGORY_ICONS[category]}
                        </span>
                        <span className="compilation-status__category-label">
                          {ERROR_CATEGORY_LABELS[category]}
                        </span>
                        <span className="compilation-status__category-count">
                          {baseline.errorsByCategory[category]}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </>
          ) : (
            <div className="compilation-status__pending">Pending...</div>
          )}
        </div>

        {/* Arrow */}
        <div className="compilation-status__arrow">→</div>

        {/* Final Card */}
        <div className="compilation-status__card">
          <div className="compilation-status__card-header">
            <span className="compilation-status__card-icon">🧟</span>
            <span className="compilation-status__card-title">Final</span>
          </div>
          {final ? (
            <>
              <div className={`compilation-status__result ${final.success ? 'compilation-status__result--success' : 'compilation-status__result--failed'}`}>
                {final.success ? '✅ Compiles' : '❌ Failed'}
              </div>
              <div className="compilation-status__error-count">
                {final.errorCount} {final.errorCount === 1 ? 'error' : 'errors'}
              </div>
              {final.errorCount > 0 && (
                <div className="compilation-status__categories">
                  {(Object.keys(final.errorsByCategory) as ErrorCategory[])
                    .filter(cat => final.errorsByCategory[cat] > 0)
                    .map(category => (
                      <div key={category} className="compilation-status__category">
                        <span className="compilation-status__category-icon">
                          {ERROR_CATEGORY_ICONS[category]}
                        </span>
                        <span className="compilation-status__category-label">
                          {ERROR_CATEGORY_LABELS[category]}
                        </span>
                        <span className="compilation-status__category-count">
                          {final.errorsByCategory[category]}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </>
          ) : (
            <div className="compilation-status__pending">Pending...</div>
          )}
        </div>
      </div>

      {/* Progress Summary */}
      {verdict && (
        <div className="compilation-status__summary">
          <div className="compilation-status__summary-item compilation-status__summary-item--fixed">
            <span className="compilation-status__summary-icon">✅</span>
            <span className="compilation-status__summary-value">{verdict.errorsFixed}</span>
            <span className="compilation-status__summary-label">Errors Fixed</span>
          </div>
          <div className="compilation-status__summary-item compilation-status__summary-item--remaining">
            <span className="compilation-status__summary-icon">⚠️</span>
            <span className="compilation-status__summary-value">{verdict.errorsRemaining}</span>
            <span className="compilation-status__summary-label">Remaining</span>
          </div>
        </div>
      )}
    </div>
  );
}
