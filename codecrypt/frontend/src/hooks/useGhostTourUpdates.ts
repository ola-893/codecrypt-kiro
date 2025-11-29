import { useEffect, useState } from 'react';
import type { FileHistory, GitCommit } from '../types/ghostTour';
import type { TransformationEvent, MetricsSnapshot } from '../types';

interface GhostTourUpdate {
  fileHistories: FileHistory[];
  lastUpdate: number;
}

/**
 * Hook to handle real-time updates to the Ghost Tour visualization
 * Listens for transformation_applied events and updates building data
 */
export function useGhostTourUpdates(
  initialFileHistories: FileHistory[],
  events: any[]
): GhostTourUpdate {
  const [fileHistories, setFileHistories] = useState<FileHistory[]>(initialFileHistories);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  
  useEffect(() => {
    // Filter for transformation and metric events
    const transformationEvents = events.filter(
      e => e.type === 'transformation_applied' || e.type === 'metric_updated'
    );
    
    if (transformationEvents.length === 0) return;
    
    // Get the latest event
    const latestEvent = transformationEvents[transformationEvents.length - 1];
    
    // Update file histories based on event data
    if (latestEvent.type === 'transformation_applied') {
      const transformData = latestEvent.data as TransformationEvent;
      
      // Update the file history for the affected file
      setFileHistories(prev => {
        const updated = [...prev];
        
        // Find or create file history for the transformed file
        const fileName = transformData.details.name || 'unknown';
        const existingIndex = updated.findIndex(f => f.path.includes(fileName));
        
        if (existingIndex >= 0) {
          // Update existing file
          updated[existingIndex] = {
            ...updated[existingIndex],
            totalChanges: updated[existingIndex].totalChanges + 1,
            commits: [
              ...updated[existingIndex].commits,
              {
                hash: `transform-${Date.now()}`,
                date: new Date(),
                message: `Transformation: ${transformData.type}`,
                changes: 1,
              }
            ]
          };
        }
        
        return updated;
      });
      
      setLastUpdate(Date.now());
    } else if (latestEvent.type === 'metric_updated') {
      const metricsData = latestEvent.data as MetricsSnapshot;
      
      // Update complexity and LOC for all files proportionally
      setFileHistories(prev => {
        return prev.map(file => ({
          ...file,
          complexity: Math.max(1, file.complexity + (metricsData.complexity - file.complexity) * 0.1),
          loc: Math.max(10, file.loc + (metricsData.loc - file.loc) * 0.1),
        }));
      });
      
      setLastUpdate(Date.now());
    }
  }, [events]);
  
  // Reset when initial data changes
  useEffect(() => {
    setFileHistories(initialFileHistories);
  }, [initialFileHistories]);
  
  return {
    fileHistories,
    lastUpdate,
  };
}
