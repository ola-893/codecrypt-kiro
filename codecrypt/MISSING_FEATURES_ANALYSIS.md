# Missing Frontend Features Analysis

## Current State

### ✅ What's Working
1. **SSE Connection** - Frontend connects to backend on localhost:3000
2. **Dashboard** - Shows real-time metrics from backend
3. **Compilation Status** - Displays baseline vs final compilation
4. **Narration** - AI narrator works with real events
5. **Symphony** - Music generation from metrics
6. **Charts** - All Chart.js visualizations working
7. **Context/State** - Global state management implemented

### ❌ What's Missing

#### 1. Ghost Tour - No Real Data
**Problem:** Ghost Tour component exists but uses mock/empty data
**Required:** 
- Git commit history from backend
- File change tracking over time
- Real-time updates during resurrection

**Backend Status:**
- ✅ `getCommitHistory()` function exists in `github.ts`
- ❌ Not called during resurrection
- ❌ Not sent via SSE to frontend
- ❌ No file history tracking

#### 2. Timeline - No Git Integration
**Problem:** Timeline component exists but has no real commit data
**Required:**
- List of commits with timestamps
- File states at each commit
- Ability to scrub through history

**Backend Status:**
- ❌ No timeline data being sent
- ❌ No commit markers in SSE events

#### 3. Real-Time 3D Updates
**Problem:** Ghost Tour doesn't update during resurrection
**Required:**
- Building updates when files change
- Visual indicators for transformations
- Complexity changes reflected in building height

**Backend Status:**
- ❌ No file-level transformation events
- ❌ No building update events

## Required Backend Changes

### 1. Add Git History Fetching to Orchestrator
```typescript
// In resurrectionOrchestrator.ts
async fetchAndEmitGitHistory(): Promise<void> {
  const commits = await getCommitHistory(this.state.context.repoPath);
  const fileHistories = await buildFileHistories(commits);
  
  this.eventEmitter.emit('git_history_loaded', {
    type: 'git_history_loaded',
    timestamp: Date.now(),
    data: { commits, fileHistories }
  });
}
```

### 2. Add File History Tracking
```typescript
// Track file changes during resurrection
async trackFileChange(filePath: string, change: FileChange): Promise<void> {
  this.eventEmitter.emit('file_changed', {
    type: 'file_changed',
    timestamp: Date.now(),
    data: { filePath, change }
  });
}
```

### 3. Add SSE Event Types
- `git_history_loaded` - Initial git history
- `file_changed` - File modified during resurrection
- `building_updated` - 3D building needs update

## Required Frontend Changes

### 1. Add Git History to Context
```typescript
// In ResurrectionContext.tsx
interface ResurrectionState {
  // ... existing fields
  gitCommits: GitCommit[];
  fileHistories: FileHistory[];
}
```

### 2. Connect Ghost Tour to Real Data
```typescript
// In App.tsx or GhostTour container
const { gitCommits, fileHistories } = useResurrection();

<GhostTour 
  fileHistories={fileHistories}
  gitCommits={gitCommits}
/>
```

### 3. Handle New SSE Events
```typescript
// In App.tsx
case 'git_history_loaded':
  dispatch(setGitHistory(event.data));
  break;
case 'file_changed':
  dispatch(updateFileHistory(event.data));
  break;
```

## Implementation Priority

### HIGH PRIORITY (For Demo)
1. ✅ SSE connection (DONE)
2. ✅ Dashboard with real metrics (DONE)
3. ✅ Compilation status (DONE)
4. ❌ Ghost Tour with git history (MISSING)
5. ❌ Timeline with real commits (MISSING)

### MEDIUM PRIORITY
6. ❌ Real-time 3D updates during resurrection
7. ❌ File-level transformation tracking
8. ❌ Hotspot detection from change frequency

### LOW PRIORITY
9. Export functionality (already implemented)
10. Advanced camera controls (already implemented)

## Quick Fix for Demo

If time is limited, we can:
1. Fetch git history once at start
2. Display static Ghost Tour with historical data
3. Skip real-time 3D updates during resurrection

This gives you a working Ghost Tour without needing real-time file tracking.

## Estimated Implementation Time

- **Quick Fix (Static Ghost Tour):** 30-45 minutes
- **Full Implementation (Real-time updates):** 2-3 hours
- **Polish & Testing:** 1 hour

## Recommendation

For your immediate demo, implement the **Quick Fix**:
1. Add git history fetching to orchestrator start
2. Emit git_history_loaded event
3. Connect Ghost Tour to real data
4. Show static historical visualization

This gives you a fully functional Ghost Tour that looks amazing without the complexity of real-time updates.
