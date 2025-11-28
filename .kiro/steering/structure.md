# CodeCrypt System Structure

## 1. High-Level Architecture

CodeCrypt operates on a modular, pipeline-based architecture. The system is designed as an autonomous agent that takes a target repository as input and processes it through a series of distinct stages. Each stage is responsible for a specific aspect of the analysis and resurrection process, passing its output to the next stage. This design ensures separation of concerns, allows for parallel processing where possible, and makes the system extensible.

The core architectural components are:
- **Input Processor:** Handles various sources for identifying target repositories.
- **Analysis Pipeline:** A multi-stage workflow that performs the core logic of the tool.
- **Kiro Agent Core:** The central orchestrator that manages the workflow, state, and decision-making.
- **MCP Connectors:** A set of clients for interacting with external services like GitHub and package registries.
- **Output Generator:** Responsible for creating the final user-facing artifacts (reports, branches, etc.).

## 2. Component Breakdown

### 2.1. Input Processor
- **URL Parser:** Accepts and validates direct GitHub repository URLs.
- **GitHub Search API Client:** Interfaces with GitHub to find repositories based on topics, languages, or other criteria.
- **Organization Scanner:** Scans all repositories within a specified GitHub organization.
- **Local Repository Handler:** Allows CodeCrypt to operate on a codebase located on the local filesystem.

### 2.2. Kiro Agent Core
- **Workflow Engine:** Orchestrates the execution of the analysis pipeline stages based on the `resurrection_workflow.kirospec`.
- **State Manager:** Maintains the `kiro_context`, including workspace state (current repo analysis, logs) and cross-repository knowledge (learned patterns, compatibility matrices).
- **Decision Engine:** An AI-powered component that makes autonomous choices based on the analysis data, user configuration, and steering documents. For example, selecting a dependency upgrade strategy or choosing a code modernization pattern.
- **Hook Manager:** Listens for and triggers actions based on defined `agent_hooks` (e.g., `on_repo_scan`, `on_dependency_check`).

### 2.3. Analysis Pipeline Stages

The pipeline is the heart of CodeCrypt, defined by `resurrection_workflow.kirospec`.

- **Stage 1: Death Detection:**
  - **Cloner:** Clones the target repository.
  - **Activity Analyzer:** Fetches commit history, issue activity, and CI statuses via the GitHub MCP server to assess if the project is abandoned.
  - **Output:** A `Death Certificate` and a confidence score of abandonment.

- **Stage 2: Intent Extraction & Analysis:**
  - **Code Structure Mapper:** Parses the file system to identify the project's language, framework, and architectural pattern (e.g., MVC, Monolith, Microservices).
  - **Documentation Parser:** Uses NLP to analyze the `README.md` and other documentation to understand the project's original purpose.
  - **Dependency Analyzer:** (As defined in `dependency_analyzer.kirospec`) Detects package managers, builds a full dependency graph, and assesses the status of each dependency.
  - **Quality Assessor:** Runs linters, calculates code complexity, and estimates test coverage.
  - **Output:** A comprehensive health report and a summary of the project's intent.

- **Stage 3: Resurrection Planning:**
  - **Dependency Strategist:** Creates an ordered, safe plan for updating dependencies based on the analyzer's report and the user-selected strategy (conservative, moderate, aggressive).
  - **Code Modernization Planner:** Identifies all necessary code transformations, from simple syntax updates to complex API migrations, and prioritizes them.
  - **Testing Strategist:** Defines a plan to preserve, update, and augment the existing test suite.
  - **Risk Assessor:** Estimates the probability of a successful resurrection and identifies high-risk changes that may require user approval.
  - **Output:** A detailed, step-by-step `Resurrection Plan`.

- **Stage 4: Automated Resurrection:**
  - **Git Branch Manager:** Creates and manages the `codecrypt/resurrection-{timestamp}` branch.
  - **Transformation Engine:** Iteratively executes the resurrection plan, applying dependency updates and code transformations.
  - **Inline Tester:** After each significant change, this component runs the relevant tests to ensure the system remains stable.
  - **Rollback Handler:** If a change breaks compilation or tests catastrophically, this component reverts the last change and logs the error.
  - **Output:** A Git branch containing the modernized code.

- **Stage 5: Validation & Output Generation:**
  - **Quality Gate:** A final validation step that ensures the resurrected code compiles, passes a threshold of tests, and has no critical security vulnerabilities.
  - **Report Generator:** Creates the interactive HTML `Resurrection Report`.
  - **Ghost Tour Generator:** Creates the `Ghost Tour` by combining commit history with the transformation log, providing a narrative of the project's life, death, and resurrection.
  - **Publisher:** Handles the final output, such as creating a pull request on GitHub or creating a downloadable archive.

## 3. Data Flow & State Management

1.  **Initialization:** The `Input Processor` provides a repository source to the `Kiro Agent Core`.
2.  **Cloning & Analysis:** The agent clones the repo and begins the `Analysis Pipeline`. Each stage enriches the `kiro_context` with its findings (e.g., `death_assessment`, `project_intent`, `dependency_status`).
3.  **Planning:** The `Resurrection Planning` stage reads the analysis data from the context and produces a `Resurrection Plan`, which is also stored in the context.
4.  **Execution:** The `Automated Resurrection` stage executes the plan, continuously updating the codebase in the resurrection branch and logging every action to the transformation history in the `kiro_context`.
5.  **Finalization:** The `Output Generator` reads the final state, the transformation history, and the original analysis from the context to produce the final reports.

This stateful, context-driven approach allows the agent to make informed decisions at every step and enables powerful features like cross-repository learning.