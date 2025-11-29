import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Timeline } from '../components/Timeline';
import type { TimelinePoint } from '../utils/gitHistoryProcessor';

describe('Timeline Component', () => {
  const mockTimeline: TimelinePoint[] = [
    {
      index: 0,
      timestamp: new Date('2024-01-01T10:00:00').getTime(),
      commitHash: 'abc123',
      date: new Date('2024-01-01T10:00:00'),
      message: 'Initial commit',
      author: 'Alice',
      filesChanged: 3,
    },
    {
      index: 1,
      timestamp: new Date('2024-01-02T11:00:00').getTime(),
      commitHash: 'def456',
      date: new Date('2024-01-02T11:00:00'),
      message: 'Add feature',
      author: 'Bob',
      filesChanged: 5,
    },
    {
      index: 2,
      timestamp: new Date('2024-01-03T12:00:00').getTime(),
      commitHash: 'ghi789',
      date: new Date('2024-01-03T12:00:00'),
      message: 'Fix bug',
      author: 'Charlie',
      filesChanged: 2,
    },
  ];

  let mockOnChange: ReturnType<typeof vi.fn>;
  let mockOnPlayPause: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnChange = vi.fn();
    mockOnPlayPause = vi.fn();
    vi.clearAllMocks();
  });

  describe('Empty State', () => {
    it('should display empty message when no timeline provided', () => {
      render(
        <Timeline
          timeline={[]}
          currentPosition={0}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('No git history available')).toBeInTheDocument();
    });

    it('should not render controls when timeline is empty', () => {
      const { container } = render(
        <Timeline
          timeline={[]}
          currentPosition={0}
          onChange={mockOnChange}
        />
      );

      expect(container.querySelector('.timeline-controls')).not.toBeInTheDocument();
      expect(container.querySelector('.timeline-slider')).not.toBeInTheDocument();
    });
  });

  describe('Timeline Controls', () => {
    it('should render all control buttons', () => {
      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={1}
          onChange={mockOnChange}
          onPlayPause={mockOnPlayPause}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3); // Previous, Play/Pause, Next
    });

    it('should disable previous button at start', () => {
      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={0}
          onChange={mockOnChange}
        />
      );

      const prevButton = screen.getByTitle('Previous commit');
      expect(prevButton).toBeDisabled();
    });

    it('should disable next button at end', () => {
      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={2}
          onChange={mockOnChange}
        />
      );

      const nextButton = screen.getByTitle('Next commit');
      expect(nextButton).toBeDisabled();
    });

    it('should enable both buttons in middle', () => {
      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={1}
          onChange={mockOnChange}
        />
      );

      const prevButton = screen.getByTitle('Previous commit');
      const nextButton = screen.getByTitle('Next commit');

      expect(prevButton).not.toBeDisabled();
      expect(nextButton).not.toBeDisabled();
    });

    it('should call onChange with previous position when previous clicked', () => {
      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={1}
          onChange={mockOnChange}
        />
      );

      const prevButton = screen.getByTitle('Previous commit');
      fireEvent.click(prevButton);

      expect(mockOnChange).toHaveBeenCalledWith(0);
    });

    it('should call onChange with next position when next clicked', () => {
      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={1}
          onChange={mockOnChange}
        />
      );

      const nextButton = screen.getByTitle('Next commit');
      fireEvent.click(nextButton);

      expect(mockOnChange).toHaveBeenCalledWith(2);
    });

    it('should not go below 0 when clicking previous at start', () => {
      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={0}
          onChange={mockOnChange}
        />
      );

      const prevButton = screen.getByTitle('Previous commit');
      // Button should be disabled, so clicking won't call onChange
      expect(prevButton).toBeDisabled();
      fireEvent.click(prevButton);

      // onChange should not be called when button is disabled
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('should not go beyond last when clicking next at end', () => {
      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={2}
          onChange={mockOnChange}
        />
      );

      const nextButton = screen.getByTitle('Next commit');
      // Button should be disabled, so clicking won't call onChange
      expect(nextButton).toBeDisabled();
      fireEvent.click(nextButton);

      // onChange should not be called when button is disabled
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Play/Pause Functionality', () => {
    it('should render play button when not playing', () => {
      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={0}
          onChange={mockOnChange}
          isPlaying={false}
          onPlayPause={mockOnPlayPause}
        />
      );

      const playButton = screen.getByTitle('Play');
      expect(playButton).toHaveTextContent('▶');
    });

    it('should render pause button when playing', () => {
      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={0}
          onChange={mockOnChange}
          isPlaying={true}
          onPlayPause={mockOnPlayPause}
        />
      );

      const pauseButton = screen.getByTitle('Pause');
      expect(pauseButton).toHaveTextContent('⏸');
    });

    it('should call onPlayPause when play button clicked', () => {
      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={0}
          onChange={mockOnChange}
          isPlaying={false}
          onPlayPause={mockOnPlayPause}
        />
      );

      const playButton = screen.getByTitle('Play');
      fireEvent.click(playButton);

      expect(mockOnPlayPause).toHaveBeenCalled();
    });

    it('should not render play/pause button if onPlayPause not provided', () => {
      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={0}
          onChange={mockOnChange}
        />
      );

      expect(screen.queryByTitle('Play')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Pause')).not.toBeInTheDocument();
    });

    it('should auto-advance when playing', async () => {
      vi.useFakeTimers();

      const { rerender } = render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={0}
          onChange={mockOnChange}
          isPlaying={true}
          onPlayPause={mockOnPlayPause}
        />
      );

      // Advance time by 1 second and run all timers
      await vi.advanceTimersByTimeAsync(1000);

      // Check if onChange was called
      expect(mockOnChange).toHaveBeenCalledWith(1);

      vi.useRealTimers();
    });

    it('should not auto-advance when not playing', async () => {
      vi.useFakeTimers();

      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={0}
          onChange={mockOnChange}
          isPlaying={false}
          onPlayPause={mockOnPlayPause}
        />
      );

      vi.advanceTimersByTime(1000);

      expect(mockOnChange).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should stop auto-advancing at end of timeline', async () => {
      vi.useFakeTimers();

      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={2}
          onChange={mockOnChange}
          isPlaying={true}
          onPlayPause={mockOnPlayPause}
        />
      );

      vi.advanceTimersByTime(1000);

      expect(mockOnChange).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('Slider Functionality', () => {
    it('should render slider with correct range', () => {
      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={1}
          onChange={mockOnChange}
        />
      );

      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('min', '0');
      expect(slider).toHaveAttribute('max', '2');
    });

    it('should set slider value to current position', () => {
      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={1}
          onChange={mockOnChange}
        />
      );

      const slider = screen.getByRole('slider') as HTMLInputElement;
      expect(slider.value).toBe('1');
    });

    it('should call onChange when slider moved', () => {
      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={0}
          onChange={mockOnChange}
        />
      );

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '2' } });

      expect(mockOnChange).toHaveBeenCalledWith(2);
    });

    it('should update progress bar width based on position', () => {
      const { container } = render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={1}
          onChange={mockOnChange}
        />
      );

      const progressBar = container.querySelector('.timeline-progress') as HTMLElement;
      expect(progressBar).toBeInTheDocument();
      // Position 1 out of 2 (0-indexed, so 1/(3-1) = 0.5 = 50%)
      expect(progressBar.style.width).toBe('50%');
    });

    it('should show 0% progress at start', () => {
      const { container } = render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={0}
          onChange={mockOnChange}
        />
      );

      const progressBar = container.querySelector('.timeline-progress') as HTMLElement;
      expect(progressBar.style.width).toBe('0%');
    });

    it('should show 100% progress at end', () => {
      const { container } = render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={2}
          onChange={mockOnChange}
        />
      );

      const progressBar = container.querySelector('.timeline-progress') as HTMLElement;
      expect(progressBar.style.width).toBe('100%');
    });
  });

  describe('Timeline Info Display', () => {
    it('should display current commit information', () => {
      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={1}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Add feature')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('5 files changed')).toBeInTheDocument();
    });

    it('should display commit position', () => {
      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={1}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Commit 2 of 3')).toBeInTheDocument();
    });

    it('should format date correctly', () => {
      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={0}
          onChange={mockOnChange}
        />
      );

      const expectedDate = new Date('2024-01-01T10:00:00').toLocaleDateString();
      expect(screen.getByText(new RegExp(expectedDate))).toBeInTheDocument();
    });

    it('should format time correctly', () => {
      render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={0}
          onChange={mockOnChange}
        />
      );

      const expectedTime = new Date('2024-01-01T10:00:00').toLocaleTimeString();
      expect(screen.getByText(new RegExp(expectedTime))).toBeInTheDocument();
    });

    it('should update info when position changes', () => {
      const { rerender } = render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={0}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Initial commit')).toBeInTheDocument();

      rerender(
        <Timeline
          timeline={mockTimeline}
          currentPosition={1}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Add feature')).toBeInTheDocument();
      expect(screen.queryByText('Initial commit')).not.toBeInTheDocument();
    });

    it('should display singular "file changed" for one file', () => {
      const singleFileTimeline: TimelinePoint[] = [
        {
          index: 0,
          timestamp: Date.now(),
          commitHash: 'abc123',
          date: new Date(),
          message: 'Update',
          author: 'Alice',
          filesChanged: 1,
        },
      ];

      render(
        <Timeline
          timeline={singleFileTimeline}
          currentPosition={0}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('1 files changed')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single commit timeline', () => {
      const singleCommit: TimelinePoint[] = [mockTimeline[0]];

      render(
        <Timeline
          timeline={singleCommit}
          currentPosition={0}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Commit 1 of 1')).toBeInTheDocument();
      expect(screen.getByTitle('Previous commit')).toBeDisabled();
      expect(screen.getByTitle('Next commit')).toBeDisabled();
    });

    it('should handle very long commit messages', () => {
      const longMessageTimeline: TimelinePoint[] = [
        {
          ...mockTimeline[0],
          message: 'This is a very long commit message that should still be displayed correctly without breaking the layout or causing any issues with the component rendering',
        },
      ];

      render(
        <Timeline
          timeline={longMessageTimeline}
          currentPosition={0}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText(/This is a very long commit message/)).toBeInTheDocument();
    });

    it('should handle commits with no files changed', () => {
      const noFilesTimeline: TimelinePoint[] = [
        {
          ...mockTimeline[0],
          filesChanged: 0,
        },
      ];

      render(
        <Timeline
          timeline={noFilesTimeline}
          currentPosition={0}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('0 files changed')).toBeInTheDocument();
    });

    it('should handle very large number of files changed', () => {
      const manyFilesTimeline: TimelinePoint[] = [
        {
          ...mockTimeline[0],
          filesChanged: 999,
        },
      ];

      render(
        <Timeline
          timeline={manyFilesTimeline}
          currentPosition={0}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('999 files changed')).toBeInTheDocument();
    });
  });

  describe('CSS Classes', () => {
    it('should have correct container class', () => {
      const { container } = render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={0}
          onChange={mockOnChange}
        />
      );

      expect(container.querySelector('.timeline-container')).toBeInTheDocument();
    });

    it('should have correct controls class', () => {
      const { container } = render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={0}
          onChange={mockOnChange}
        />
      );

      expect(container.querySelector('.timeline-controls')).toBeInTheDocument();
    });

    it('should have correct slider container class', () => {
      const { container } = render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={0}
          onChange={mockOnChange}
        />
      );

      expect(container.querySelector('.timeline-slider-container')).toBeInTheDocument();
    });

    it('should have correct info class', () => {
      const { container } = render(
        <Timeline
          timeline={mockTimeline}
          currentPosition={0}
          onChange={mockOnChange}
        />
      );

      expect(container.querySelector('.timeline-info')).toBeInTheDocument();
    });
  });
});
