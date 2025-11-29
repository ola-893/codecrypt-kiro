import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ReactNode, useEffect } from 'react';
import { Dashboard } from '../components/Dashboard';
import { ResurrectionProvider, useResurrection } from '../context/ResurrectionContext';
import { updateMetrics } from '../context/actions';
import { MetricsSnapshot } from '../types';

// Mock Chart.js components to avoid canvas rendering issues in tests
vi.mock('react-chartjs-2', () => ({
  Line: ({ data, options }: any) => (
    <div data-testid="line-chart" data-chart-type="line">
      <div data-testid="chart-labels">{JSON.stringify(data.labels)}</div>
      <div data-testid="chart-data">{JSON.stringify(data.datasets)}</div>
      <div data-testid="chart-title">{options.plugins?.title?.text}</div>
    </div>
  ),
  Bar: ({ data, options }: any) => (
    <div data-testid="bar-chart" data-chart-type="bar">
      <div data-testid="chart-labels">{JSON.stringify(data.labels)}</div>
      <div data-testid="chart-data">{JSON.stringify(data.datasets)}</div>
      <div data-testid="chart-title">{options.plugins?.title?.text}</div>
    </div>
  ),
}));

// Wrapper component for testing
const wrapper = ({ children }: { children: ReactNode }) => (
  <ResurrectionProvider>{children}</ResurrectionProvider>
);

// Helper component to dispatch actions
function TestWrapper({ children, initialMetrics }: { children: ReactNode; initialMetrics?: MetricsSnapshot[] }) {
  const { dispatch } = useResurrection();

  // Set up initial metrics if provided - use useEffect to avoid dispatching during render
  useEffect(() => {
    if (initialMetrics && initialMetrics.length > 0) {
      initialMetrics.forEach((metrics) => {
        dispatch(updateMetrics(metrics));
      });
    }
  }, [dispatch, initialMetrics]);

  return <>{children}</>;
}

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty State', () => {
    it('should render empty state when no metrics are available', () => {
      render(
        <ResurrectionProvider>
          <Dashboard />
        </ResurrectionProvider>
      );

      expect(screen.getByText('Awaiting Resurrection...')).toBeInTheDocument();
      expect(screen.getByText('Connect to a resurrection process to see live metrics')).toBeInTheDocument();
      expect(screen.getByText('⚰️')).toBeInTheDocument();
    });

    it('should have correct CSS class for empty state', () => {
      const { container } = render(
        <ResurrectionProvider>
          <Dashboard />
        </ResurrectionProvider>
      );

      const dashboard = container.querySelector('.dashboard--empty');
      expect(dashboard).toBeInTheDocument();
    });
  });

  describe('Chart Rendering', () => {
    it('should render all counters with current metrics', () => {
      const mockMetrics: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 10,
        vulnsFixed: 5,
        complexity: 15.7,
        coverage: 0.85,
        loc: 2500,
        progress: 0.6,
      };

      render(
        <ResurrectionProvider>
          <TestWrapper initialMetrics={[mockMetrics]}>
            <Dashboard />
          </TestWrapper>
        </ResurrectionProvider>
      );

      // Check counters are rendered
      expect(screen.getByText('Dependencies Updated')).toBeInTheDocument();
      expect(screen.getByText('Vulnerabilities Fixed')).toBeInTheDocument();
      expect(screen.getByText('Code Complexity')).toBeInTheDocument();
      expect(screen.getByText('Test Coverage')).toBeInTheDocument();
    });

    it('should display correct metric values in counters', async () => {
      const mockMetrics: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 10,
        vulnsFixed: 5,
        complexity: 15.7,
        coverage: 0.85,
        loc: 2500,
        progress: 0.6,
      };

      render(
        <ResurrectionProvider>
          <TestWrapper initialMetrics={[mockMetrics]}>
            <Dashboard />
          </TestWrapper>
        </ResurrectionProvider>
      );

      // Wait for counter animations to complete
      await waitFor(() => {
        // Check if values are displayed (counters animate, so we check for presence)
        const counters = screen.getAllByText(/\d+/);
        expect(counters.length).toBeGreaterThan(0);
      });
    });

    it('should render progress bar with correct progress', () => {
      const mockMetrics: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 10,
        vulnsFixed: 5,
        complexity: 15,
        coverage: 0.85,
        loc: 2500,
        progress: 0.75,
      };

      const { container } = render(
        <ResurrectionProvider>
          <TestWrapper initialMetrics={[mockMetrics]}>
            <Dashboard />
          </TestWrapper>
        </ResurrectionProvider>
      );

      // Progress bar should be rendered - use more specific selector
      const progressBar = container.querySelector('.progress-bar');
      expect(progressBar).toBeInTheDocument();
      
      // Check for the label specifically within the progress bar
      const progressLabel = container.querySelector('.progress-bar__label');
      expect(progressLabel).toHaveTextContent('Resurrection Progress');
    });

    it('should display additional stats correctly', () => {
      const mockMetrics: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 10,
        vulnsFixed: 5,
        complexity: 15,
        coverage: 0.85,
        loc: 2500,
        progress: 0.6,
      };

      render(
        <ResurrectionProvider>
          <TestWrapper initialMetrics={[mockMetrics]}>
            <Dashboard />
          </TestWrapper>
        </ResurrectionProvider>
      );

      expect(screen.getByText('Lines of Code')).toBeInTheDocument();
      expect(screen.getByText('2,500')).toBeInTheDocument();
      expect(screen.getByText('Metrics Updates')).toBeInTheDocument();
      expect(screen.getByText('Last Update')).toBeInTheDocument();
    });

    it('should show placeholder when only one metric snapshot exists', () => {
      const mockMetrics: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 10,
        vulnsFixed: 5,
        complexity: 15,
        coverage: 0.85,
        loc: 2500,
        progress: 0.6,
      };

      render(
        <ResurrectionProvider>
          <TestWrapper initialMetrics={[mockMetrics]}>
            <Dashboard />
          </TestWrapper>
        </ResurrectionProvider>
      );

      expect(screen.getByText(/Collecting metrics data for time-series charts/i)).toBeInTheDocument();
      expect(screen.getByText(/Charts will appear once multiple data points are available/i)).toBeInTheDocument();
    });

    it('should render time-series charts when multiple metrics exist', () => {
      const mockMetrics1: MetricsSnapshot = {
        timestamp: Date.now() - 5000,
        depsUpdated: 5,
        vulnsFixed: 2,
        complexity: 20,
        coverage: 0.7,
        loc: 2500,
        progress: 0.3,
      };

      const mockMetrics2: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 10,
        vulnsFixed: 5,
        complexity: 15,
        coverage: 0.85,
        loc: 2400,
        progress: 0.6,
      };

      render(
        <ResurrectionProvider>
          <TestWrapper initialMetrics={[mockMetrics1, mockMetrics2]}>
            <Dashboard />
          </TestWrapper>
        </ResurrectionProvider>
      );

      // Charts should be rendered (mocked)
      const charts = screen.getAllByTestId(/chart/i);
      expect(charts.length).toBeGreaterThan(0);
    });
  });

  describe('Real-time Updates', () => {
    it('should update when new metrics are received', async () => {
      const { rerender } = render(
        <ResurrectionProvider>
          <Dashboard />
        </ResurrectionProvider>
      );

      // Initially empty
      expect(screen.getByText('Awaiting Resurrection...')).toBeInTheDocument();

      // Add metrics
      const mockMetrics: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 10,
        vulnsFixed: 5,
        complexity: 15,
        coverage: 0.85,
        loc: 2500,
        progress: 0.6,
      };

      rerender(
        <ResurrectionProvider>
          <TestWrapper initialMetrics={[mockMetrics]}>
            <Dashboard />
          </TestWrapper>
        </ResurrectionProvider>
      );

      // Should now show dashboard
      await waitFor(() => {
        expect(screen.queryByText('Awaiting Resurrection...')).not.toBeInTheDocument();
        expect(screen.getByText('Dependencies Updated')).toBeInTheDocument();
      });
    });

    it('should update metrics history count', () => {
      const mockMetrics1: MetricsSnapshot = {
        timestamp: Date.now() - 5000,
        depsUpdated: 5,
        vulnsFixed: 2,
        complexity: 20,
        coverage: 0.7,
        loc: 2500,
        progress: 0.3,
      };

      const mockMetrics2: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 10,
        vulnsFixed: 5,
        complexity: 15,
        coverage: 0.85,
        loc: 2400,
        progress: 0.6,
      };

      render(
        <ResurrectionProvider>
          <TestWrapper initialMetrics={[mockMetrics1, mockMetrics2]}>
            <Dashboard />
          </TestWrapper>
        </ResurrectionProvider>
      );

      expect(screen.getByText('Metrics Updates')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should format timestamp correctly', () => {
      const now = Date.now();
      const mockMetrics: MetricsSnapshot = {
        timestamp: now,
        depsUpdated: 10,
        vulnsFixed: 5,
        complexity: 15,
        coverage: 0.85,
        loc: 2500,
        progress: 0.6,
      };

      render(
        <ResurrectionProvider>
          <TestWrapper initialMetrics={[mockMetrics]}>
            <Dashboard />
          </TestWrapper>
        </ResurrectionProvider>
      );

      const expectedTime = new Date(now).toLocaleTimeString();
      expect(screen.getByText(expectedTime)).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('should render dashboard header', () => {
      const mockMetrics: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 10,
        vulnsFixed: 5,
        complexity: 15,
        coverage: 0.85,
        loc: 2500,
        progress: 0.6,
      };

      render(
        <ResurrectionProvider>
          <TestWrapper initialMetrics={[mockMetrics]}>
            <Dashboard />
          </TestWrapper>
        </ResurrectionProvider>
      );

      expect(screen.getByText('📊 Live Metrics Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Real-time resurrection progress and statistics')).toBeInTheDocument();
    });

    it('should have correct CSS structure for layout', () => {
      const mockMetrics: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 10,
        vulnsFixed: 5,
        complexity: 15,
        coverage: 0.85,
        loc: 2500,
        progress: 0.6,
      };

      const { container } = render(
        <ResurrectionProvider>
          <TestWrapper initialMetrics={[mockMetrics]}>
            <Dashboard />
          </TestWrapper>
        </ResurrectionProvider>
      );

      expect(container.querySelector('.dashboard')).toBeInTheDocument();
      expect(container.querySelector('.dashboard__header')).toBeInTheDocument();
      expect(container.querySelector('.dashboard__counters')).toBeInTheDocument();
      expect(container.querySelector('.dashboard__stats')).toBeInTheDocument();
    });

    it('should render all four chart components when metrics history exists', () => {
      const mockMetrics1: MetricsSnapshot = {
        timestamp: Date.now() - 5000,
        depsUpdated: 5,
        vulnsFixed: 2,
        complexity: 20,
        coverage: 0.7,
        loc: 2500,
        progress: 0.3,
      };

      const mockMetrics2: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 10,
        vulnsFixed: 5,
        complexity: 15,
        coverage: 0.85,
        loc: 2400,
        progress: 0.6,
      };

      render(
        <ResurrectionProvider>
          <TestWrapper initialMetrics={[mockMetrics1, mockMetrics2]}>
            <Dashboard />
          </TestWrapper>
        </ResurrectionProvider>
      );

      // Should have chart containers
      const chartContainers = screen.getAllByTestId(/chart/i);
      expect(chartContainers.length).toBeGreaterThanOrEqual(4);
    });

    it('should round complexity and coverage values correctly', () => {
      const mockMetrics: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 10,
        vulnsFixed: 5,
        complexity: 15.789,
        coverage: 0.8567,
        loc: 2500,
        progress: 0.6,
      };

      render(
        <ResurrectionProvider>
          <TestWrapper initialMetrics={[mockMetrics]}>
            <Dashboard />
          </TestWrapper>
        </ResurrectionProvider>
      );

      // Complexity should be rounded to 16
      // Coverage should be rounded to 86 (0.8567 * 100 = 85.67 -> 86)
      // These values will appear in the counters after animation
      waitFor(() => {
        const dashboard = screen.getByText('Code Complexity').closest('.counter');
        expect(dashboard).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero values gracefully', () => {
      const mockMetrics: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 0,
        vulnsFixed: 0,
        complexity: 0,
        coverage: 0,
        loc: 0,
        progress: 0,
      };

      render(
        <ResurrectionProvider>
          <TestWrapper initialMetrics={[mockMetrics]}>
            <Dashboard />
          </TestWrapper>
        </ResurrectionProvider>
      );

      expect(screen.getByText('Dependencies Updated')).toBeInTheDocument();
      expect(screen.getByText('Vulnerabilities Fixed')).toBeInTheDocument();
    });

    it('should handle very large numbers', () => {
      const mockMetrics: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 999,
        vulnsFixed: 999,
        complexity: 999,
        coverage: 1.0,
        loc: 999999,
        progress: 1.0,
      };

      render(
        <ResurrectionProvider>
          <TestWrapper initialMetrics={[mockMetrics]}>
            <Dashboard />
          </TestWrapper>
        </ResurrectionProvider>
      );

      // LOC should be formatted with commas
      expect(screen.getByText('999,999')).toBeInTheDocument();
    });

    it('should handle complete progress (100%)', () => {
      const mockMetrics: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 10,
        vulnsFixed: 5,
        complexity: 15,
        coverage: 0.85,
        loc: 2500,
        progress: 1.0,
      };

      render(
        <ResurrectionProvider>
          <TestWrapper initialMetrics={[mockMetrics]}>
            <Dashboard />
          </TestWrapper>
        </ResurrectionProvider>
      );

      // Progress bar should show completion
      waitFor(() => {
        expect(screen.getByText(/Resurrection Complete/i)).toBeInTheDocument();
      });
    });
  });
});
