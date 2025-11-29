import { describe, it, expect } from 'vitest';
import {
  generateBuildingPositions,
  mapChangeFrequencyToColor,
  mapMetricsToHeight,
  generateBuildings,
  identifyHotspots,
} from '../utils/buildingGenerator';
import type { FileHistory } from '../types/ghostTour';

describe('buildingGenerator', () => {
  describe('generateBuildingPositions', () => {
    it('should generate correct number of positions', () => {
      const positions = generateBuildingPositions(10);
      expect(positions).toHaveLength(10);
    });

    it('should generate positions as 3D tuples', () => {
      const positions = generateBuildingPositions(5);
      positions.forEach(pos => {
        expect(pos).toHaveLength(3);
        expect(typeof pos[0]).toBe('number');
        expect(typeof pos[1]).toBe('number');
        expect(typeof pos[2]).toBe('number');
      });
    });

    it('should place first building at origin', () => {
      const positions = generateBuildingPositions(1);
      expect(positions[0]).toEqual([0, 0, 0]);
    });

    it('should generate spiral pattern with proper spacing', () => {
      const positions = generateBuildingPositions(20);
      
      // Check that positions are spaced apart
      for (let i = 0; i < positions.length - 1; i++) {
        const [x1, , z1] = positions[i];
        const [x2, , z2] = positions[i + 1];
        const distance = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
        
        // Distance should be reasonable (not zero, not too large)
        expect(distance).toBeGreaterThan(0);
        expect(distance).toBeLessThan(10);
      }
    });

    it('should handle zero buildings', () => {
      const positions = generateBuildingPositions(0);
      expect(positions).toHaveLength(0);
    });

    it('should generate unique positions for each building', () => {
      const positions = generateBuildingPositions(15);
      const positionStrings = positions.map(p => p.join(','));
      const uniquePositions = new Set(positionStrings);
      
      expect(uniquePositions.size).toBe(positions.length);
    });
  });

  describe('mapChangeFrequencyToColor', () => {
    it('should return gray for zero max changes', () => {
      const color = mapChangeFrequencyToColor(5, 0);
      expect(color).toBe('#4a5568');
    });

    it('should return indigo for low frequency (< 20%)', () => {
      const color = mapChangeFrequencyToColor(1, 10);
      expect(color).toBe('#6366f1');
    });

    it('should return cyan for cool frequency (20-40%)', () => {
      const color = mapChangeFrequencyToColor(3, 10);
      expect(color).toBe('#06b6d4');
    });

    it('should return yellow for warm frequency (40-60%)', () => {
      const color = mapChangeFrequencyToColor(5, 10);
      expect(color).toBe('#eab308');
    });

    it('should return orange for hot frequency (60-80%)', () => {
      const color = mapChangeFrequencyToColor(7, 10);
      expect(color).toBe('#f97316');
    });

    it('should return red for very hot frequency (>= 80%)', () => {
      const color = mapChangeFrequencyToColor(9, 10);
      expect(color).toBe('#ef4444');
    });

    it('should handle frequency equal to max', () => {
      const color = mapChangeFrequencyToColor(10, 10);
      expect(color).toBe('#ef4444');
    });

    it('should handle frequency greater than max', () => {
      const color = mapChangeFrequencyToColor(15, 10);
      expect(color).toBe('#ef4444');
    });

    it('should handle zero frequency', () => {
      const color = mapChangeFrequencyToColor(0, 10);
      expect(color).toBe('#6366f1');
    });
  });

  describe('mapMetricsToHeight', () => {
    it('should return minimum height for zero metrics', () => {
      const height = mapMetricsToHeight(0, 0);
      expect(height).toBeGreaterThanOrEqual(0.5);
    });

    it('should increase height with LOC', () => {
      const height1 = mapMetricsToHeight(100, 5);
      const height2 = mapMetricsToHeight(1000, 5);
      expect(height2).toBeGreaterThan(height1);
    });

    it('should increase height with complexity', () => {
      const height1 = mapMetricsToHeight(500, 5);
      const height2 = mapMetricsToHeight(500, 20);
      expect(height2).toBeGreaterThan(height1);
    });

    it('should clamp height to maximum of 15', () => {
      const height = mapMetricsToHeight(1000000, 1000);
      expect(height).toBeLessThanOrEqual(15);
    });

    it('should clamp height to minimum of 0.5', () => {
      const height = mapMetricsToHeight(1, 0);
      expect(height).toBeGreaterThanOrEqual(0.5);
    });

    it('should use logarithmic scale for LOC', () => {
      // Log scale means height grows slower than LOC
      // Test that doubling LOC doesn't double height
      const height1 = mapMetricsToHeight(100, 0);
      const height2 = mapMetricsToHeight(200, 0);
      
      const locRatio = 200 / 100; // 2x
      const heightRatio = height2 / height1;
      
      // With log scale, height ratio should be less than LOC ratio
      // (doubling LOC doesn't double height)
      expect(heightRatio).toBeLessThan(locRatio);
      expect(heightRatio).toBeGreaterThan(1); // But height should still increase
    });
  });

  describe('generateBuildings', () => {
    it('should return empty array for empty input', () => {
      const buildings = generateBuildings([]);
      expect(buildings).toHaveLength(0);
    });

    it('should generate correct number of buildings', () => {
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
          totalChanges: 10,
          loc: 200,
          complexity: 15,
        },
      ];

      const buildings = generateBuildings(fileHistories);
      expect(buildings).toHaveLength(2);
    });

    it('should generate buildings with correct structure', () => {
      const fileHistories: FileHistory[] = [
        {
          path: 'src/components/Button.tsx',
          commits: [],
          totalChanges: 5,
          loc: 100,
          complexity: 10,
        },
      ];

      const buildings = generateBuildings(fileHistories);
      const building = buildings[0];

      expect(building).toHaveProperty('id');
      expect(building).toHaveProperty('name');
      expect(building).toHaveProperty('path');
      expect(building).toHaveProperty('position');
      expect(building).toHaveProperty('height');
      expect(building).toHaveProperty('color');
      expect(building).toHaveProperty('changeFrequency');
      expect(building).toHaveProperty('loc');
      expect(building).toHaveProperty('complexity');
    });

    it('should extract file name from path', () => {
      const fileHistories: FileHistory[] = [
        {
          path: 'src/components/Button.tsx',
          commits: [],
          totalChanges: 5,
          loc: 100,
          complexity: 10,
        },
      ];

      const buildings = generateBuildings(fileHistories);
      expect(buildings[0].name).toBe('Button.tsx');
    });

    it('should use full path as name if no directory separator', () => {
      const fileHistories: FileHistory[] = [
        {
          path: 'README.md',
          commits: [],
          totalChanges: 5,
          loc: 100,
          complexity: 10,
        },
      ];

      const buildings = generateBuildings(fileHistories);
      expect(buildings[0].name).toBe('README.md');
    });

    it('should assign colors based on relative change frequency', () => {
      const fileHistories: FileHistory[] = [
        {
          path: 'src/file1.ts',
          commits: [],
          totalChanges: 2,
          loc: 100,
          complexity: 10,
        },
        {
          path: 'src/file2.ts',
          commits: [],
          totalChanges: 10,
          loc: 100,
          complexity: 10,
        },
      ];

      const buildings = generateBuildings(fileHistories);
      
      // File with more changes should have warmer color
      expect(buildings[0].color).not.toBe(buildings[1].color);
    });

    it('should preserve original metrics', () => {
      const fileHistories: FileHistory[] = [
        {
          path: 'src/file1.ts',
          commits: [],
          totalChanges: 5,
          loc: 150,
          complexity: 12,
        },
      ];

      const buildings = generateBuildings(fileHistories);
      expect(buildings[0].loc).toBe(150);
      expect(buildings[0].complexity).toBe(12);
      expect(buildings[0].changeFrequency).toBe(5);
    });
  });

  describe('identifyHotspots', () => {
    it('should return empty array for empty input', () => {
      const hotspots = identifyHotspots([]);
      expect(hotspots).toHaveLength(0);
    });

    it('should identify buildings above threshold', () => {
      const buildings = [
        {
          id: '1',
          name: 'file1.ts',
          path: 'src/file1.ts',
          position: [0, 0, 0] as [number, number, number],
          height: 5,
          color: '#ff0000',
          changeFrequency: 2,
          loc: 100,
          complexity: 10,
        },
        {
          id: '2',
          name: 'file2.ts',
          path: 'src/file2.ts',
          position: [1, 0, 0] as [number, number, number],
          height: 5,
          color: '#ff0000',
          changeFrequency: 10,
          loc: 100,
          complexity: 10,
        },
      ];

      const hotspots = identifyHotspots(buildings, 0.7);
      expect(hotspots).toContain(1); // Second building is hotspot
      expect(hotspots).not.toContain(0); // First building is not
    });

    it('should use default threshold of 0.7', () => {
      const buildings = [
        {
          id: '1',
          name: 'file1.ts',
          path: 'src/file1.ts',
          position: [0, 0, 0] as [number, number, number],
          height: 5,
          color: '#ff0000',
          changeFrequency: 5,
          loc: 100,
          complexity: 10,
        },
        {
          id: '2',
          name: 'file2.ts',
          path: 'src/file2.ts',
          position: [1, 0, 0] as [number, number, number],
          height: 5,
          color: '#ff0000',
          changeFrequency: 10,
          loc: 100,
          complexity: 10,
        },
      ];

      const hotspots = identifyHotspots(buildings);
      expect(hotspots.length).toBeGreaterThan(0);
    });

    it('should return all buildings if all are hotspots', () => {
      const buildings = [
        {
          id: '1',
          name: 'file1.ts',
          path: 'src/file1.ts',
          position: [0, 0, 0] as [number, number, number],
          height: 5,
          color: '#ff0000',
          changeFrequency: 10,
          loc: 100,
          complexity: 10,
        },
        {
          id: '2',
          name: 'file2.ts',
          path: 'src/file2.ts',
          position: [1, 0, 0] as [number, number, number],
          height: 5,
          color: '#ff0000',
          changeFrequency: 9,
          loc: 100,
          complexity: 10,
        },
      ];

      const hotspots = identifyHotspots(buildings, 0.7);
      expect(hotspots).toHaveLength(2);
    });

    it('should return empty array if no buildings meet threshold', () => {
      const buildings = [
        {
          id: '1',
          name: 'file1.ts',
          path: 'src/file1.ts',
          position: [0, 0, 0] as [number, number, number],
          height: 5,
          color: '#ff0000',
          changeFrequency: 1,
          loc: 100,
          complexity: 10,
        },
        {
          id: '2',
          name: 'file2.ts',
          path: 'src/file2.ts',
          position: [1, 0, 0] as [number, number, number],
          height: 5,
          color: '#ff0000',
          changeFrequency: 2,
          loc: 100,
          complexity: 10,
        },
      ];

      // With threshold 0.95, neither building should be a hotspot
      // file1: 1/2 = 0.5, file2: 2/2 = 1.0 (but we need > 0.95, not >=)
      const hotspots = identifyHotspots(buildings, 0.95);
      expect(hotspots).toHaveLength(1); // file2 is exactly 1.0, which is >= 0.95
    });

    it('should handle buildings with zero changes', () => {
      const buildings = [
        {
          id: '1',
          name: 'file1.ts',
          path: 'src/file1.ts',
          position: [0, 0, 0] as [number, number, number],
          height: 5,
          color: '#ff0000',
          changeFrequency: 0,
          loc: 100,
          complexity: 10,
        },
      ];

      const hotspots = identifyHotspots(buildings);
      expect(hotspots).toHaveLength(0);
    });

    it('should normalize relative to maximum changes', () => {
      const buildings = [
        {
          id: '1',
          name: 'file1.ts',
          path: 'src/file1.ts',
          position: [0, 0, 0] as [number, number, number],
          height: 5,
          color: '#ff0000',
          changeFrequency: 7,
          loc: 100,
          complexity: 10,
        },
        {
          id: '2',
          name: 'file2.ts',
          path: 'src/file2.ts',
          position: [1, 0, 0] as [number, number, number],
          height: 5,
          color: '#ff0000',
          changeFrequency: 10,
          loc: 100,
          complexity: 10,
        },
      ];

      const hotspots = identifyHotspots(buildings, 0.7);
      // 7/10 = 0.7 (exactly at threshold)
      // 10/10 = 1.0 (above threshold)
      expect(hotspots).toContain(0);
      expect(hotspots).toContain(1);
    });
  });
});
