# Ghost Tour 3D Visualization

The Ghost Tour is an interactive 3D visualization that represents your codebase as a city, where files are buildings and their properties (height, color) reflect code metrics.

## Features

### 🏗️ Building Generation
- **Files as Buildings**: Each file in your codebase is represented as a 3D building
- **Height Mapping**: Building height is based on lines of code (LOC) and cyclomatic complexity
- **Color Coding**: Building color indicates change frequency
  - 🔵 Blue/Purple: Rarely changed (cold)
  - 🟡 Yellow: Moderately changed (warm)
  - 🔴 Red: Frequently changed (hot)
- **City Layout**: Buildings are arranged in a spiral pattern for optimal viewing

### 📊 Git History Visualization
- **Timeline Slider**: Scrub through your repository's entire git history
- **Animated Transitions**: Watch buildings grow and change as you move through time
- **Commit Information**: See commit details, author, and files changed at each point
- **Play/Pause**: Auto-play through history to see code evolution

### 🔥 Hotspot Detection
- **Automatic Identification**: Files changed frequently are marked as hotspots
- **Visual Indicators**: Hotspots have pulsing animations and glowing effects
- **Tooltips**: Hover over buildings to see file details

### 🎮 Interactive Controls
- **Orbit Controls**: Click and drag to rotate the camera
- **Zoom**: Scroll to zoom in/out
- **Pan**: Right-click and drag to pan
- **Click Buildings**: Click any building to see detailed information

### 📥 Export Functionality
- **Standalone HTML**: Export the entire 3D visualization as a single HTML file
- **Embedded Three.js**: No external dependencies needed
- **Interactive**: Exported file maintains all interactive features
- **Shareable**: Share the visualization with stakeholders

### ⚡ Real-time Updates (Optional)
- **Live Transformation**: Watch buildings update in real-time during resurrection
- **Event-Driven**: Responds to transformation and metric events
- **Smooth Animations**: Buildings smoothly transition between states

## Usage

### Basic Usage

```tsx
import { GhostTour } from './components/GhostTour';
import type { FileHistory, GitCommit } from './types/ghostTour';

function MyApp() {
  const fileHistories: FileHistory[] = [
    {
      path: 'src/index.ts',
      commits: [...],
      totalChanges: 5,
      loc: 150,
      complexity: 8,
    },
    // ... more files
  ];
  
  const gitCommits: GitCommit[] = [
    {
      hash: 'abc123',
      date: new Date('2023-01-01'),
      message: 'Initial commit',
      author: 'John Doe',
      filesChanged: ['src/index.ts'],
    },
    // ... more commits
  ];
  
  return (
    <GhostTour
      fileHistories={fileHistories}
      gitCommits={gitCommits}
    />
  );
}
```

### With Real-time Updates

```tsx
import { GhostTour } from './components/GhostTour';
import { useEventSource } from './hooks';

function MyApp() {
  const events = useEventSource('/api/events');
  
  return (
    <GhostTour
      fileHistories={fileHistories}
      gitCommits={gitCommits}
      events={events}
      enableRealTimeUpdates={true}
    />
  );
}
```

## Data Structures

### FileHistory

```typescript
interface FileHistory {
  path: string;              // File path
  commits: {
    hash: string;
    date: Date;
    message: string;
    changes: number;
  }[];
  totalChanges: number;      // Total number of times file was changed
  loc: number;               // Lines of code
  complexity: number;        // Cyclomatic complexity
}
```

### GitCommit

```typescript
interface GitCommit {
  hash: string;              // Commit hash
  date: Date;                // Commit date
  message: string;           // Commit message
  author: string;            // Commit author
  filesChanged: string[];    // Array of file paths changed
}
```

## Algorithms

### Building Position Generation
Buildings are positioned using a spiral algorithm that creates a compact, visually appealing city layout:

```
Start at center (0, 0)
Move in spiral: right → down → left → left → up → up → right → right → right → ...
Spacing: 2.5 units between buildings
```

### Height Calculation
Building height is calculated using a weighted combination of LOC and complexity:

```
height = (log(LOC + 1) * 0.6 + complexity/20 * 0.4) * 10
Clamped between 0.5 and 15 units
```

### Color Mapping
Colors are assigned based on normalized change frequency:

| Frequency | Color | Hex |
|-----------|-------|-----|
| 0-20% | Indigo | #6366f1 |
| 20-40% | Cyan | #06b6d4 |
| 40-60% | Yellow | #eab308 |
| 60-80% | Orange | #f97316 |
| 80-100% | Red | #ef4444 |

### Hotspot Detection
Files are marked as hotspots if their change frequency is in the top 30% (threshold = 0.7):

```
normalized_frequency = file.totalChanges / max(all_changes)
is_hotspot = normalized_frequency >= 0.7
```

## Performance

- **Rendering**: Optimized for up to 1000 buildings at 30+ FPS
- **Timeline**: Smooth transitions between commits using interpolation
- **Memory**: Efficient snapshot storage using Map data structure
- **Export**: Standalone HTML file size ~50-100KB (excluding data)

## Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

Requires WebGL support for 3D rendering.

## Customization

### Styling
Modify `GhostTour.css` to customize the gothic theme:

```css
.ghost-tour-container {
  background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%);
  /* Your custom styles */
}
```

### Building Appearance
Adjust building materials in `Building.tsx`:

```tsx
<meshStandardMaterial 
  color={color}
  metalness={0.3}  // Adjust metalness
  roughness={0.7}  // Adjust roughness
/>
```

### Camera Settings
Modify camera position and controls in `GhostTour.tsx`:

```tsx
<PerspectiveCamera 
  makeDefault 
  position={[15, 15, 15]}  // Adjust initial position
  fov={60}                 // Adjust field of view
/>
```

## Troubleshooting

### Buildings not appearing
- Check that `fileHistories` array is not empty
- Verify LOC and complexity values are > 0
- Check browser console for WebGL errors

### Timeline not working
- Ensure `gitCommits` array is provided
- Verify commits have valid dates
- Check that `filesChanged` arrays match file paths in `fileHistories`

### Export not working
- Check browser console for errors
- Verify popup blocker is not blocking download
- Ensure sufficient memory for large datasets

## Future Enhancements

- [ ] VR/AR support for immersive code exploration
- [ ] Collaborative viewing with multiplayer cursors
- [ ] Code smell visualization (technical debt as fog/decay)
- [ ] Dependency relationships as connecting lines
- [ ] Sound effects for building interactions
- [ ] Minimap for large codebases
- [ ] Search and filter buildings
- [ ] Custom building shapes based on file type

## Credits

Built with:
- [Three.js](https://threejs.org/) - 3D rendering
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) - React renderer for Three.js
- [React Three Drei](https://github.com/pmndrs/drei) - Useful helpers for R3F

Part of the CodeCrypt resurrection toolkit.
