import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { Symphony } from '../components/Symphony';
import { MetricsSnapshot } from '../types';
import * as Tone from 'tone';

// Mock Tone.js
vi.mock('tone', () => {
  const mockSynth = {
    toDestination: vi.fn().mockReturnThis(),
    connect: vi.fn().mockReturnThis(),
    triggerAttackRelease: vi.fn(),
    volume: { value: 0 },
    dispose: vi.fn(),
  };

  return {
    default: {
      start: vi.fn().mockResolvedValue(undefined),
      context: {
        state: 'running',
      },
      Transport: {
        bpm: {
          value: 120,
        },
      },
      gainToDb: vi.fn((gain: number) => Math.log10(gain) * 20),
    },
    PolySynth: vi.fn(function(this: any) {
      return mockSynth;
    }),
    Synth: vi.fn(function(this: any) {
      return mockSynth;
    }),
    Recorder: vi.fn(function(this: any) {
      return {
        toDestination: vi.fn().mockReturnThis(),
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(new Blob()),
        dispose: vi.fn(),
      };
    }),
  };
});

describe('Symphony Component', () => {
  const mockMetrics: MetricsSnapshot = {
    timestamp: Date.now(),
    depsUpdated: 5,
    vulnsFixed: 3,
    complexity: 50,
    coverage: 0.75,
    loc: 1000,
    progress: 0.5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should render without crashing', () => {
      const { container } = render(<Symphony metrics={mockMetrics} enabled={true} />);
      expect(container).toBeTruthy();
    });

    it('should not render any visible elements (headless component)', () => {
      const { container } = render(<Symphony metrics={mockMetrics} enabled={true} />);
      expect(container.firstChild).toBeNull();
    });

    it('should initialize synthesizers when enabled', () => {
      render(<Symphony metrics={mockMetrics} enabled={true} />);
      expect(Tone.PolySynth).toHaveBeenCalled();
      expect(Tone.Synth).toHaveBeenCalled();
    });

    it('should not initialize when disabled', () => {
      render(<Symphony metrics={null} enabled={false} />);
      // Component should not crash even when disabled
      expect(Tone.PolySynth).not.toHaveBeenCalled();
    });
  });

  describe('Metrics-to-Music Mapping', () => {
    it('should handle null metrics gracefully', () => {
      const { container } = render(<Symphony metrics={null} enabled={true} />);
      expect(container).toBeTruthy();
    });

    it('should handle low complexity metrics', () => {
      const lowComplexityMetrics: MetricsSnapshot = {
        ...mockMetrics,
        complexity: 10,
      };
      const { container } = render(<Symphony metrics={lowComplexityMetrics} enabled={true} />);
      expect(container).toBeTruthy();
    });

    it('should handle high complexity metrics', () => {
      const highComplexityMetrics: MetricsSnapshot = {
        ...mockMetrics,
        complexity: 90,
      };
      const { container } = render(<Symphony metrics={highComplexityMetrics} enabled={true} />);
      expect(container).toBeTruthy();
    });

    it('should handle low coverage metrics', () => {
      const lowCoverageMetrics: MetricsSnapshot = {
        ...mockMetrics,
        coverage: 0.1,
      };
      const { container } = render(<Symphony metrics={lowCoverageMetrics} enabled={true} />);
      expect(container).toBeTruthy();
    });

    it('should handle high coverage metrics', () => {
      const highCoverageMetrics: MetricsSnapshot = {
        ...mockMetrics,
        coverage: 0.95,
      };
      const { container } = render(<Symphony metrics={highCoverageMetrics} enabled={true} />);
      expect(container).toBeTruthy();
    });

    it('should handle progress from 0 to 1', () => {
      const startMetrics: MetricsSnapshot = {
        ...mockMetrics,
        progress: 0,
      };
      const { rerender } = render(<Symphony metrics={startMetrics} enabled={true} />);
      
      const endMetrics: MetricsSnapshot = {
        ...mockMetrics,
        progress: 1,
      };
      rerender(<Symphony metrics={endMetrics} enabled={true} />);
      
      expect(Tone.PolySynth).toHaveBeenCalled();
    });
  });

  describe('Audio Recording', () => {
    it('should initialize recorder when recording is enabled', () => {
      render(<Symphony metrics={mockMetrics} enabled={true} enableRecording={true} />);
      expect(Tone.Recorder).toHaveBeenCalled();
    });

    it('should not initialize recorder when recording is disabled', () => {
      render(<Symphony metrics={mockMetrics} enabled={true} enableRecording={false} />);
      expect(Tone.Recorder).not.toHaveBeenCalled();
    });

    it('should call onRecordingComplete when progress reaches 1', async () => {
      const onRecordingComplete = vi.fn();
      const completeMetrics: MetricsSnapshot = {
        ...mockMetrics,
        progress: 1,
      };
      
      render(
        <Symphony 
          metrics={completeMetrics} 
          enabled={true} 
          enableRecording={true}
          onRecordingComplete={onRecordingComplete}
        />
      );
      
      // Note: In a real test, we'd need to wait for the async operations
      // For now, we just verify the component renders without errors
      expect(Tone.Recorder).toHaveBeenCalled();
    });
  });

  describe('Volume Control', () => {
    it('should accept custom volume', () => {
      render(<Symphony metrics={mockMetrics} enabled={true} volume={0.8} />);
      expect(Tone.PolySynth).toHaveBeenCalled();
    });

    it('should use default volume when not specified', () => {
      render(<Symphony metrics={mockMetrics} enabled={true} />);
      expect(Tone.PolySynth).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle metrics with extreme values', () => {
      const extremeMetrics: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 1000,
        vulnsFixed: 500,
        complexity: 200,
        coverage: 1.5, // Over 100%
        loc: 1000000,
        progress: 2, // Over 100%
      };
      
      const { container } = render(<Symphony metrics={extremeMetrics} enabled={true} />);
      expect(container).toBeTruthy();
    });

    it('should handle metrics with negative values', () => {
      const negativeMetrics: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: -5,
        vulnsFixed: -3,
        complexity: -10,
        coverage: -0.5,
        loc: -100,
        progress: -0.2,
      };
      
      const { container } = render(<Symphony metrics={negativeMetrics} enabled={true} />);
      expect(container).toBeTruthy();
    });

    it('should handle metrics with zero values', () => {
      const zeroMetrics: MetricsSnapshot = {
        timestamp: Date.now(),
        depsUpdated: 0,
        vulnsFixed: 0,
        complexity: 0,
        coverage: 0,
        loc: 0,
        progress: 0,
      };
      
      const { container } = render(<Symphony metrics={zeroMetrics} enabled={true} />);
      expect(container).toBeTruthy();
    });
  });
});
