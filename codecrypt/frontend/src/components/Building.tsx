import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import type { Mesh } from 'three';
import type { Building as BuildingType } from '../types/ghostTour';

interface BuildingProps extends BuildingType {
  isHotspot?: boolean;
  onClick?: (building: BuildingType) => void;
}

/**
 * Building component - represents a file as a 3D box
 * Height is based on LOC/complexity
 * Color is based on change frequency
 */
export function Building({ 
  id, 
  name, 
  path, 
  position, 
  height, 
  color, 
  changeFrequency,
  loc,
  complexity,
  isHotspot = false,
  onClick 
}: BuildingProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [currentHeight, setCurrentHeight] = useState(height);
  const [targetHeight, setTargetHeight] = useState(height);
  
  // Smooth height transitions when timeline changes
  useEffect(() => {
    setTargetHeight(height);
  }, [height]);
  
  // Animate height transitions and hotspot pulsing
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    // Smooth height transition
    const heightDiff = targetHeight - currentHeight;
    if (Math.abs(heightDiff) > 0.01) {
      const newHeight = currentHeight + heightDiff * delta * 3; // Smooth interpolation
      setCurrentHeight(newHeight);
      meshRef.current.scale.y = 1;
      meshRef.current.position.y = newHeight / 2;
    }
    
    // Hotspot pulsing effect
    if (isHotspot) {
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.1 + 1;
      meshRef.current.scale.y = pulse;
    }
  });
  
  const handleClick = () => {
    if (onClick) {
      onClick({ 
        id, 
        name, 
        path, 
        position, 
        height, 
        color, 
        changeFrequency, 
        loc, 
        complexity 
      });
    }
  };
  
  return (
    <group position={position}>
      {/* Building mesh */}
      <mesh
        ref={meshRef}
        position={[0, currentHeight / 2, 0]}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, currentHeight, 1]} />
        <meshStandardMaterial 
          color={hovered ? '#ffffff' : color}
          emissive={isHotspot ? color : '#000000'}
          emissiveIntensity={isHotspot ? 0.3 : 0}
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>
      
      {/* Hotspot indicator */}
      {isHotspot && (
        <mesh position={[0, currentHeight + 0.5, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial 
            color="#ff0000" 
            emissive="#ff0000"
            emissiveIntensity={0.8}
          />
        </mesh>
      )}
      
      {/* Label on hover */}
      {hovered && (
        <Text
          position={[0, currentHeight + 1, 0]}
          fontSize={0.3}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="#000000"
        >
          {name}
        </Text>
      )}
    </group>
  );
}
