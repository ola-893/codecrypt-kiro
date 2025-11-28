# CodeCrypt System Structure

## 1. High-Level Architecture

CodeCrypt operates on a modular, event-driven architecture. The system is designed as an autonomous agent that processes a repository through a core **Analysis & Transformation Pipeline** while simultaneously streaming data to a **Live Experience Layer**. This dual-stream architecture ensures that the core logic of resurrection remains robust and verifiable, while the user-facing experience is rich, interactive, and real-time.

The core architectural components are:
- **Input Processor:** Identifies target repositories.
- **Kiro Agent Core:** The central orchestrator managing the workflow, state, and decision-making.
- **Analysis & Transformation Pipeline:** The sequential engine that performs the core work of resurrection.
- **Live Experience Layer:** A set of components that consume events from the pipeline to generate real-time visual and audio feedback.
- **MCP Connectors:** Clients for interacting with external services (GitHub, Docker, etc.).

## 2. Component Breakdown

### 2.1. Input Processor & Agent Core
(No changes from previous version: URL Parser, GitHub Search, Org Scanner, Workflow Engine, State Manager, Decision Engine, Hook Manager).

### 2.2. Analysis & Transformation Pipeline (The "Engine")

This is the core, sequential workflow for modernizing the code.

- **Stage 1: Death Detection:** Clones the repo and produces a `Death Certificate`.
- **Stage 2: Hybrid Analysis:**
  - **AST Parser:** Performs deterministic, structural analysis (function signatures, dependencies, complexity).
  - **LLM Analyzer:** Performs probabilistic, semantic analysis (developer intent, domain concepts).
  - **Insight Combiner:** Merges the AST and LLM outputs to create a comprehensive understanding of the code, which guides the planning stage.
- **Stage 3: Resurrection Planning:** Creates a detailed, step-by-step `Resurrection Plan`.
- **Stage 4: Automated Resurrection:** Executes the plan, applying transformations and committing changes to a new branch. **Crucially, this stage emits events after every action** (e.g., `dependencyUpdated`, `testRunCompleted`, `vulnerabilityFixed`).
- **Stage 5: "Time Machine" Validation:**
  - **Docker Environment Manager:** (via `docker_server` MCP) Spins up a container with the original environment (e.g., old Node.js version).
  - **Parallel Test Runner:** Executes the test suite on the original codebase in the Docker container and the modernized codebase in the current environment.
  - **Results Comparator:** Compares the outputs to validate functional equivalence and measure performance changes.

### 2.3. Live Experience Layer (The "Show")

This layer operates in parallel to the pipeline, consuming the events it emits.

- **Metrics Pipeline:** A central hub that listens for all transformation events. It calculates and aggregates metrics (e.g., complexity, test coverage, vulnerabilities fixed) and stores a history of these metrics in the Kiro context.
- **Real-time Dashboard (Chart.js):**
  - Subscribes to metric updates from the Metrics Pipeline.
  - Renders and animates charts in the user-facing UI.
- **AI Narrator (Web Speech API):**
  - Subscribes to high-level events from the pipeline (e.g., `on_dependency_update`, `on_error`).
  - Translates these technical events into natural language and speaks them.
- **Resurrection Symphony (Tone.js):**
  - Subscribes to metric updates from the Metrics Pipeline.
  - Translates numerical metrics (complexity, test coverage, etc.) into musical parameters (tempo, harmony, etc.) to generate a live, evolving soundtrack.
- **3D Ghost Tour Generator (Three.js):**
  - **Initial State:** Before the resurrection begins, it uses the full git history (from the `github_server` MCP) and the initial analysis to construct the entire 3D timeline of the project's life.
  - **Live Update (Optional):** Can subscribe to transformation events to show the "resurrection" happening in real-time on the 3D model.
  - **Final Output:** Generates the final interactive 3D visualization.

## 3. Data Flow & Event Architecture

1.  **Initiation:** The agent starts the **Analysis & Transformation Pipeline**.
2.  **Analysis:** The Hybrid Analysis stage completes, providing the initial data for planning. The Git history is passed to the **3D Ghost Tour Generator**. The initial code metrics are passed to the **Metrics Pipeline** to generate the baseline "dead code" symphony and dashboard state.
3.  **Transformation Loop:** The `Automated Resurrection` stage begins.
    - An action is performed (e.g., `axios` is updated from v0.21 to v1.2).
    - An event `transformation_applied` is emitted with a payload describing the change.
4.  **Event Handling:**
    - The **Metrics Pipeline** catches the event, recalculates metrics, and emits a `metrics_updated` event.
    - The **AI Narrator** catches the event and says, "Updating axios from version 0.21 to 1.2."
    - The **Dashboard** catches the `metrics_updated` event and updates the "Dependencies Updated" chart.
    - The **Symphony** catches the `metrics_updated` event and adjusts the music to be slightly more harmonious.
5.  **Validation:** Once the pipeline completes, the `Time Machine Validation` stage runs, providing the final proof of success.
6.  **Finalization:** The **3D Ghost Tour Generator** packages the final interactive scene.

This event-driven architecture decouples the core logic from the presentation, making the system robust and highly extensible.
