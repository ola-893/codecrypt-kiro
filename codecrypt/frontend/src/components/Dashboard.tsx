/**
 * Main Dashboard component for displaying resurrection metrics
 */

import { useResurrection } from '../context';
import { Counter } from './Counter';
import { ProgressBar } from './ProgressBar';
import { ComplexityChart } from './ComplexityChart';
import { CoverageChart } from './CoverageChart';
import { DependenciesChart } from './DependenciesChart';
import { VulnerabilitiesChart } from './VulnerabilitiesChart';
import { CompilationStatus } from './CompilationStatus';
import './Dashboard.css';

export function Dashboard() {
  const { state } = useResurrection();
  const { currentMetrics, metricsHistory, baselineCompilation, finalCompilation, resurrectionVerdict } = state;

  if (!currentMetrics && !baselineCompilation) {
    return (
      <div className="dashboard dashboard--empty">
        <div className="dashboard__empty-state">
          <div className="dashboard__empty-icon">⚰️</div>
          <h2>Awaiting Resurrection...</h2>
          <p>Connect to a resurrection process to see live metrics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <h2 className="dashboard__title">📊 Live Metrics Dashboard</h2>
        <div className="dashboard__subtitle">
          Real-time resurrection progress and statistics
        </div>
      </div>

      {/* Compilation Status Card */}
      <CompilationStatus
        baseline={baselineCompilation}
        final={finalCompilation}
        verdict={resurrectionVerdict}
      />

      {/* Progress Bar */}
      {currentMetrics && (
        <div className="dashboard__section">
          <ProgressBar progress={currentMetrics.progress} />
        </div>
      )}

      {/* Key Metrics Counters */}
      {currentMetrics && (
        <div className="dashboard__counters">
          <Counter
            label="Dependencies Updated"
            value={currentMetrics.depsUpdated}
            icon="📦"
            color="primary"
          />
          <Counter
            label="Vulnerabilities Fixed"
            value={currentMetrics.vulnsFixed}
            icon="🛡️"
            color="success"
          />
          <Counter
            label="Code Complexity"
            value={Math.round(currentMetrics.complexity)}
            icon="🧩"
            color="warning"
          />
          <Counter
            label="Test Coverage"
            value={Math.round(currentMetrics.coverage * 100)}
            icon="✅"
            color="success"
          />
        </div>
      )}

      {/* Additional Stats */}
      {currentMetrics && (
        <div className="dashboard__stats">
          <div className="dashboard__stat">
            <span className="dashboard__stat-label">Lines of Code</span>
            <span className="dashboard__stat-value">
              {(currentMetrics.loc || 0).toLocaleString()}
            </span>
          </div>
          <div className="dashboard__stat">
            <span className="dashboard__stat-label">Metrics Updates</span>
            <span className="dashboard__stat-value">
              {metricsHistory.length}
            </span>
          </div>
          <div className="dashboard__stat">
            <span className="dashboard__stat-label">Last Update</span>
            <span className="dashboard__stat-value">
              {new Date(currentMetrics.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}

      {/* Time-series Charts */}
      {metricsHistory.length > 1 ? (
        <div className="dashboard__charts">
          <div className="dashboard__chart-row">
            <ComplexityChart metricsHistory={metricsHistory} />
            <CoverageChart metricsHistory={metricsHistory} />
          </div>
          <div className="dashboard__chart-row">
            <DependenciesChart metricsHistory={metricsHistory} />
            <VulnerabilitiesChart metricsHistory={metricsHistory} />
          </div>
        </div>
      ) : (
        <div className="dashboard__charts-placeholder">
          <p>📈 Collecting metrics data for time-series charts...</p>
          <p className="dashboard__charts-hint">
            Charts will appear once multiple data points are available
          </p>
        </div>
      )}
    </div>
  );
}
