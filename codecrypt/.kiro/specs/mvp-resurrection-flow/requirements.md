# MVP Resurrection Flow: Requirements

## 1. Introduction

This document outlines the requirements for the Minimum Viable Product (MVP) of the CodeCrypt Resurrection Flow. The goal is to create a high-impact demo by resurrecting a JavaScript-based (Node.js) repository while providing a compelling, real-time user experience.

## 2. Functional Requirements

### Core Resurrection Engine

#### FR-001: Repository Input & Death Detection
- The system shall accept a public GitHub repository URL.
- It shall clone the repository and classify it as "dead" if the last commit is older than two years, producing a basic `Death Certificate`.

#### FR-002: Dependency Analysis & Planning (npm)
- The system shall parse `package.json` to identify outdated dependencies and known security vulnerabilities.
- It shall create a plan to update dependencies to their latest stable versions.

#### FR-003: Automated Resurrection & Validation
- The system shall create a new branch for the modernized code.
- It shall iteratively update dependencies, run `npm install`, and execute the project's test suite (`npm test`).
- The system will attempt a small, predefined set of automated code fixes for common breaking changes.
- If a change fails validation, it will be rolled back, and the dependency marked as problematic.

### Live Experience Layer (MVP)

#### FR-004: Live Metrics Dashboard (Chart.js)
- The system shall display a web-based dashboard visible during the resurrection process.
- The dashboard must include, at a minimum, the following real-time charts:
  - A counter showing the number of dependencies updated.
  - A counter showing the number of security vulnerabilities fixed.
  - A progress bar indicating the overall progress of the resurrection plan.
- The charts must update live as the corresponding actions are completed in the backend.

#### FR-005: AI Narration (Web Speech API)
- The system shall provide real-time, audible narration of key events during the resurrection.
- Narration events must include, at a minimum:
  - Announcing the start of the resurrection process.
  - Announcing which dependency is currently being updated (e.g., "Now updating Express...").
  - Announcing the results of a test run (e.g., "Tests passed successfully.").
  - Announcing a critical error or a failed update.
  - Announcing the successful completion of the resurrection.

### FR-006: Output & Reporting
- The system shall produce a final `Resurrection Report` in Markdown.
- The report will include the summary of changes, the list of updated dependencies, and a list of any updates that failed.

## 3. Non-Functional Requirements

#### NFR-001: Performance
- The end-to-end resurrection process for a medium-sized repository should complete in under 15 minutes.
- The real-time dashboard and narration should have a latency of less than 2 seconds from the backend event to the frontend update.

#### NFR-002: Reliability
- The core resurrection engine must be robust, with graceful error handling and rollback.

#### NFR-003: Usability
- The live dashboard must be clear, intuitive, and provide an immediate understanding of the process.
- The audio narration must be clear and intelligible.

#### NFR-004: MVP Scope Limitations
- **Supported Stack:** `npm`-based JavaScript/Node.js projects only.
- **Excluded "Frankenstein" Features:** The 3D Ghost Tour (Three.js), Resurrection Symphony (Tone.js), Time Machine Testing (Docker), and Hybrid AST+LLM Analysis are **out of scope for the MVP** and will be implemented post-hackathon.
- **Automated Fixes:** The library of automated code fixes will be minimal.
