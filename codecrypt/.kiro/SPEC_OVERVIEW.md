# CodeCrypt Spec Architecture Overview

## Spec Hierarchy

```
codecrypt/
├── .kiro/
│   ├── specs/
│   │   ├── mvp-resurrection-flow/          [MAIN COORDINATION SPEC]
│   │   │   ├── requirements.md             ✅ Complete
│   │   │   ├── design.md                   ✅ Complete
│   │   │   └── tasks.md                    🚧 Tasks 1-13 Done, 14-27 Remaining
│   │   │
│   │   ├── frontend-infrastructure/        [SUB-SPEC: React + Dashboard]
│   │   │   ├── requirements.md             ✅ Complete
│   │   │   ├── design.md                   🎯 Next: Create this
│   │   │   └── tasks.md                    ⏳ Generate after design
│   │   │
│   │   ├── ghost-tour-3d/                  [SUB-SPEC: 3D Visualization]
│   │   │   ├── requirements.md             ✅ Complete
│   │   │   ├── design.md                   ⏳ Create later
│   │   │   └── tasks.md                    ⏳ Generate after design
│   │   │
│   │   └── time-machine-validation/        [SUB-SPEC: Docker Testing]
│   │       ├── requirements.md             ✅ Complete
│   │       ├── design.md                   ⏳ Create later
│   │       └── tasks.md                    ⏳ Generate after design
│   │
│   ├── hooks/                              [AUTOMATION]
│   │   ├── auto-test-on-save.json          ✅ Active
│   │   ├── task-completion-reminder.json   ✅ Active
│   │   └── spec-sync-check.json            ✅ Active
│   │
│   ├── DEVELOPMENT_STRATEGY.md             📋 Strategy doc
│   ├── QUICK_START.md                      📖 Quick reference
│   └── SPEC_OVERVIEW.md                    📊 This file
```

## Task Distribution

### Main Spec: mvp-resurrection-flow
**Backend Core & Coordination**

| Task | Description | Status |
|------|-------------|--------|
| 1-12 | Core resurrection engine | ✅ Complete |
| 13 | LLM Integration | ✅ Complete |
| 14 | Enhanced Metrics Pipeline | 🎯 Next |
| 17 | AI Narrator | ⏳ Pending |
| 18 | Checkpoint | ⏳ Pending |
| 20 | Resurrection Symphony | ⏳ Pending |
| 22 | Checkpoint | ⏳ Pending |
| 23 | Update Planning with Hybrid Analysis | ⏳ Pending |
| 24 | Update Reporting | ⏳ Pending |
| 25 | Enhanced Event Architecture | ⏳ Pending |
| 26 | Integration & Polish | ⏳ Pending |
| 27 | Final Checkpoint | ⏳ Pending |

### Sub-Spec: frontend-infrastructure
**React Application & Dashboard**

| Original Task | Description | Status |
|---------------|-------------|--------|
| 15 | Frontend Infrastructure | 📝 Spec created |
| 15.1 | React app setup | ⏳ Needs design |
| 15.2 | SSE client hook | ⏳ Needs design |
| 15.3 | State management | ⏳ Needs design |
| 15.4* | Unit tests | ⏳ Needs design |
| 16 | Live Metrics Dashboard | 📝 Spec created |
| 16.1 | Chart.js setup | ⏳ Needs design |
| 16.2 | Dashboard component | ⏳ Needs design |
| 16.3 | Time-series charts | ⏳ Needs design |
| 16.4* | Component tests | ⏳ Needs design |

### Sub-Spec: ghost-tour-3d
**3D Code Visualization**

| Original Task | Description | Status |
|---------------|-------------|--------|
| 19 | 3D Ghost Tour | 📝 Spec created |
| 19.1 | Three.js setup | ⏳ Needs design |
| 19.2 | Building generation | ⏳ Needs design |
| 19.3 | Git history viz | ⏳ Needs design |
| 19.4 | Interactive timeline | ⏳ Needs design |
| 19.5 | Hotspot highlighting | ⏳ Needs design |
| 19.6 | Real-time updates | ⏳ Needs design |
| 19.7 | Export to HTML | ⏳ Needs design |
| 19.8* | Tests | ⏳ Needs design |

### Sub-Spec: time-machine-validation
**Docker-Based Testing**

| Original Task | Description | Status |
|---------------|-------------|--------|
| 21 | Time Machine Validation | 📝 Spec created |
| 21.1 | Docker integration | ⏳ Needs design |
| 21.2 | Environment detection | ⏳ Needs design |
| 21.3 | Container manager | ⏳ Needs design |
| 21.4 | Parallel test runner | ⏳ Needs design |
| 21.5 | Results comparator | ⏳ Needs design |
| 21.6* | Tests | ⏳ Needs design |

## Automation Hooks

### 1. Auto-test on Service File Save
```
Trigger: Save src/services/*.ts
Action:  Prompt to run tests
Status:  ✅ Active
```

### 2. Task Completion Reminder
```
Trigger: Message contains completion keywords
Action:  Remind to update tasks.md
Status:  ✅ Active
```

### 3. Spec Sync Check
```
Trigger: Save any design.md
Action:  Remind to check tasks.md sync
Status:  ✅ Active
```

## Development Phases

### ✅ Phase 1: Backend Foundation (Complete)
- Core resurrection engine
- AST analysis
- LLM integration
- Hybrid analysis

### 🚧 Phase 2: Backend Enhancement (Current)
- Enhanced metrics pipeline
- Event architecture
- Updated planning & reporting

### 🎯 Phase 3: Frontend Infrastructure (Next)
- React application setup
- SSE integration
- Live dashboard with Chart.js

### ⏳ Phase 4: Advanced Features
- AI Narrator (Web Speech API)
- 3D Ghost Tour (Three.js)
- Resurrection Symphony (Tone.js)

### ⏳ Phase 5: Validation & Polish
- Time Machine validation (Docker)
- Integration testing
- Final polish

## Benefits of This Architecture

### ✅ Focused Development
- Each sub-spec is self-contained
- Easier to review and iterate
- Clear scope boundaries

### ✅ Parallel Work Potential
- Frontend and backend can progress independently
- Different features don't block each other
- Can prioritize based on demo needs

### ✅ Better Organization
- Related requirements grouped together
- Easier to find relevant documentation
- Clearer dependencies

### ✅ Automation Support
- Hooks reduce manual work
- Consistent testing reminders
- Automatic sync checks

## Next Actions

1. **Immediate:** Complete Task 14 (Enhanced Metrics Pipeline)
2. **Next:** Create design.md for frontend-infrastructure
3. **Then:** Generate tasks and start frontend implementation
4. **Later:** Create designs for 3D and Time Machine specs

## Questions?

- "Show me the frontend-infrastructure requirements"
- "What's the next task in the main spec?"
- "Help me create the frontend design document"
- "Explain the hybrid approach benefits"
