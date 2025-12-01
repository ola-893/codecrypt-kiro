# CodeCrypt Full Resurrection Flow: Requirements

## 1. Introduction

This document outlines the requirements for the complete CodeCrypt Resurrection Flow. The goal is to create a high-impact, multi-sensory demo by resurrecting a JavaScript-based (Node.js) repository while providing a compelling, real-time user experience with advanced visualization, audio feedback, and validation capabilities.

## 2. Functional Requirements

### Core Resurrection Engine

#### FR-001: Repository Input & Death Detection
- The system shall accept a public GitHub repository URL.
- It shall clone the repository and classify it as "dead" if the last commit is older than two years, producing a basic `Death Certificate`.
- **Baseline Compilation Check:** After cloning, the system shall attempt to compile the repository to establish a baseline:
  - **Multiple Compilation Strategies:** The system shall detect and use the appropriate compilation strategy:
    - TypeScript projects: Run `tsc --noEmit`
    - JavaScript with build script: Run `npm run build`
    - Webpack projects: Run `npx webpack --mode production`
    - Vite projects: Run `npx vite build`
    - Custom build scripts: Detect and run project-specific build commands
  - **Error Categorization:** The system shall categorize compilation errors into:
    - Type errors (TS2xxx codes, type mismatches)
    - Import/Module errors (cannot find module, missing exports)
    - Syntax errors (unexpected token, parsing failures)
    - Dependency errors (missing packages, version conflicts)
    - Configuration errors (tsconfig issues, webpack config problems)
  - Store the baseline compilation result (success/failure, error count, categorized errors) in the ResurrectionContext
  - Document compilation failures in the Death Certificate as "Cause of Death: Compilation Failure" with error breakdown by category

#### FR-002: Dependency Analysis & Planning (npm)
- The system shall parse `package.json` to identify outdated dependencies and known security vulnerabilities.
- It shall create a plan to update dependencies to their latest stable versions.

#### FR-003: Automated Resurrection & Validation
- The system shall create a new branch for the modernized code.
- It shall iteratively update dependencies, run `npm install`, and execute validation after each update.
- **After each dependency update:** For TypeScript projects, the system shall run compilation checks (`tsc --noEmit`) to verify the code compiles.
- **After each dependency update:** If a test script exists, the system shall execute the test suite to verify functional correctness.
- **Automatic Fix Suggestions:** Based on error categories, the system shall suggest and optionally apply fixes:
  - **Type errors:** Suggest type annotations, any casts, or @ts-ignore comments
  - **Import errors:** Suggest package installation, path corrections, or import syntax updates
  - **Syntax errors:** Suggest syntax corrections based on common patterns
  - **Dependency errors:** Suggest specific version updates or alternative packages
  - **Configuration errors:** Suggest tsconfig or build config modifications
- The system will attempt a small, predefined set of automated code fixes for common breaking changes.
- If a change fails validation (compilation or tests), it will be rolled back, and the dependency marked as problematic.
- **Final Compilation Verification:** After all resurrection steps complete, the system shall:
  - Run a final compilation check using the same strategy as the baseline
  - Compare final compilation result against baseline by error category
  - Calculate "resurrection success" based on: baseline failed → final passed
  - Generate error diff showing which categories were fixed
  - Store the comparison in ResurrectionContext for reporting

### Advanced Analysis Engine

#### FR-004: Hybrid AST + LLM Analysis
- The system shall perform deterministic structural analysis using AST libraries (Babel, ts-morph).
- The system shall extract function signatures, dependencies, and code complexity metrics from the AST.
- The system shall perform semantic analysis using LLM integration to understand developer intent and domain concepts.
- The system shall combine AST and LLM outputs to create a comprehensive understanding of the codebase.
- The combined analysis shall inform the resurrection planning stage with both structural and semantic insights.

### Live Experience Layer

#### FR-005: Live Metrics Dashboard (Chart.js)
- The system shall display a web-based dashboard visible during the resurrection process.
- The dashboard must include real-time charts showing:
  - Number of dependencies updated
  - Number of security vulnerabilities fixed
  - Code complexity metrics over time
  - Test coverage percentage
  - Overall progress bar
- The dashboard shall display a time-series history of all metrics.
- The charts must update live as corresponding actions are completed in the backend.

#### FR-006: AI Narration (Web Speech API)
- The system shall provide real-time, audible narration of key events during the resurrection.
- Narration events must include:
  - Announcing the start of the resurrection process
  - Announcing which dependency is currently being updated
  - Announcing the results of test runs
  - Announcing critical errors or failed updates
  - Announcing AST and LLM analysis insights
  - Announcing the successful completion of the resurrection

#### FR-007: 3D Ghost Tour Visualization (Three.js)
- The system shall generate an interactive 3D visualization representing the codebase as a city.
- Each file or class shall be represented as a building, with height proportional to lines of code or complexity.
- The system shall provide an interactive timeline slider to visualize code evolution over the repository's history.
- The visualization shall highlight hotspots of activity (frequently changed files).
- The system shall show the resurrection process in real-time on the 3D model (optional).
- The final 3D scene shall be exportable as an interactive HTML file.

#### FR-008: Resurrection Symphony (Tone.js)
- The system shall translate code quality metrics into musical parameters.
- The system shall generate a live, evolving soundtrack during the resurrection process.
- Musical parameters shall be derived from:
  - Code complexity (tempo, dissonance)
  - Test coverage (harmony, consonance)
  - Number of vulnerabilities (tension, minor keys)
- The symphony shall evolve from "chaotic" (dead code) to "harmonious" (resurrected code).
- The final symphony shall be exportable as an audio file (optional).

### Validation & Quality Assurance

#### FR-009: Time Machine Validation (Docker)
- The system shall create a Docker container with the original environment (Node.js version from repository history).
- The system shall run the original test suite in the Docker container with historical dependencies.
- The system shall run the modernized test suite in the current environment with updated dependencies.
- The system shall compare test results between original and modernized versions.
- The system shall measure and report performance differences between environments.
- The system shall validate functional equivalence between original and resurrected code.

### FR-010: Output & Reporting
- The system shall produce a final `Resurrection Report` in Markdown.
- The report shall include:
  - **Resurrection Proof Section:**
    - Baseline compilation status (FAILED/PASSED) with error count
    - Final compilation status (FAILED/PASSED) with error count
    - Resurrection verdict: "RESURRECTED" if baseline failed and final passed
    - Compilation error diff (errors fixed vs remaining)
  - Summary of changes made
  - List of updated dependencies with version changes
  - List of security vulnerabilities fixed
  - Validation results for each update (compilation + tests where applicable)
  - AST and LLM analysis insights
  - Code complexity metrics (before and after)
  - Test coverage metrics (before and after)
  - Time Machine validation results
  - Link to resurrection branch
  - Embedded or linked 3D Ghost Tour visualization
  - Link to Resurrection Symphony audio file (if generated)

## 3. Non-Functional Requirements

#### NFR-001: Performance
- The end-to-end resurrection process for a medium-sized repository should complete in under 20 minutes (including advanced analysis and validation).
- The real-time dashboard and narration should have a latency of less than 2 seconds from the backend event to the frontend update.
- The 3D visualization should render smoothly at 30+ FPS for repositories with up to 1000 files.
- AST analysis should complete in under 5 minutes for medium-sized codebases.

#### NFR-002: Reliability
- The core resurrection engine must be robust, with graceful error handling and rollback.
- Docker container creation and management must handle failures gracefully.
- LLM API calls must have retry logic and timeout handling.

#### NFR-003: Usability
- The live dashboard must be clear, intuitive, and provide an immediate understanding of the process.
- The audio narration must be clear and intelligible.
- The 3D Ghost Tour must be interactive and responsive to user input.
- The Resurrection Symphony must be pleasant and not distracting.

#### NFR-004: Scope
- **Supported Stack:** `npm`-based JavaScript/Node.js projects only.
- **Automated Fixes:** The library of automated code fixes will be minimal.
- **Browser Compatibility:** Frontend features (3D, audio) must work in modern browsers (Chrome, Firefox, Safari, Edge).
