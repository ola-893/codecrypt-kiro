# CodeCrypt Quick Start Guide

## Working with Specs

### View All Specs
```bash
ls -la codecrypt/.kiro/specs/
```

Current specs:
- `mvp-resurrection-flow/` - Main coordination spec (Tasks 1-27)
- `frontend-infrastructure/` - React + SSE + Dashboard (Tasks 15-16)
- `ghost-tour-3d/` - 3D visualization (Task 19)
- `time-machine-validation/` - Docker testing (Task 21)

### Start a Task from Main Spec
1. Open `codecrypt/.kiro/specs/mvp-resurrection-flow/tasks.md`
2. Find the task you want to work on
3. Click "Start task" button next to the task
4. Or tell Kiro: "Implement task 14 from mvp-resurrection-flow"

### Create Design for Sub-Spec
Tell Kiro:
```
Create the design document for the frontend-infrastructure spec
```

### Generate Tasks for Sub-Spec
After design is approved:
```
Generate the tasks document for the frontend-infrastructure spec
```

## Working with Hooks

### View Active Hooks
Open the Kiro sidebar → Agent Hooks section

Or check:
```bash
ls -la codecrypt/.kiro/hooks/
```

### Enable/Disable a Hook
1. Open Kiro Hook UI (Command Palette → "Open Kiro Hook UI")
2. Toggle the hook on/off

### Create a New Hook
1. Command Palette → "Open Kiro Hook UI"
2. Click "Create New Hook"
3. Configure trigger and action

## Common Commands

### Run All Tests
```bash
cd codecrypt && npm test -- --run
```

### Run Specific Test File
```bash
cd codecrypt && npm test -- --run out/test/llmAnalysis.test.js
```

### Check Task Status
Open `tasks.md` and look for:
- `[ ]` - Not started
- `[x]` - Complete
- `[-]` - In progress

### Update Task Status Manually
Change the checkbox in tasks.md:
```markdown
- [ ] Task name  →  - [x] Task name
```

## Development Workflow

### Starting a New Feature
1. Check if there's a sub-spec for it
2. If yes: Create design → Generate tasks → Implement
3. If no: Work from main spec tasks

### When You Complete a Task
1. Run tests to verify
2. Update task status in tasks.md
3. Commit your changes
4. Move to next task

### When Tests Fail
1. Read the error message
2. Fix the issue
3. Run tests again
4. Don't move on until tests pass

## Quick Tips

- **Use sub-specs** for complex features (Frontend, 3D, Docker)
- **Use main spec** for simpler features (Narrator, Metrics)
- **Let hooks help** - They'll remind you to test and update tasks
- **Test frequently** - Run tests after each significant change
- **Ask Kiro** - "What's the next task?" or "Help me with task 14"

## Current Status

✅ **Completed:** Tasks 1-13 (Backend core + AST + LLM)
🚧 **In Progress:** Task 14 (Enhanced Metrics Pipeline)
📝 **Ready:** Sub-specs have requirements, need design docs
🎯 **Next:** Complete Task 14, then start frontend

## Getting Help

- **Stuck on a task?** Ask: "Help me understand task 14"
- **Need to see code?** Ask: "Show me the LLM service"
- **Want to plan?** Ask: "What should I work on next?"
- **Need context?** Ask: "Explain the hybrid analysis approach"
