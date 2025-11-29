import type { GitCommit, FileHistory, BuildingSnapshot } from '../types/ghostTour';

/**
 * Process git history to create file histories
 * Tracks how each file changed over time
 */
export function processGitHistory(commits: GitCommit[]): FileHistory[] {
  const fileMap = new Map<string, FileHistory>();
  
  // Process commits in chronological order
  const sortedCommits = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  for (const commit of sortedCommits) {
    for (const filePath of commit.filesChanged) {
      if (!fileMap.has(filePath)) {
        fileMap.set(filePath, {
          path: filePath,
          commits: [],
          totalChanges: 0,
          loc: 100, // Default, should be updated with actual data
          complexity: 5, // Default, should be updated with actual data
        });
      }
      
      const fileHistory = fileMap.get(filePath)!;
      fileHistory.commits.push({
        hash: commit.hash,
        date: commit.date,
        message: commit.message,
        changes: 1, // Could be enhanced with actual line changes
      });
      fileHistory.totalChanges++;
    }
  }
  
  return Array.from(fileMap.values());
}

/**
 * Generate building snapshots for timeline visualization
 * Creates a snapshot of all buildings at each commit
 */
export function generateBuildingSnapshots(
  fileHistories: FileHistory[],
  commits: GitCommit[]
): Map<string, BuildingSnapshot[]> {
  const snapshotMap = new Map<string, BuildingSnapshot[]>();
  
  // Sort commits chronologically
  const sortedCommits = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  for (const fileHistory of fileHistories) {
    const snapshots: BuildingSnapshot[] = [];
    let currentLoc = 0;
    let currentComplexity = 0;
    let changeCount = 0;
    
    for (const commit of sortedCommits) {
      // Check if this file was changed in this commit
      const wasChanged = fileHistory.commits.some(c => c.hash === commit.hash);
      
      if (wasChanged) {
        changeCount++;
        // Simulate growth in LOC and complexity
        currentLoc += Math.floor(Math.random() * 50) + 10;
        currentComplexity += Math.floor(Math.random() * 3) + 1;
      }
      
      // Calculate color based on change frequency at this point
      const maxChanges = Math.max(...fileHistories.map(f => 
        f.commits.filter(c => 
          new Date(c.date) <= commit.date
        ).length
      ), 1);
      
      const normalized = changeCount / maxChanges;
      const color = getColorForFrequency(normalized);
      
      snapshots.push({
        timestamp: commit.date.getTime(),
        commitHash: commit.hash,
        height: Math.log(currentLoc + 1) * 2,
        color,
        loc: currentLoc,
        complexity: currentComplexity,
      });
    }
    
    snapshotMap.set(fileHistory.path, snapshots);
  }
  
  return snapshotMap;
}

/**
 * Get color based on normalized change frequency
 */
function getColorForFrequency(normalized: number): string {
  if (normalized < 0.2) return '#6366f1'; // Indigo
  if (normalized < 0.4) return '#06b6d4'; // Cyan
  if (normalized < 0.6) return '#eab308'; // Yellow
  if (normalized < 0.8) return '#f97316'; // Orange
  return '#ef4444'; // Red
}

/**
 * Create timeline data structure
 * Returns array of timeline points with commit info
 */
export interface TimelinePoint {
  index: number;
  timestamp: number;
  commitHash: string;
  date: Date;
  message: string;
  author: string;
  filesChanged: number;
}

export function createTimeline(commits: GitCommit[]): TimelinePoint[] {
  const sortedCommits = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  return sortedCommits.map((commit, index) => ({
    index,
    timestamp: commit.date.getTime(),
    commitHash: commit.hash,
    date: commit.date,
    message: commit.message,
    author: commit.author,
    filesChanged: commit.filesChanged.length,
  }));
}

/**
 * Get building state at a specific timeline position
 */
export function getBuildingsAtTimelinePosition(
  fileHistories: FileHistory[],
  snapshotMap: Map<string, BuildingSnapshot[]>,
  timelineIndex: number
): FileHistory[] {
  return fileHistories.map(fileHistory => {
    const snapshots = snapshotMap.get(fileHistory.path);
    if (!snapshots || timelineIndex >= snapshots.length) {
      return fileHistory;
    }
    
    const snapshot = snapshots[timelineIndex];
    return {
      ...fileHistory,
      loc: snapshot.loc,
      complexity: snapshot.complexity,
    };
  });
}
