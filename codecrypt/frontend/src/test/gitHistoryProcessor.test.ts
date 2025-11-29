import { describe, it, expect } from 'vitest';
import {
  processGitHistory,
  generateBuildingSnapshots,
  createTimeline,
  getBuildingsAtTimelinePosition,
} from '../utils/gitHistoryProcessor';
import type { GitCommit, FileHistory } from '../types/ghostTour';

describe('gitHistoryProcessor', () => {
  describe('processGitHistory', () => {
    it('should return empty array for empty commits', () => {
      const fileHistories = processGitHistory([]);
      expect(fileHistories).toHaveLength(0);
    });

    it('should create file history for each unique file', () => {
      const commits: GitCommit[] = [
        {
          hash: 'abc123',
          date: new Date('2024-01-01'),
          message: 'Initial commit',
          author: 'Alice',
          filesChanged: ['src/file1.ts', 'src/file2.ts'],
        },
      ];

      const fileHistories = processGitHistory(commits);
      expect(fileHistories).toHaveLength(2);
    });

    it('should track commits for each file', () => {
      const commits: GitCommit[] = [
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
          filesChanged: ['src/file1.ts'],
        },
      ];

      const fileHistories = processGitHistory(commits);
      expect(fileHistories).toHaveLength(1);
      expect(fileHistories[0].commits).toHaveLength(2);
    });

    it('should count total changes correctly', () => {
      const commits: GitCommit[] = [
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
          filesChanged: ['src/file1.ts'],
        },
        {
          hash: 'ghi789',
          date: new Date('2024-01-03'),
          message: 'Another update',
          author: 'Charlie',
          filesChanged: ['src/file1.ts'],
        },
      ];

      const fileHistories = processGitHistory(commits);
      expect(fileHistories[0].totalChanges).toBe(3);
    });

    it('should process commits in chronological order', () => {
      const commits: GitCommit[] = [
        {
          hash: 'def456',
          date: new Date('2024-01-02'),
          message: 'Second commit',
          author: 'Bob',
          filesChanged: ['src/file1.ts'],
        },
        {
          hash: 'abc123',
          date: new Date('2024-01-01'),
          message: 'First commit',
          author: 'Alice',
          filesChanged: ['src/file1.ts'],
        },
      ];

      const fileHistories = processGitHistory(commits);
      expect(fileHistories[0].commits[0].hash).toBe('abc123');
      expect(fileHistories[0].commits[1].hash).toBe('def456');
    });

    it('should set default LOC and complexity', () => {
      const commits: GitCommit[] = [
        {
          hash: 'abc123',
          date: new Date('2024-01-01'),
          message: 'Initial commit',
          author: 'Alice',
          filesChanged: ['src/file1.ts'],
        },
      ];

      const fileHistories = processGitHistory(commits);
      expect(fileHistories[0].loc).toBe(100);
      expect(fileHistories[0].complexity).toBe(5);
    });

    it('should handle multiple files changed in same commit', () => {
      const commits: GitCommit[] = [
        {
          hash: 'abc123',
          date: new Date('2024-01-01'),
          message: 'Initial commit',
          author: 'Alice',
          filesChanged: ['src/file1.ts', 'src/file2.ts', 'src/file3.ts'],
        },
      ];

      const fileHistories = processGitHistory(commits);
      expect(fileHistories).toHaveLength(3);
      fileHistories.forEach(fh => {
        expect(fh.commits).toHaveLength(1);
        expect(fh.commits[0].hash).toBe('abc123');
      });
    });

    it('should preserve file paths', () => {
      const commits: GitCommit[] = [
        {
          hash: 'abc123',
          date: new Date('2024-01-01'),
          message: 'Initial commit',
          author: 'Alice',
          filesChanged: ['src/components/Button.tsx'],
        },
      ];

      const fileHistories = processGitHistory(commits);
      expect(fileHistories[0].path).toBe('src/components/Button.tsx');
    });
  });

  describe('createTimeline', () => {
    it('should return empty array for empty commits', () => {
      const timeline = createTimeline([]);
      expect(timeline).toHaveLength(0);
    });

    it('should create timeline point for each commit', () => {
      const commits: GitCommit[] = [
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
          message: 'Second commit',
          author: 'Bob',
          filesChanged: ['src/file2.ts'],
        },
      ];

      const timeline = createTimeline(commits);
      expect(timeline).toHaveLength(2);
    });

    it('should sort commits chronologically', () => {
      const commits: GitCommit[] = [
        {
          hash: 'def456',
          date: new Date('2024-01-02'),
          message: 'Second commit',
          author: 'Bob',
          filesChanged: ['src/file2.ts'],
        },
        {
          hash: 'abc123',
          date: new Date('2024-01-01'),
          message: 'First commit',
          author: 'Alice',
          filesChanged: ['src/file1.ts'],
        },
      ];

      const timeline = createTimeline(commits);
      expect(timeline[0].commitHash).toBe('abc123');
      expect(timeline[1].commitHash).toBe('def456');
    });

    it('should assign sequential indices', () => {
      const commits: GitCommit[] = [
        {
          hash: 'abc123',
          date: new Date('2024-01-01'),
          message: 'First',
          author: 'Alice',
          filesChanged: ['src/file1.ts'],
        },
        {
          hash: 'def456',
          date: new Date('2024-01-02'),
          message: 'Second',
          author: 'Bob',
          filesChanged: ['src/file2.ts'],
        },
        {
          hash: 'ghi789',
          date: new Date('2024-01-03'),
          message: 'Third',
          author: 'Charlie',
          filesChanged: ['src/file3.ts'],
        },
      ];

      const timeline = createTimeline(commits);
      expect(timeline[0].index).toBe(0);
      expect(timeline[1].index).toBe(1);
      expect(timeline[2].index).toBe(2);
    });

    it('should include all commit metadata', () => {
      const commits: GitCommit[] = [
        {
          hash: 'abc123',
          date: new Date('2024-01-01T10:30:00'),
          message: 'Initial commit',
          author: 'Alice',
          filesChanged: ['src/file1.ts', 'src/file2.ts'],
        },
      ];

      const timeline = createTimeline(commits);
      const point = timeline[0];

      expect(point.commitHash).toBe('abc123');
      expect(point.message).toBe('Initial commit');
      expect(point.author).toBe('Alice');
      expect(point.filesChanged).toBe(2);
      expect(point.date).toEqual(new Date('2024-01-01T10:30:00'));
      expect(point.timestamp).toBe(new Date('2024-01-01T10:30:00').getTime());
    });

    it('should handle commits with no files changed', () => {
      const commits: GitCommit[] = [
        {
          hash: 'abc123',
          date: new Date('2024-01-01'),
          message: 'Empty commit',
          author: 'Alice',
          filesChanged: [],
        },
      ];

      const timeline = createTimeline(commits);
      expect(timeline[0].filesChanged).toBe(0);
    });
  });

  describe('generateBuildingSnapshots', () => {
    it('should return empty map for empty file histories', () => {
      const commits: GitCommit[] = [
        {
          hash: 'abc123',
          date: new Date('2024-01-01'),
          message: 'Initial commit',
          author: 'Alice',
          filesChanged: ['src/file1.ts'],
        },
      ];

      const snapshotMap = generateBuildingSnapshots([], commits);
      expect(snapshotMap.size).toBe(0);
    });

    it('should create snapshots for each file', () => {
      const fileHistories: FileHistory[] = [
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
          totalChanges: 1,
          loc: 100,
          complexity: 5,
        },
      ];

      const commits: GitCommit[] = [
        {
          hash: 'abc123',
          date: new Date('2024-01-01'),
          message: 'Initial commit',
          author: 'Alice',
          filesChanged: ['src/file1.ts'],
        },
      ];

      const snapshotMap = generateBuildingSnapshots(fileHistories, commits);
      expect(snapshotMap.size).toBe(1);
      expect(snapshotMap.has('src/file1.ts')).toBe(true);
    });

    it('should create snapshot for each commit', () => {
      const fileHistories: FileHistory[] = [
        {
          path: 'src/file1.ts',
          commits: [
            {
              hash: 'abc123',
              date: new Date('2024-01-01'),
              message: 'Initial',
              changes: 1,
            },
            {
              hash: 'def456',
              date: new Date('2024-01-02'),
              message: 'Update',
              changes: 1,
            },
          ],
          totalChanges: 2,
          loc: 100,
          complexity: 5,
        },
      ];

      const commits: GitCommit[] = [
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
          message: 'Update',
          author: 'Bob',
          filesChanged: ['src/file1.ts'],
        },
      ];

      const snapshotMap = generateBuildingSnapshots(fileHistories, commits);
      const snapshots = snapshotMap.get('src/file1.ts')!;
      expect(snapshots).toHaveLength(2);
    });

    it('should include snapshots even when file not changed', () => {
      const fileHistories: FileHistory[] = [
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
          totalChanges: 1,
          loc: 100,
          complexity: 5,
        },
      ];

      const commits: GitCommit[] = [
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
          message: 'Update other file',
          author: 'Bob',
          filesChanged: ['src/file2.ts'],
        },
      ];

      const snapshotMap = generateBuildingSnapshots(fileHistories, commits);
      const snapshots = snapshotMap.get('src/file1.ts')!;
      expect(snapshots).toHaveLength(2);
    });

    it('should include correct metadata in snapshots', () => {
      const fileHistories: FileHistory[] = [
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
          totalChanges: 1,
          loc: 100,
          complexity: 5,
        },
      ];

      const commits: GitCommit[] = [
        {
          hash: 'abc123',
          date: new Date('2024-01-01'),
          message: 'Initial commit',
          author: 'Alice',
          filesChanged: ['src/file1.ts'],
        },
      ];

      const snapshotMap = generateBuildingSnapshots(fileHistories, commits);
      const snapshot = snapshotMap.get('src/file1.ts')![0];

      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('commitHash');
      expect(snapshot).toHaveProperty('height');
      expect(snapshot).toHaveProperty('color');
      expect(snapshot).toHaveProperty('loc');
      expect(snapshot).toHaveProperty('complexity');
    });

    it('should increase metrics when file is changed', () => {
      const fileHistories: FileHistory[] = [
        {
          path: 'src/file1.ts',
          commits: [
            {
              hash: 'abc123',
              date: new Date('2024-01-01'),
              message: 'Initial',
              changes: 1,
            },
            {
              hash: 'def456',
              date: new Date('2024-01-02'),
              message: 'Update',
              changes: 1,
            },
          ],
          totalChanges: 2,
          loc: 100,
          complexity: 5,
        },
      ];

      const commits: GitCommit[] = [
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
          message: 'Update',
          author: 'Bob',
          filesChanged: ['src/file1.ts'],
        },
      ];

      const snapshotMap = generateBuildingSnapshots(fileHistories, commits);
      const snapshots = snapshotMap.get('src/file1.ts')!;

      expect(snapshots[1].loc).toBeGreaterThan(snapshots[0].loc);
      expect(snapshots[1].complexity).toBeGreaterThan(snapshots[0].complexity);
    });

    it('should process commits in chronological order', () => {
      const fileHistories: FileHistory[] = [
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
          totalChanges: 1,
          loc: 100,
          complexity: 5,
        },
      ];

      const commits: GitCommit[] = [
        {
          hash: 'def456',
          date: new Date('2024-01-02'),
          message: 'Second',
          author: 'Bob',
          filesChanged: ['src/file2.ts'],
        },
        {
          hash: 'abc123',
          date: new Date('2024-01-01'),
          message: 'First',
          author: 'Alice',
          filesChanged: ['src/file1.ts'],
        },
      ];

      const snapshotMap = generateBuildingSnapshots(fileHistories, commits);
      const snapshots = snapshotMap.get('src/file1.ts')!;

      expect(snapshots[0].commitHash).toBe('abc123');
      expect(snapshots[1].commitHash).toBe('def456');
    });
  });

  describe('getBuildingsAtTimelinePosition', () => {
    it('should return original file histories if no snapshots', () => {
      const fileHistories: FileHistory[] = [
        {
          path: 'src/file1.ts',
          commits: [],
          totalChanges: 5,
          loc: 100,
          complexity: 10,
        },
      ];

      const snapshotMap = new Map();
      const result = getBuildingsAtTimelinePosition(fileHistories, snapshotMap, 0);

      expect(result).toEqual(fileHistories);
    });

    it('should return original file histories if timeline index out of bounds', () => {
      const fileHistories: FileHistory[] = [
        {
          path: 'src/file1.ts',
          commits: [],
          totalChanges: 5,
          loc: 100,
          complexity: 10,
        },
      ];

      const snapshotMap = new Map([
        ['src/file1.ts', [
          {
            timestamp: Date.now(),
            commitHash: 'abc123',
            height: 5,
            color: '#ff0000',
            loc: 50,
            complexity: 5,
          },
        ]],
      ]);

      const result = getBuildingsAtTimelinePosition(fileHistories, snapshotMap, 10);
      expect(result[0].loc).toBe(100);
      expect(result[0].complexity).toBe(10);
    });

    it('should update metrics from snapshot at timeline position', () => {
      const fileHistories: FileHistory[] = [
        {
          path: 'src/file1.ts',
          commits: [],
          totalChanges: 5,
          loc: 100,
          complexity: 10,
        },
      ];

      const snapshotMap = new Map([
        ['src/file1.ts', [
          {
            timestamp: Date.now(),
            commitHash: 'abc123',
            height: 5,
            color: '#ff0000',
            loc: 50,
            complexity: 5,
          },
          {
            timestamp: Date.now() + 1000,
            commitHash: 'def456',
            height: 8,
            color: '#00ff00',
            loc: 150,
            complexity: 15,
          },
        ]],
      ]);

      const result = getBuildingsAtTimelinePosition(fileHistories, snapshotMap, 1);
      expect(result[0].loc).toBe(150);
      expect(result[0].complexity).toBe(15);
    });

    it('should preserve other file history properties', () => {
      const fileHistories: FileHistory[] = [
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
      ];

      const snapshotMap = new Map([
        ['src/file1.ts', [
          {
            timestamp: Date.now(),
            commitHash: 'abc123',
            height: 5,
            color: '#ff0000',
            loc: 50,
            complexity: 5,
          },
        ]],
      ]);

      const result = getBuildingsAtTimelinePosition(fileHistories, snapshotMap, 0);
      expect(result[0].path).toBe('src/file1.ts');
      expect(result[0].totalChanges).toBe(5);
      expect(result[0].commits).toHaveLength(1);
    });

    it('should handle multiple files', () => {
      const fileHistories: FileHistory[] = [
        {
          path: 'src/file1.ts',
          commits: [],
          totalChanges: 5,
          loc: 100,
          complexity: 10,
        },
        {
          path: 'src/file2.ts',
          commits: [],
          totalChanges: 3,
          loc: 200,
          complexity: 15,
        },
      ];

      const snapshotMap = new Map([
        ['src/file1.ts', [
          {
            timestamp: Date.now(),
            commitHash: 'abc123',
            height: 5,
            color: '#ff0000',
            loc: 50,
            complexity: 5,
          },
        ]],
        ['src/file2.ts', [
          {
            timestamp: Date.now(),
            commitHash: 'abc123',
            height: 8,
            color: '#00ff00',
            loc: 150,
            complexity: 12,
          },
        ]],
      ]);

      const result = getBuildingsAtTimelinePosition(fileHistories, snapshotMap, 0);
      expect(result[0].loc).toBe(50);
      expect(result[1].loc).toBe(150);
    });
  });
});
