import { GhostTour } from './GhostTour';
import type { FileHistory, GitCommit } from '../types/ghostTour';

/**
 * Example usage of the GhostTour component
 * This demonstrates how to integrate the 3D visualization
 */

// Example file histories
const exampleFileHistories: FileHistory[] = [
  {
    path: 'src/index.ts',
    commits: [
      { hash: 'abc123', date: new Date('2023-01-01'), message: 'Initial commit', changes: 1 }
    ],
    totalChanges: 5,
    loc: 150,
    complexity: 8,
  },
  {
    path: 'src/utils/helper.ts',
    commits: [
      { hash: 'def456', date: new Date('2023-02-01'), message: 'Add helper', changes: 1 }
    ],
    totalChanges: 12,
    loc: 200,
    complexity: 15,
  },
  {
    path: 'src/components/App.tsx',
    commits: [
      { hash: 'ghi789', date: new Date('2023-03-01'), message: 'Create App', changes: 1 }
    ],
    totalChanges: 8,
    loc: 300,
    complexity: 20,
  },
];

// Example git commits
const exampleGitCommits: GitCommit[] = [
  {
    hash: 'abc123',
    date: new Date('2023-01-01'),
    message: 'Initial commit',
    author: 'John Doe',
    filesChanged: ['src/index.ts'],
  },
  {
    hash: 'def456',
    date: new Date('2023-02-01'),
    message: 'Add helper utilities',
    author: 'Jane Smith',
    filesChanged: ['src/utils/helper.ts'],
  },
  {
    hash: 'ghi789',
    date: new Date('2023-03-01'),
    message: 'Create main App component',
    author: 'John Doe',
    filesChanged: ['src/components/App.tsx'],
  },
];

export function GhostTourExample() {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <GhostTour
        fileHistories={exampleFileHistories}
        gitCommits={exampleGitCommits}
        enableRealTimeUpdates={false}
      />
    </div>
  );
}

/**
 * Usage with real-time updates:
 * 
 * import { useEventSource } from '../hooks';
 * 
 * function GhostTourWithRealTime() {
 *   const events = useEventSource('/api/events');
 *   
 *   return (
 *     <GhostTour
 *       fileHistories={fileHistories}
 *       gitCommits={gitCommits}
 *       events={events}
 *       enableRealTimeUpdates={true}
 *     />
 *   );
 * }
 */
