# CodeCrypt Technical Specification

## 1. Core Technology Stack

- **Orchestration & Logic:** Kiro Native Tool. The entire workflow, agentic logic, and state management will be implemented using the Kiro SDK and platform.
- **Primary Language:** TypeScript. The Kiro tool itself will be developed in TypeScript, leveraging its strong typing to manage the complex data structures involved in code analysis and transformation.
- **AST & Code Transformation:** Abstract Syntax Tree (AST) libraries will be used for robust code analysis and modernization.
  - **JavaScript/TypeScript:** `Babel` or `ts-morph` for parsing and programmatic code modification.
  - **Python:** `AST` module (built-in) for analysis and `LibCST` for concrete syntax tree modifications.
  - **Other Languages:** Appropriate AST manipulation libraries will be integrated as support is expanded.
- **LLM Integration:** Large Language Models will be used for summarization, code explanation, and migration guide discovery, accessed via Kiro's native capabilities or a dedicated MCP server.

## 2. Kiro Integration Strategy

CodeCrypt is designed to be a showcase of the Kiro platform's capabilities, deeply integrating with its core protocols.

### 2.1. Model Context Protocol (MCP) Integration

MCP servers provide the agent with secure, reliable access to external services ("tools").

- **`github_server` (Essential):**
  - **Purpose:** To interact with the GitHub API.
  - **Key Capabilities:**
    - `fetch_repository_metadata`: Get repository details, languages, stars, etc.
    - `analyze_commit_history`: Retrieve commit logs to determine activity levels.
    - `clone_repositories`: Perform a `git clone` to the agent's workspace.
    - `create_resurrection_branches`: Push the new branch to the origin repository or a fork.
    - `create_pull_request`: Automatically generate a PR with the resurrection report.

- **`package_registry_server` (Essential):**
  - **Purpose:** A multiplexed server that can query various package registries (npm, PyPI, Maven Central, etc.).
  - **Key Capabilities:**
    - `check_package_versions`: Fetch the latest stable, LTS, and deprecated versions of a package.
    - `find_migration_paths`: Search for official or community-provided migration guides between versions.
    - `detect_deprecated_packages`: Identify packages that are no longer maintained.
    - `suggest_alternatives`: Find potential replacements for deprecated packages.

- **`security_scanner_mcp` (Highly Desirable):**
  - **Purpose:** To audit dependencies against security vulnerability databases (e.g., Snyk, npm audit).
  - **Key Capabilities:**
    - `audit_dependencies`: Takes a list of packages and versions and returns a list of known vulnerabilities (CVEs).

- **`web_search_mcp` (Highly Desirable):**
  - **Purpose:** To find documentation, release notes, and migration guides.
  - **Key Capabilities:**
    - `search`: Perform a web search for queries like "`<package-name>` migration guide `v1` to `v2`".

### 2.2. Agent Hooks Configuration

Hooks allow the agent to react to events in the workflow, enabling a flexible and event-driven process.

- **`on_repo_scan`:** Triggered when a repository is identified. This hook initiates the entire resurrection process, from cloning to the initial "death" analysis.
- **`on_dependency_check`:** Triggered when a dependency file (e.g., `package.json`) is found. This hook launches the deep dependency analysis as specified in `dependency_analyzer.kirospec`.
- **`on_code_analysis`:** Triggered once the codebase is ready for static analysis. This hook initiates AST parsing, pattern matching, and the generation of the code modernization plan.
- **`on_transformation_applied`:** A crucial hook triggered after every single dependency update or code refactor. It immediately runs tests and compilation checks to validate the change, enabling an incremental and safe transformation process.
- **`on_error`:** A global hook that triggers rollback procedures, logs detailed error context, and attempts automated fixes.
- **`on_resurrection_complete`:** The final hook, triggered after the validation stage passes. It orchestrates the generation of the final report, the Ghost Tour, and the pull request.

### 2.3. Specs-Driven Development

The entire logic of the agent is guided by `.kirospec` files, ensuring the implementation is transparent, modular, and directly tied to the project's goals.

- **`resurrection_workflow.kirospec`:** The main orchestrator, defining the high-level stages of the process.
- **`dependency_analyzer.kirospec`:** A detailed spec that governs all logic related to analyzing and planning dependency upgrades.
- **`code_modernizer.kirospec`:** Will contain a library of transformation patterns (e.g., "replace deprecated API call X with Y," "convert class component to functional component").
- **`quality_gates.kirospec`:** Defines the non-negotiable success criteria (e.g., "tests must pass with >= 80% coverage," "no critical security vulnerabilities").
- **`report_generator.kirospec`:** Specifies the structure and content of the final HTML/Markdown outputs.

## 3. Data Persistence & State Management

- **Workspace:** Each resurrection task is executed in an isolated, temporary workspace. This workspace contains the cloned repository, log files, and intermediate analysis results.
- **Kiro Context:** The primary mechanism for in-memory state management during a run. It holds the complete state of the analysis and transformation, allowing different components to communicate and the agent to make informed decisions.
- **Cross-Repository Knowledge Base (Future):** Successful transformation patterns and dependency compatibility information will be stored in a persistent database (e.g., a vector database) to improve the agent's performance and decision-making on future runs.