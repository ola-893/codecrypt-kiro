# CodeCrypt Development Strategy

## Overview

This document outlines the hybrid development approach for completing the CodeCrypt MVP, combining focused sub-specs with automation hooks and the main coordination spec.

## Architecture

### Main Spec: `mvp-resurrection-flow`
**Purpose:** Overall coordination and backend core features
**Status:** Tasks 1-13 ✅ Complete | Tasks 14-27 🚧 In Progress

**Completed:**
- ✅ Project structure and types
- ✅ GitHub integration and cloning
- ✅ Death detection
- ✅ Dependency analysis (npm)
- ✅ Resurrection planning
- ✅ Automated updates with rollback
- ✅ Validation and testing
- ✅ Reporting and PR creation
- ✅ Progress feedback
- ✅ Error handling and security
- ✅ AST Analysis Engine
- ✅ LLM Integration for Semantic Analysis

**Remaining in Main Spec:**
- Task 14: Enhanced Metrics Pipeline
- Task 23: Update Resurrection Planning with Hybrid Analysis
- Task 24: Update Reporting with New Features
- Task 25: Enhanced Event Architecture
- Task 26: Integration and Polish
- Task 27: Final Checkpoint

### Sub-Spec 1: `frontend-infrastructure`
**Purpose:** React app, SSE, and live dashboard
**Maps to:** Tasks 15-16 from main spec
**Status:** 📝 Requirements Complete | 🎯 Ready to Design

**Scope:**
- React + TypeScript setup
- Server-Sent Events (SSE) integration
- Custom hooks (useEventSource, useMetrics)
- Global state management (Context + useReducer)
- Chart.js dashboard with live updates
- Responsive design

**Next Steps:**
1. Create design.md
2. Generate tasks.md
3. Implement incrementally

### Sub-Spec 2: `ghost-tour-3d`
**Purpose:** Interactive 3D code visualization
**Maps to:** Task 19 from main spec
**Status:** 📝 Requirements Complete | 🎯 Ready to Design

**Scope:**
- Three.js + React Three Fiber setup
- Building generation from code structure
- City layout algorithm
- Git history visualization
- Interactive timeline
- Hotspot highlighting
- Real-time updates
- Export to standalone HTML

**Next Steps:**
1. Create design.md
2. Generate tasks.md
3. Implement incrementally

### Sub-Spec 3: `time-machine-validation`
**Purpose:** Docker-based historical testing
**Maps to:** Task 21 from main spec
**Status:** 📝 Requirements Complete | 🎯 Ready to Design

**Scope:**
- Docker SDK integration
- Historical environment detection
- Container creation and management
- Parallel test execution
- Results comparison
- Performance measurement
- Validation reporting

**Next Steps:**
1. Create design.md
2. Generate tasks.md
3. Implement incrementally

### Remaining Tasks (Keep in Main Spec)
- **Task 17:** AI Narrator (Web Speech API) - Simpler, keep in main spec
- **Task 18:** Checkpoint
- **Task 20:** Resurrection Symphony (Tone.js) - Can be separate spec if needed
- **Task 22:** Checkpoint

## Automation Hooks

### Active Hooks

1. **Auto-test on Service File Save**
   - Trigger: Save any file in `src/services/*.ts`
   - Action: Prompt to run tests for that file
   - Purpose: Catch bugs early

2. **Task Completion Reminder**
   - Trigger: Message contains "implemented", "completed", "finished", "done with"
   - Action: Remind to update task status
   - Purpose: Keep tasks.md in sync

3. **Spec Sync Check**
   - Trigger: Save any `design.md` file
   - Action: Remind to check if tasks.md needs updating
   - Purpose: Maintain consistency between design and tasks

### Future Hooks to Consider

- **On Test Failure:** Auto-create GitHub issue
- **On Task Complete:** Auto-commit with task reference
- **On Spec Create:** Auto-generate initial design template

## Development Workflow

### Phase 1: Backend Foundation (Current)
1. ✅ Complete Task 14: Enhanced Metrics Pipeline
2. ✅ Complete Task 25: Enhanced Event Architecture
3. ✅ Test backend event emission

### Phase 2: Frontend Infrastructure
1. Create design.md for `frontend-infrastructure` spec
2. Generate and review tasks.md
3. Implement React app + SSE
4. Implement dashboard with Chart.js
5. Test real-time updates

### Phase 3: Advanced Visualizations
1. **Option A:** Start with AI Narrator (simpler)
2. **Option B:** Start with 3D Ghost Tour (more impressive)
3. Complete design docs for chosen feature
4. Implement incrementally

### Phase 4: Validation & Polish
1. Complete Time Machine Validation spec
2. Implement Docker-based testing
3. Update resurrection planning with hybrid analysis
4. Update reporting with all new features
5. Integration testing
6. Final polish and bug fixes

## Recommended Next Steps

### Immediate (Today)
1. ✅ Create sub-spec requirements (DONE)
2. 🎯 Complete Task 14: Enhanced Metrics Pipeline
3. 🎯 Create design.md for `frontend-infrastructure`

### Short-term (This Week)
1. Generate tasks for frontend-infrastructure
2. Set up React application
3. Implement SSE connection
4. Build basic dashboard

### Medium-term (Next Week)
1. Complete frontend infrastructure
2. Choose between AI Narrator or 3D Ghost Tour
3. Create design for chosen feature
4. Begin implementation

## Success Metrics

- ✅ All tests passing (currently 204 tests)
- 🎯 Real-time events flowing from backend to frontend
- 🎯 Live dashboard displaying metrics
- 🎯 3D visualization rendering smoothly
- 🎯 Time Machine validation proving equivalence
- 🎯 Complete resurrection flow working end-to-end

## Notes

- Keep main spec for coordination and backend features
- Use sub-specs for complex, self-contained features
- Leverage hooks to automate repetitive tasks
- Test incrementally to catch issues early
- Maintain the gothic/spooky theme throughout
