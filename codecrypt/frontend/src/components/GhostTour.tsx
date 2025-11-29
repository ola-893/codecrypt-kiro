import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Building } from './Building';
import { Timeline } from './Timeline';
import { generateBuildings, identifyHotspots } from '../utils/buildingGenerator';
import { 
  processGitHistory, 
  createTimeline, 
  generateBuildingSnapshots,
  getBuildingsAtTimelinePosition 
} from '../utils/gitHistoryProcessor';
import { useGhostTourUpdates } from '../hooks/useGhostTourUpdates';
import { downloadGhostTourHTML } from '../utils/ghostTourExporter';
import type { FileHistory, Building as BuildingType, GitCommit } from '../types/ghostTour';
import './GhostTour.css';

interface GhostTourProps {
  fileHistories?: FileHistory[];
  gitCommits?: GitCommit[];
  currentMetrics?: any;
  events?: any[]; // SSE events for real-time updates
  enableRealTimeUpdates?: boolean;
}

/**
 * GhostTour: 3D visualization of codebase as a city
 * Files are represented as buildings with height based on LOC/complexity
 */
export function GhostTour({ 
  fileHistories = [], 
  gitCommits = [], 
  currentMetrics,
  events = [],
  enableRealTimeUpdates = false
}: GhostTourProps) {
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingType | null>(null);
  const [timelinePosition, setTimelinePosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Real-time updates from transformation events
  const { fileHistories: updatedFileHistories } = useGhostTourUpdates(
    fileHistories,
    enableRealTimeUpdates ? events : []
  );
  
  // Process git history if commits are provided
  const processedFileHistories = useMemo(() => {
    const baseHistories = enableRealTimeUpdates ? updatedFileHistories : fileHistories;
    if (gitCommits.length > 0 && baseHistories.length === 0) {
      return processGitHistory(gitCommits);
    }
    return baseHistories;
  }, [fileHistories, updatedFileHistories, gitCommits, enableRealTimeUpdates]);
  
  // Create timeline from commits
  const timeline = useMemo(() => {
    return createTimeline(gitCommits);
  }, [gitCommits]);
  
  // Generate building snapshots for timeline
  const snapshotMap = useMemo(() => {
    if (gitCommits.length > 0) {
      return generateBuildingSnapshots(processedFileHistories, gitCommits);
    }
    return new Map();
  }, [processedFileHistories, gitCommits]);
  
  // Get buildings at current timeline position
  const currentFileHistories = useMemo(() => {
    if (timeline.length > 0 && snapshotMap.size > 0) {
      return getBuildingsAtTimelinePosition(processedFileHistories, snapshotMap, timelinePosition);
    }
    return processedFileHistories;
  }, [processedFileHistories, snapshotMap, timelinePosition, timeline.length]);
  
  // Generate buildings from file histories
  const buildings = useMemo(() => {
    return generateBuildings(currentFileHistories);
  }, [currentFileHistories]);
  
  // Identify hotspot buildings
  const hotspotIndices = useMemo(() => {
    return identifyHotspots(buildings);
  }, [buildings]);
  
  const handleBuildingClick = (building: BuildingType) => {
    setSelectedBuilding(building);
  };
  
  const handleTimelineChange = (position: number) => {
    setTimelinePosition(position);
  };
  
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };
  
  const handleExport = () => {
    downloadGhostTourHTML(
      processedFileHistories,
      gitCommits,
      'CodeCrypt Ghost Tour'
    );
  };
  
  return (
    <div className="ghost-tour-container">
      <Canvas shadows>
        {/* Lighting setup */}
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={0.8} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.3} color="#8b5cf6" />
        <directionalLight position={[0, 10, 5]} intensity={0.5} castShadow />
        
        {/* Camera with orbit controls */}
        <PerspectiveCamera makeDefault position={[15, 15, 15]} fov={60} />
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05}
          minDistance={5}
          maxDistance={50}
          maxPolarAngle={Math.PI / 2}
        />
        
        {/* Ground plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#1a1a2e" />
        </mesh>
        
        {/* Grid helper for reference */}
        <gridHelper args={[50, 50, '#4a4a6a', '#2a2a3a']} />
        
        {/* Render buildings */}
        {buildings.map((building, index) => (
          <Building
            key={building.id}
            {...building}
            isHotspot={hotspotIndices.includes(index)}
            onClick={handleBuildingClick}
          />
        ))}
      </Canvas>
      
      {/* Building info panel */}
      {selectedBuilding && (
        <div className="building-info">
          <h3>{selectedBuilding.name}</h3>
          <p className="building-path">{selectedBuilding.path}</p>
          <div className="building-stats">
            <div className="stat">
              <span className="stat-label">Lines of Code:</span>
              <span className="stat-value">{selectedBuilding.loc}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Complexity:</span>
              <span className="stat-value">{selectedBuilding.complexity}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Changes:</span>
              <span className="stat-value">{selectedBuilding.changeFrequency}</span>
            </div>
          </div>
          <button 
            className="close-button"
            onClick={() => setSelectedBuilding(null)}
          >
            ✕
          </button>
        </div>
      )}
      
      {/* Export button */}
      <button 
        className="export-button"
        onClick={handleExport}
        title="Export as standalone HTML"
      >
        📥 Export
      </button>
      
      {/* Timeline */}
      {timeline.length > 0 && (
        <Timeline
          timeline={timeline}
          currentPosition={timelinePosition}
          onChange={handleTimelineChange}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
        />
      )}
    </div>
  );
}
