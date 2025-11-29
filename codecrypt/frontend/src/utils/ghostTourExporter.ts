import type { FileHistory, GitCommit } from '../types/ghostTour';

/**
 * Export the Ghost Tour visualization as a standalone HTML file
 * Embeds Three.js, React, and all necessary code
 */
export function exportGhostTourHTML(
  fileHistories: FileHistory[],
  gitCommits: GitCommit[],
  projectName: string = 'CodeCrypt Ghost Tour'
): string {
  const dataJson = JSON.stringify({
    fileHistories,
    gitCommits,
    projectName,
    exportDate: new Date().toISOString(),
  }, null, 2);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} - Ghost Tour</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%);
      color: #e0e0e0;
      overflow: hidden;
    }
    
    #container {
      width: 100vw;
      height: 100vh;
      position: relative;
    }
    
    #canvas-container {
      width: 100%;
      height: 100%;
    }
    
    #info-panel {
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(26, 26, 46, 0.95);
      border: 1px solid #8b5cf6;
      border-radius: 8px;
      padding: 20px;
      max-width: 300px;
      box-shadow: 0 4px 16px rgba(139, 92, 246, 0.3);
    }
    
    #info-panel h1 {
      color: #8b5cf6;
      font-size: 24px;
      margin-bottom: 10px;
    }
    
    #info-panel p {
      color: #a0a0a0;
      font-size: 14px;
      line-height: 1.6;
    }
    
    #controls {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(26, 26, 46, 0.95);
      border: 1px solid #8b5cf6;
      border-radius: 8px;
      padding: 15px 30px;
      display: flex;
      gap: 15px;
      align-items: center;
    }
    
    .control-button {
      background: rgba(139, 92, 246, 0.2);
      border: 1px solid #8b5cf6;
      color: #8b5cf6;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }
    
    .control-button:hover {
      background: rgba(139, 92, 246, 0.4);
    }
    
    #loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: #8b5cf6;
      font-size: 18px;
    }
    
    .spinner {
      border: 3px solid rgba(139, 92, 246, 0.3);
      border-top: 3px solid #8b5cf6;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 10px;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div id="container">
    <div id="loading">
      <div class="spinner"></div>
      <div>Loading Ghost Tour...</div>
    </div>
    
    <div id="canvas-container"></div>
    
    <div id="info-panel">
      <h1>${projectName}</h1>
      <p>Interactive 3D visualization of code evolution</p>
      <p style="margin-top: 10px; font-size: 12px;">
        <strong>Controls:</strong><br>
        • Left click + drag: Rotate<br>
        • Right click + drag: Pan<br>
        • Scroll: Zoom<br>
        • Click building: View details
      </p>
    </div>
    
    <div id="controls">
      <button class="control-button" onclick="resetCamera()">Reset View</button>
      <button class="control-button" onclick="toggleRotation()">Auto Rotate</button>
    </div>
  </div>
  
  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
      }
    }
  </script>
  
  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    
    // Embedded data
    const data = ${dataJson};
    
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0f1e);
    
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(15, 15, 15);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('canvas-container').appendChild(renderer.domElement);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    const pointLight1 = new THREE.PointLight(0xffffff, 0.8);
    pointLight1.position.set(10, 10, 10);
    pointLight1.castShadow = true;
    scene.add(pointLight1);
    
    const pointLight2 = new THREE.PointLight(0x8b5cf6, 0.3);
    pointLight2.position.set(-10, -10, -10);
    scene.add(pointLight2);
    
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a2e });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Grid
    const gridHelper = new THREE.GridHelper(50, 50, 0x4a4a6a, 0x2a2a3a);
    scene.add(gridHelper);
    
    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI / 2;
    
    // Generate buildings
    function generateBuildings() {
      const buildings = [];
      const spacing = 2.5;
      let x = 0, z = 0, dx = 0, dz = -1;
      let segmentLength = 1, segmentPassed = 0;
      
      data.fileHistories.forEach((file, i) => {
        const height = Math.log(file.loc + 1) * 2;
        const color = getColorForChanges(file.totalChanges);
        
        const geometry = new THREE.BoxGeometry(1, height, 1);
        const material = new THREE.MeshStandardMaterial({ 
          color: color,
          metalness: 0.3,
          roughness: 0.7
        });
        const building = new THREE.Mesh(geometry, material);
        building.position.set(x * spacing, height / 2, z * spacing);
        building.castShadow = true;
        building.receiveShadow = true;
        building.userData = { file };
        
        scene.add(building);
        buildings.push(building);
        
        // Spiral positioning
        x += dx;
        z += dz;
        segmentPassed++;
        
        if (segmentPassed === segmentLength) {
          segmentPassed = 0;
          const temp = dx;
          dx = -dz;
          dz = temp;
          if (dz === 0) segmentLength++;
        }
      });
      
      return buildings;
    }
    
    function getColorForChanges(changes) {
      const maxChanges = Math.max(...data.fileHistories.map(f => f.totalChanges), 1);
      const normalized = changes / maxChanges;
      
      if (normalized < 0.2) return 0x6366f1;
      if (normalized < 0.4) return 0x06b6d4;
      if (normalized < 0.6) return 0xeab308;
      if (normalized < 0.8) return 0xf97316;
      return 0xef4444;
    }
    
    const buildings = generateBuildings();
    
    // Animation
    let autoRotate = false;
    
    function animate() {
      requestAnimationFrame(animate);
      
      if (autoRotate) {
        camera.position.x = Math.cos(Date.now() * 0.0001) * 20;
        camera.position.z = Math.sin(Date.now() * 0.0001) * 20;
        camera.lookAt(0, 0, 0);
      }
      
      controls.update();
      renderer.render(scene, camera);
    }
    
    // Window resize
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Global functions
    window.resetCamera = () => {
      camera.position.set(15, 15, 15);
      controls.target.set(0, 0, 0);
      controls.update();
    };
    
    window.toggleRotation = () => {
      autoRotate = !autoRotate;
    };
    
    // Hide loading
    document.getElementById('loading').style.display = 'none';
    
    // Start animation
    animate();
  </script>
</body>
</html>`;
}

/**
 * Download the exported HTML file
 */
export function downloadGhostTourHTML(
  fileHistories: FileHistory[],
  gitCommits: GitCommit[],
  projectName: string = 'CodeCrypt Ghost Tour'
): void {
  const html = exportGhostTourHTML(fileHistories, gitCommits, projectName);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${projectName.replace(/\s+/g, '-').toLowerCase()}-ghost-tour.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
