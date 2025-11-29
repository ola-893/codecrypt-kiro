/**
 * Type definitions for Ghost Tour 3D visualization
 */

export interface Building {
  id: string;
  name: string;
  path: string;
  position: [number, number, number];
  height: number; // Based on LOC or complexity
  color: string; // Based on change frequency
  changeFrequency: number; // Number of times file changed
  loc: number; // Lines of code
  complexity: number; // Cyclomatic complexity
}

export interface BuildingSnapshot {
  timestamp: number;
  commitHash: string;
  height: number;
  color: string;
  loc: number;
  complexity: number;
}

export interface FileHistory {
  path: string;
  commits: {
    hash: string;
    date: Date;
    message: string;
    changes: number;
  }[];
  totalChanges: number;
  loc: number;
  complexity: number;
}

export interface GitCommit {
  hash: string;
  date: Date;
  message: string;
  author: string;
  filesChanged: string[];
}
