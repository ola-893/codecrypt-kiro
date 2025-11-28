# MVP Resurrection Flow: Design Document

## 1. System Architecture & Flow

The MVP Resurrection Flow is a linear, multi-stage pipeline orchestrated by the Kiro Agent. The flow is designed to be simple and robust for the initial implementation, focusing on a single language ecosystem (JavaScript/npm).

The high-level data flow is as follows:
1.  **Input:** A GitHub URL is passed to the Agent.
2.  **Stage 1: Discovery & Death Detection**
    - The `github_server` MCP is used to fetch repository metadata and clone it.
    - The agent analyzes commit history to determine if the repository is "dead".
    - **Output:** A cloned repository and a `death_certificate.md`.
3.  **Stage 2: Dependency Analysis**
    - The agent's `on_dependency_check` hook is triggered by the presence of `package.json`.
    - The `dependency_analyzer.kirospec` logic is executed.
    - The `package_registry_server` MCP is called to get the latest versions and vulnerability data for all npm dependencies.
    - **Output:** A `dependency_report.json` object in the Kiro context containing a list of outdated and vulnerable dependencies.
4.  **Stage 3: Resurrection & Validation**
    - The agent creates a new branch: `codecrypt/resurrection-<timestamp>`.
    - The agent iterates through the list of dependencies from the report, starting with those that fix security vulnerabilities.
    - **For each dependency:**
      a.  Update version in `package.json`.
      b.  Run `npm install`.
      c.  Run `npm test`.
      d.  **If tests pass:** Commit the change.
      e.  **If tests fail:** Attempt a limited set of automated code fixes (e.g., find-and-replace for a renamed function). Re-run tests. If they still fail, roll back the change, log the error, and continue to the next dependency.
5.  **Stage 4: Reporting**
    - After the loop finishes, the agent generates a `resurrection_report.md`.
    - The agent uses the `github_server` MCP to create a Pull Request.
    - **Output:** A PR with the final report and a link to the modernized branch.

## 2. Component Design

### 2.1. The Kiro Agent
-   **State:** The agent's context will be used to store all intermediate data:
    ```typescript
    interface ResurrectionContext {
      repoUrl: string;
      isDead: boolean;
      dependencies: {
        name: string;
        currentVersion: string;
        latestVersion: string;
        vulnerabilities: any[];
        updateStatus: 'pending' | 'success' | 'failed';
      }[];
      transformationLog: string[];
    }
    ```
-   **Logic:** The main agent logic will be a single TypeScript file that implements the flow described above, calling the necessary MCPs and specs.

### 2.2. `dependency_analyzer.kirospec` (MVP Implementation)
-   **Detection:** Will implement a `detect_package_managers` function that specifically looks for `package.json`.
-   **Parsing:** Will use `JSON.parse` to read the `dependencies` and `devDependencies` objects.
-   **Analysis:** For each dependency, it will construct a call to the `package_registry_server` to fetch metadata. It will compare the `current_version` with the `latest_stable_version` to determine if it's outdated.

### 2.3. Code Transformation Engine (MVP)
-   **Strategy:** For the MVP, a simple, rule-based find-and-replace mechanism will be used. It will not parse the full AST.
-   **Rules:** A simple JSON file will store a list of common, safe transformations.
    ```json
    [
      {
        "package": "example-lib",
        "fromVersion": "1.x",
        "toVersion": "2.x",
        "transformation": {
          "type": "rename_function",
          "oldName": "oldFunction",
          "newName": "newFunction"
        }
      }
    ]
    ```
-   **Execution:** When tests fail after a dependency update, the agent will check this library for matching rules and apply them using a global file search and replace. This is a deliberate simplification for the MVP to avoid the complexity of AST manipulation.

## 3. MCP Server Payloads (Examples)

### `package_registry_server`: `check_package_versions`
-   **Request:**
    ```json
    {
      "packages": [
        { "name": "express", "version": "3.21.2" },
        { "name": "react", "version": "16.8.0" }
      ]
    }
    ```
-   **Response:**
    ```json
    {
      "results": [
        {
          "name": "express",
          "current_version": "3.21.2",
          "latest_stable_version": "4.17.1",
          "is_deprecated": true,
          "vulnerabilities": [ { "id": "CVE-2021-XXXX", "severity": "high" } ]
        },
        {
          "name": "react",
          "current_version": "16.8.0",
          "latest_stable_version": "18.2.0",
          "is_deprecated": false,
          "vulnerabilities": []
        }
      ]
    }
    ```

### `github_server`: `create_pull_request`
-   **Request:**
    ```json
    {
      "repository": "owner/repo",
      "head_branch": "codecrypt/resurrection-12345",
      "base_branch": "main",
      "title": "🧟 CodeCrypt Resurrection: Modernized Project",
      "body": "# Resurrection Report\n\n- Updated 5 dependencies.\n- Fixed 3 security vulnerabilities."
    }
    ```
-   **Response:**
    ```json
    {
      "status": "success",
      "pull_request_url": "https://github.com/owner/repo/pull/123"
    }
    ```

## 4. Error Handling & Rollback

-   **Atomic Changes:** Each dependency update is a single, atomic operation.
-   **Failure Detection:** Test failures are the primary mechanism for detecting a failed update.
-   **Rollback:** If an update fails and cannot be automatically fixed, the agent will use `git reset --hard HEAD~1` to revert the last commit and associated file changes.
-   **Logging:** All failures, rollback attempts, and successes will be logged in the `transformationLog` within the Kiro context, which will be included in the final report.