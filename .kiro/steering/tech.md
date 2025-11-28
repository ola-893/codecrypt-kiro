# CodeCrypt Technical Specification

## 1. Core Technology Stack

- **Orchestration & Logic:** Kiro Native Tool (TypeScript).
- **AST & Code Transformation:**
  - **Hybrid Model:** The system uses a powerful dual-layer approach.
    - **Layer 1 (Deterministic):** Abstract Syntax Tree (AST) libraries (`Babel`, `ts-morph`) for precise, structural analysis and code manipulation.
    - **Layer 2 (Semantic):** Large Language Models (LLMs) to understand developer intent, explain code, and suggest idiomatic modernizations.
- **Real-time Frontend:** A web-based UI (likely using React or Vue) will be required to host the various real-time visualization components.
- **Client-Side Visualization & Audio:**
  - **3D Graphics:** `Three.js` (potentially with `React Three Fiber`) for rendering the interactive 3D code city.
  - **2D Charting:** `Chart.js` for the live metrics dashboard.
  - **Speech Synthesis:** The browser's native `Web Speech API`.
  - **Music Synthesis:** `Tone.js` for generating the "Resurrection Symphony."
- **Containerization:** `Docker` for creating isolated, historical testing environments.

## 2. Kiro Integration Strategy

### 2.1. Model Context Protocol (MCP) Integration

CodeCrypt will leverage several MCP servers to interact with external systems.

- **`github_server` (Essential):**
  - **Purpose:** Full interaction with GitHub repositories.
  - **Key Capabilities:** `clone_repositories`, `get_full_commit_history`, `get_file_changes_over_time`, `create_pull_request`.

- **`package_registry_server` (Essential):**
  - **Purpose:** Query various package registries (npm, PyPI, etc.).
  - **Key Capabilities:** `check_package_versions`, `detect_deprecated_packages`.

- **`docker_server` (Essential for "Time Machine" Testing):**
  - **Purpose:** To build and manage Docker containers for side-by-side validation.
  - **Key Capabilities:**
    - `create_container_from_date`: Takes a language and a date/version (e.g., `node`, `12.x`) and creates a container with that environment.
    - `install_historical_dependencies`: Runs package manager commands within the container.
    - `run_tests_in_container`: Executes a test command and streams the results back to the agent.

- **`llm_server` (Essential for Hybrid Analysis):**
  - **Purpose:** To provide semantic understanding of code snippets.
  - **Key Capabilities:** `analyze_code_intent`, `suggest_modernization`.

- **`security_scanner_mcp` (Highly Desirable):** Audits dependencies against vulnerability databases.
- **`web_search_mcp` (Highly Desirable):** Finds documentation and migration guides.

### 2.2. Agent Hooks & Event-Driven Architecture

The agent's workflow is highly event-driven to support the real-time experience layer.

- **Core Hooks:**
  - `on_repo_scan`: Initiates the entire process.
  - `on_code_analysis`: Triggers the hybrid AST + LLM analysis.
  - `on_resurrection_complete`: Triggers the final "Time Machine" validation and report generation.

- **Real-time Event Hooks (High Frequency):**
  - These hooks are triggered by the core pipeline and consumed by the Live Experience Layer.
  - **`on_any_transformation`:** A generic hook fired after any change (dependency update, code refactor, etc.). This is the primary trigger for the metrics pipeline.
    - **Payload:** `{ type: 'dependency', details: { ... } }`
  - **`on_metric_update`:** Fired by the metrics pipeline. Consumed by the Dashboard and Symphony components.
    - **Payload:** `{ metrics: { complexity: 10, coverage: 0.8, ... } }`
  - **`on_narration_event`:** Fired by key stages in the pipeline. Consumed by the AI Narrator.
    - **Payload:** `{ message: "Updating React from version 16 to 18..." }`

### 2.3. Specs-Driven Development

- **`resurrection_workflow.kirospec`:** Defines the main pipeline, including the new `Hybrid Analysis` and `Time Machine Validation` stages.
- **`code_understanding.kirospec`:** A new spec that formally defines the process of combining AST and LLM analysis to produce a comprehensive modernization plan.
- **`dependency_analyzer.kirospec`:** Focuses on the mechanics of dependency resolution.
- **`quality_gates.kirospec`:** Defines success, now including the requirement for the Time Machine tests to pass.
- **`report_generator.kirospec`:** Will be updated to include embedding or linking to the interactive Ghost Tour and Symphony outputs.

## 3. Data Management

- **Kiro Context:** The central nervous system of the agent. It will manage:
  - **`workspace_state`:** The current repository, transformation logs, etc.
  - **`metrics_history`:** A time-series list of metric snapshots, allowing the entire resurrection visualization to be replayed.
- **Outputs:** The final outputs will be a collection of artifacts:
  - The modernized Git branch.
  - An interactive HTML report containing the Chart.js dashboard and the embedded Three.js Ghost Tour.
  - An optional `.mp3` file of the final "Resurrection Symphony."
