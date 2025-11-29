import type { Building, FileHistory } from '../types/ghostTour';

/**
 * Generate building positions using a city layout algorithm
 * Uses a spiral pattern to place buildings
 */
export function generateBuildingPositions(count: number): [number, number, number][] {
  const positions: [number, number, number][] = [];
  const spacing = 2.5; // Space between buildings
  
  let x = 0;
  let z = 0;
  let dx = 0;
  let dz = -1;
  let segmentLength = 1;
  let segmentPassed = 0;
  
  for (let i = 0; i < count; i++) {
    positions.push([x * spacing, 0, z * spacing]);
    
    // Move to next position in spiral
    x += dx;
    z += dz;
    segmentPassed++;
    
    if (segmentPassed === segmentLength) {
      segmentPassed = 0;
      
      // Turn 90 degrees
      const temp = dx;
      dx = -dz;
      dz = temp;
      
      // Increase segment length every two turns
      if (dz === 0) {
        segmentLength++;
      }
    }
  }
  
  return positions;
}

/**
 * Map change frequency to color
 * More changes = warmer colors (red/orange)
 * Fewer changes = cooler colors (blue/purple)
 */
export function mapChangeFrequencyToColor(changeFrequency: number, maxChanges: number): string {
  if (maxChanges === 0) return '#4a5568'; // Gray for no changes
  
  const normalized = Math.min(changeFrequency / maxChanges, 1);
  
  if (normalized < 0.2) {
    // Cold - blue/purple
    return '#6366f1'; // Indigo
  } else if (normalized < 0.4) {
    // Cool - cyan
    return '#06b6d4'; // Cyan
  } else if (normalized < 0.6) {
    // Warm - yellow
    return '#eab308'; // Yellow
  } else if (normalized < 0.8) {
    // Hot - orange
    return '#f97316'; // Orange
  } else {
    // Very hot - red
    return '#ef4444'; // Red
  }
}

/**
 * Map LOC/complexity to building height
 */
export function mapMetricsToHeight(loc: number, complexity: number): number {
  // Combine LOC and complexity with weights
  const locWeight = 0.6;
  const complexityWeight = 0.4;
  
  // Normalize and scale
  const normalizedLoc = Math.log(loc + 1) / 10; // Log scale for LOC
  const normalizedComplexity = complexity / 20; // Linear scale for complexity
  
  const height = (normalizedLoc * locWeight + normalizedComplexity * complexityWeight) * 10;
  
  // Clamp between min and max heights
  return Math.max(0.5, Math.min(height, 15));
}

/**
 * Generate buildings from file history data
 */
export function generateBuildings(fileHistories: FileHistory[]): Building[] {
  if (fileHistories.length === 0) return [];
  
  const positions = generateBuildingPositions(fileHistories.length);
  const maxChanges = Math.max(...fileHistories.map(f => f.totalChanges), 1);
  
  return fileHistories.map((file, index) => {
    const height = mapMetricsToHeight(file.loc, file.complexity);
    const color = mapChangeFrequencyToColor(file.totalChanges, maxChanges);
    
    return {
      id: `building-${index}`,
      name: file.path.split('/').pop() || file.path,
      path: file.path,
      position: positions[index],
      height,
      color,
      changeFrequency: file.totalChanges,
      loc: file.loc,
      complexity: file.complexity,
    };
  });
}

/**
 * Identify hotspot buildings (frequently changed files)
 * Returns indices of buildings that are hotspots
 */
export function identifyHotspots(buildings: Building[], threshold: number = 0.7): number[] {
  if (buildings.length === 0) return [];
  
  const maxChanges = Math.max(...buildings.map(b => b.changeFrequency), 1);
  
  return buildings
    .map((building, index) => ({
      index,
      normalized: building.changeFrequency / maxChanges,
    }))
    .filter(item => item.normalized >= threshold)
    .map(item => item.index);
}
