import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GhostTour } from '../components/GhostTour';
import type { FileHistory, GitCommit } from '../types/ghostTour';

// Mock Three.js and React Three Fiber
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: any) => <div data-testid="three-canvas">{children}</div>,
  useFrame: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <primitive data-testid="orbit-controls" />,
  PerspectiveCamera: () => <primitive data-testid="perspective-camera" />,
  Text: ({ children }: any) => <div data-testid="three-text">{children}</div>,
}));

// Mock Building component
vi.mock('../components/Building', () => ({
  Building: ({ name, onClick, isHotspot }: any) => (
    <div
      data-testid={`building-${name}`}
      data-hotspot={isHotspot}
      onClick={() => onClick && onClick({ name, path: `src/${name}`, loc: 100, complexity: 10, changeFrequency: 5 })}
    >
      {name}
    </div>
  ),
}));

// Mock Timeline component
vi.mock('../components/Timeline', () => ({
  Timeline: ({ timeline, currentPosition, onChange, isPlaying, onPlayPause }: any) => (
    <div data-testid="timeline">
      <button onClick={() => onChange(currentPosition - 1)}>Previous</button>
      <button onClick={() => onPlayPause && onPlayPause()}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <button onClick={() => onChange(currentPosition + 1)}>Next</button>
      <span data-testid="timeline-position">{currentPosition}</span>
    </div>
  ),
}));

// Mock hooks
vi.mock('../hooks/useGhostTourUpdates', () => ({
  useGhostTourUpdates: (fileHistories: any) => ({ fileHistories }),
}));

// Mock exporter
vi.mock('../utils/ghostTourExporter', () => ({
  downloadGhostTourHTML: vi.fn(),
}));

describe('GhostTour Component', () => {
  const mockFileHistories: FileHistory[] = [
    {
      path: 'src/file1.ts',
      commits: [
        {
          hash: 'abc123',
          date: new Date('2024-01-01'),
          message: 'Initial',
          changes: 1,
        },
      ],
      totalChanges: 5,
      loc: 100,
      complexity: 10,
    },
    {
      path: 'src/file2.ts',
      commits: [
        {
          hash: 'def456',
          date: new Date('2024-01-02'),
          message: 'Update',
          changes: 1,
        },
      ],
      totalChanges: 10,
      loc: 200,
      complexity: 15,
    },
  ];

  const mockGitCommits: GitCommit[] = [
    {
      hash: 'abc123',
      date: new Date('2024-01-01'),
      message: 'Initial commit',
      author: 'Alice',
      filesChanged: ['src/file1.ts'],
    },
    {
      hash: 'def456',
      date: new Date('2024-01-02'),
      message: 'Update file',
      author: 'Bob',
      filesChanged: ['src/file2.ts'],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render Three.js canvas', () => {
      render(<GhostTour fileHistories={mockFileHistories} />);
      expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
    });

    it('should render orbit controls', () => {
      render(<GhostTour fileHistories={mockFileHistories} />);
      expect(screen.getByTestId('orbit-controls')).toBeInTheDocument();
    });

    it('should render perspective camera', () => {
      render(<GhostTour fileHistories={mockFileHistories} />);
      expect(screen.getByTestId('perspective-camera')).toBeInTheDocument();
    });

    it('should render export button', () => {
      render(<GhostTour fileHistories={mockFileHistories} />);
      expect(screen.getByText('📥 Export')).toBeInTheDocument();
    });

    it('should render buildings for each file history', () => {
      render(<GhostTour fileHistories={mockFileHistories} />);
      
      // Buildings are generated with file names extracted from paths
      expect(screen.getByTestId('building-file1.ts')).toBeInTheDocument();
      expect(screen.getByTestId('building-file2.ts')).toBeInTheDocument();
    });

    it('should not render timeline when no git commits provided', () => {
      render(<GhostTour fileHistories={mockFileHistories} />);
      expect(screen.queryByTestId('timeline')).not.toBeInTheDocument();
    });

    it('should render timeline when git commits provided', () => {
      render(
        <GhostTour
          fileHistories={mockFileHistories}
          gitCommits={mockGitCommits}
        />
      );
      expect(screen.getByTestId('timeline')).toBeInTheDocument();
    });
  });

  describe('Building Generation', () => {
    it('should generate buildings from file histories', () => {
      render(<GhostTour fileHistories={mockFileHistories} />);
      
      const buildings = screen.getAllByTestId(/^building-/);
      expect(buildings).toHaveLength(2);
    });

    it('should handle empty file histories', () => {
      render(<GhostTour fileHistories={[]} />);
      
      const buildings = screen.queryAllByTestId(/^building-/);
      expect(buildings).toHaveLength(0);
    });

    it('should process git history when commits provided but no file histories', () => {
      render(
        <GhostTour
          fileHistories={[]}
          gitCommits={mockGitCommits}
        />
      );
      
      // Should generate file histories from commits
      const buildings = screen.queryAllByTestId(/^building-/);
      expect(buildings.length).toBeGreaterThan(0);
    });
  });

  describe('Hotspot Detection', () => {
    it('should identify hotspot buildings', () => {
      render(<GhostTour fileHistories={mockFileHistories} />);
      
      // file2.ts has more changes (10 vs 5), so it should be a hotspot
      const file2Building = screen.getByTestId('building-file2.ts');
      expect(file2Building).toHaveAttribute('data-hotspot', 'true');
    });

    it('should not mark low-change files as hotspots', () => {
      render(<GhostTour fileHistories={mockFileHistories} />);
      
      // file1.ts has fewer changes, so it should not be a hotspot
      const file1Building = screen.getByTestId('building-file1.ts');
      expect(file1Building).toHaveAttribute('data-hotspot', 'false');
    });
  });

  describe('Building Selection', () => {
    it('should show building info when building clicked', () => {
      render(<GhostTour fileHistories={mockFileHistories} />);
      
      const building = screen.getByTestId('building-file1.ts');
      fireEvent.click(building);
      
      // Use more specific query to avoid ambiguity
      expect(screen.getByRole('heading', { name: 'file1.ts' })).toBeInTheDocument();
      expect(screen.getByText('src/file1.ts')).toBeInTheDocument();
    });

    it('should display building stats in info panel', () => {
      render(<GhostTour fileHistories={mockFileHistories} />);
      
      const building = screen.getByTestId('building-file1.ts');
      fireEvent.click(building);
      
      expect(screen.getByText('Lines of Code:')).toBeInTheDocument();
      expect(screen.getByText('Complexity:')).toBeInTheDocument();
      expect(screen.getByText('Changes:')).toBeInTheDocument();
    });

    it('should close building info when close button clicked', () => {
      render(<GhostTour fileHistories={mockFileHistories} />);
      
      const building = screen.getByTestId('building-file1.ts');
      fireEvent.click(building);
      
      expect(screen.getByRole('heading', { name: 'file1.ts' })).toBeInTheDocument();
      
      const closeButton = screen.getByText('✕');
      fireEvent.click(closeButton);
      
      expect(screen.queryByRole('heading', { name: 'file1.ts' })).not.toBeInTheDocument();
    });

    it('should not show info panel initially', () => {
      render(<GhostTour fileHistories={mockFileHistories} />);
      
      expect(screen.queryByText('Lines of Code:')).not.toBeInTheDocument();
    });
  });

  describe('Timeline Functionality', () => {
    it('should initialize timeline at position 0', () => {
      render(
        <GhostTour
          fileHistories={mockFileHistories}
          gitCommits={mockGitCommits}
        />
      );
      
      expect(screen.getByTestId('timeline-position')).toHaveTextContent('0');
    });

    it('should update timeline position when changed', () => {
      render(
        <GhostTour
          fileHistories={mockFileHistories}
          gitCommits={mockGitCommits}
        />
      );
      
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
      
      expect(screen.getByTestId('timeline-position')).toHaveTextContent('1');
    });

    it('should toggle play state when play/pause clicked', () => {
      render(
        <GhostTour
          fileHistories={mockFileHistories}
          gitCommits={mockGitCommits}
        />
      );
      
      const playButton = screen.getByText('Play');
      expect(playButton).toBeInTheDocument();
      
      fireEvent.click(playButton);
      
      expect(screen.getByText('Pause')).toBeInTheDocument();
    });
  });

  describe('Export Functionality', () => {
    it('should call export function when export button clicked', async () => {
      const { downloadGhostTourHTML } = await import('../utils/ghostTourExporter');
      
      render(
        <GhostTour
          fileHistories={mockFileHistories}
          gitCommits={mockGitCommits}
        />
      );
      
      const exportButton = screen.getByText('📥 Export');
      fireEvent.click(exportButton);
      
      expect(downloadGhostTourHTML).toHaveBeenCalledWith(
        mockFileHistories,
        mockGitCommits,
        'CodeCrypt Ghost Tour'
      );
    });
  });

  describe('Real-time Updates', () => {
    it('should use updated file histories when real-time updates enabled', () => {
      const events = [
        { type: 'transformation_applied', data: { file: 'src/file1.ts' } },
      ];
      
      render(
        <GhostTour
          fileHistories={mockFileHistories}
          events={events}
          enableRealTimeUpdates={true}
        />
      );
      
      // Should render buildings (exact behavior depends on useGhostTourUpdates implementation)
      expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
    });

    it('should not use real-time updates when disabled', () => {
      const events = [
        { type: 'transformation_applied', data: { file: 'src/file1.ts' } },
      ];
      
      render(
        <GhostTour
          fileHistories={mockFileHistories}
          events={events}
          enableRealTimeUpdates={false}
        />
      );
      
      // Should still render normally
      expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined props gracefully', () => {
      render(<GhostTour />);
      
      expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
      expect(screen.queryByTestId('timeline')).not.toBeInTheDocument();
    });

    it('should handle single file history', () => {
      const singleFile: FileHistory[] = [mockFileHistories[0]];
      
      render(<GhostTour fileHistories={singleFile} />);
      
      const buildings = screen.getAllByTestId(/^building-/);
      expect(buildings).toHaveLength(1);
    });

    it('should handle single commit', () => {
      const singleCommit: GitCommit[] = [mockGitCommits[0]];
      
      render(
        <GhostTour
          fileHistories={mockFileHistories}
          gitCommits={singleCommit}
        />
      );
      
      expect(screen.getByTestId('timeline')).toBeInTheDocument();
    });

    it('should handle files with very long paths', () => {
      const longPathHistory: FileHistory[] = [
        {
          path: 'src/very/deeply/nested/directory/structure/with/many/levels/file.ts',
          commits: [],
          totalChanges: 5,
          loc: 100,
          complexity: 10,
        },
      ];
      
      render(<GhostTour fileHistories={longPathHistory} />);
      
      expect(screen.getByTestId('building-file.ts')).toBeInTheDocument();
    });

    it('should handle files with zero changes', () => {
      const noChangesHistory: FileHistory[] = [
        {
          path: 'src/file.ts',
          commits: [],
          totalChanges: 0,
          loc: 100,
          complexity: 10,
        },
      ];
      
      render(<GhostTour fileHistories={noChangesHistory} />);
      
      const building = screen.getByTestId('building-file.ts');
      expect(building).toHaveAttribute('data-hotspot', 'false');
    });

    it('should handle files with very high metrics', () => {
      const highMetricsHistory: FileHistory[] = [
        {
          path: 'src/large-file.ts',
          commits: [],
          totalChanges: 1000,
          loc: 10000,
          complexity: 500,
        },
      ];
      
      render(<GhostTour fileHistories={highMetricsHistory} />);
      
      expect(screen.getByTestId('building-large-file.ts')).toBeInTheDocument();
    });
  });

  describe('CSS Classes', () => {
    it('should have correct container class', () => {
      const { container } = render(<GhostTour fileHistories={mockFileHistories} />);
      
      expect(container.querySelector('.ghost-tour-container')).toBeInTheDocument();
    });

    it('should have correct building info class when building selected', () => {
      const { container } = render(<GhostTour fileHistories={mockFileHistories} />);
      
      const building = screen.getByTestId('building-file1.ts');
      fireEvent.click(building);
      
      expect(container.querySelector('.building-info')).toBeInTheDocument();
    });

    it('should have correct export button class', () => {
      const { container } = render(<GhostTour fileHistories={mockFileHistories} />);
      
      expect(container.querySelector('.export-button')).toBeInTheDocument();
    });
  });
});
