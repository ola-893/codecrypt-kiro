# Implementation Plan

- [x] 1. Set up project structure and core types
  - Create TypeScript interfaces for ResurrectionContext, DependencyInfo, and TransformationLog
  - Set up error handling utilities and logging infrastructure
  - Configure VS Code extension activation events for resurrection commands
  - _Requirements: FR-001, NFR-004_

- [x] 2. Implement GitHub repository input and cloning
  - [x] 2.1 Create command to accept GitHub repository URL
    - Register VS Code command `codecrypt.resurrectRepository`
    - Implement URL validation for GitHub repositories
    - Show progress notification during repository operations
    - _Requirements: FR-001, NFR-004_
  
  - [x] 2.2 Implement repository cloning via GitHub MCP
    - Use `github_server` MCP to fetch repository metadata
    - Clone repository to temporary workspace directory
    - Handle network errors with retry mechanism (3 attempts)
    - _Requirements: FR-002, NFR-002_

- [x] 3. Implement death detection analysis
  - [x] 3.1 Analyze commit history
    - Use `github_server` MCP to fetch commit history
    - Calculate time since last commit
    - Classify repository as "dead" if last commit > 2 years old
    - _Requirements: FR-002_
  
  - [x] 3.2 Generate Death Certificate
    - Create Markdown formatter for death certificate
    - Include last commit date and cause of death
    - Store death certificate in workspace
    - _Requirements: FR-002, NFR-004_

- [x] 4. Implement dependency analysis for npm
  - [x] 4.1 Detect and parse package.json
    - Search for package.json in repository root
    - Parse dependencies and devDependencies sections
    - Handle malformed JSON with error messages
    - _Requirements: FR-003_
  
  - [x] 4.2 Query npm registry for package versions
    - Use `package_registry_server` MCP to check package versions
    - Identify outdated dependencies (current vs latest stable)
    - Check for known security vulnerabilities
    - _Requirements: FR-003_
  
  - [x] 4.3 Build dependency report
    - Create DependencyReport data structure
    - Prioritize security vulnerabilities
    - Store report in ResurrectionContext
    - _Requirements: FR-003, FR-004_

- [x] 5. Implement resurrection planning
  - [x] 5.1 Create resurrection plan generator
    - Generate ordered list of dependency updates
    - Prioritize security patches first
    - Use "moderate" strategy (update to latest stable)
    - _Requirements: FR-004_
  
  - [x] 5.2 Create Git branch for resurrection
    - Generate branch name with timestamp: `codecrypt/resurrection-<timestamp>`
    - Create and checkout new branch
    - _Requirements: FR-005_

- [x] 6. Implement automated dependency updates
  - [x] 6.1 Create dependency updater
    - Modify package.json with new versions
    - Run `npm install` after each update
    - Commit changes with descriptive messages
    - _Requirements: FR-005_
  
  - [x] 6.2 Implement validation after each update
    - Run compilation check (if TypeScript)
    - Execute test suite via `npm test`
    - Capture test results and errors
    - _Requirements: FR-006_
  
  - [x] 6.3 Implement simple code transformation engine
    - Create transformation rules JSON file
    - Implement find-and-replace for common breaking changes
    - Apply transformations when tests fail
    - _Requirements: FR-005_
  
  - [x] 6.4 Implement rollback mechanism
    - Use `git reset --hard HEAD~1` to revert failed updates
    - Log rollback events to transformation log
    - Mark problematic dependencies in report
    - _Requirements: FR-006, NFR-002_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement resurrection reporting
  - [x] 8.1 Generate Resurrection Report
    - Create Markdown formatter for final report
    - Include summary of changes made
    - Add table of updated dependencies (package, old version, new version)
    - List security vulnerabilities fixed
    - Include link to resurrection branch
    - _Requirements: FR-007, NFR-004_
  
  - [x] 8.2 Create pull request via GitHub MCP
    - Use `github_server` MCP to create PR
    - Set PR title with resurrection theme
    - Include resurrection report in PR body
    - Handle PR creation errors gracefully
    - _Requirements: FR-007_

- [x] 9. Implement progress feedback and UI
  - [x] 9.1 Add progress notifications
    - Use VS Code Progress API for long-running operations
    - Show stage-by-stage progress (cloning, analyzing, updating, validating)
    - Display real-time feedback on dependency updates
    - _Requirements: NFR-004_
  
  - [x] 9.2 Create output channel for detailed logs
    - Create VS Code output channel for CodeCrypt
    - Log all operations and errors
    - Provide detailed transformation log
    - _Requirements: NFR-004_

- [x] 10. Implement error handling and security
  - [x] 10.1 Add comprehensive error handling
    - Wrap all MCP calls in try-catch blocks
    - Implement retry logic for network operations
    - Provide user-friendly error messages
    - _Requirements: NFR-002_
  
  - [x] 10.2 Implement sandboxing for npm operations
    - Run npm install and test commands in isolated environment
    - Prevent arbitrary code execution from affecting host
    - Validate all file system operations
    - _Requirements: NFR-003_
  
  - [x] 10.3 Secure API key handling
    - Store MCP credentials securely in VS Code settings
    - Never log or expose API keys
    - Validate MCP server connections
    - _Requirements: NFR-003_

- [x] 11. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement Hybrid AST Analysis Engine
  - [x] 12.1 Set up AST parsing infrastructure
    - Install and configure Babel for JavaScript parsing
    - Install and configure ts-morph for TypeScript parsing
    - Create AST parser service with file type detection
    - _Requirements: FR-004_
  
  - [x] 12.2 Implement structural analysis
    - Extract function signatures and call graphs from AST
    - Calculate cyclomatic complexity for functions and modules
    - Identify dependency relationships between modules
    - Extract code structure (classes, exports, imports)
    - _Requirements: FR-004_
  
  - [x] 12.3 Create metrics calculator
    - Calculate lines of code from AST
    - Calculate complexity metrics (cyclomatic, cognitive)
    - Identify code smells and anti-patterns
    - Generate structural analysis report
    - _Requirements: FR-004, FR-005_
  
  - [x] 12.4 Write unit tests for AST analysis
    - Test parsing of various JavaScript/TypeScript files
    - Test complexity calculation accuracy
    - Test handling of malformed code
    - _Requirements: FR-004_

- [x] 13. Implement LLM Integration for Semantic Analysis
  - [x] 13.1 Set up LLM client
    - Configure Anthropic SDK or OpenAI SDK
    - Implement API key management and security
    - Create retry logic with exponential backoff
    - Add timeout handling (30s per request)
    - _Requirements: FR-004, NFR-002_
  
  - [x] 13.2 Implement semantic analysis
    - Create prompts for analyzing developer intent
    - Extract domain concepts from code and comments
    - Identify idiomatic patterns and anti-patterns
    - Generate modernization suggestions
    - _Requirements: FR-004_
  
  - [x] 13.3 Create insight combiner
    - Merge AST structural data with LLM semantic insights
    - Resolve conflicts (prioritize AST for structure)
    - Generate comprehensive analysis for planning
    - _Requirements: FR-004_
  
  - [x] 13.4 Write unit tests for LLM integration
    - Test prompt generation
    - Test response parsing
    - Test error handling and retries
    - Mock LLM API for testing
    - _Requirements: FR-004, NFR-002_

- [x] 14. Implement Enhanced Metrics Pipeline
  - [x] 14.1 Create metrics calculation service
    - Calculate all metrics (deps, vulns, complexity, coverage, LOC)
    - Implement time-series storage in Kiro context
    - Create MetricsSnapshot data structure
    - _Requirements: FR-005, FR-010_
  
  - [x] 14.2 Integrate metrics with event system
    - Listen for transformation_applied events
    - Recalculate metrics after each transformation
    - Emit metric_updated events
    - Store metrics history for visualization
    - _Requirements: FR-005_
  
  - [x] 14.3 Write unit tests for metrics pipeline
    - Test metrics calculation accuracy
    - Test time-series storage
    - Test event emission
    - _Requirements: FR-005_

- [x] 15. Implement Frontend Infrastructure
  - [x] 15.1 Set up React application
    - Create React app with TypeScript
    - Set up build configuration (Webpack/Vite)
    - Configure CSS Modules with gothic theme
    - Create project structure (components, hooks, utils)
    - _Requirements: FR-005, FR-006, FR-007, FR-008_
  
  - [x] 15.2 Implement SSE client hook
    - Create useEventSource custom hook
    - Handle connection, reconnection, and cleanup
    - Parse and dispatch events to application state
    - Implement error handling for connection failures
    - _Requirements: FR-005, NFR-002_
  
  - [x] 15.3 Set up global state management
    - Create Context API for shared state
    - Implement useReducer for metrics state
    - Create actions for state updates
    - _Requirements: FR-005_
  
  - [x] 15.4 Write unit tests for frontend infrastructure
    - Test useEventSource hook
    - Test state management
    - Test event parsing
    - _Requirements: FR-005_

- [x] 16. Implement Live Metrics Dashboard
  - [x] 16.1 Install and configure Chart.js
    - Install Chart.js and React wrapper
    - Create chart configuration utilities
    - Set up responsive chart containers
    - _Requirements: FR-005_
  
  - [x] 16.2 Create Dashboard component
    - Build main dashboard layout
    - Create Counter components for statistics
    - Create ProgressBar component
    - Implement real-time chart updates
    - _Requirements: FR-005_
  
  - [x] 16.3 Implement time-series charts
    - Create line chart for complexity over time
    - Create line chart for test coverage over time
    - Create bar chart for dependencies updated
    - Create area chart for vulnerabilities fixed
    - _Requirements: FR-005_
  
  - [x] 16.4 Write component tests for dashboard
    - Test chart rendering
    - Test real-time updates
    - Test responsive behavior
    - _Requirements: FR-005_

- [x] 17. Implement AI Narrator
  - [x] 17.1 Create Narrator component
    - Implement Web Speech API integration
    - Create speech queue management
    - Configure voice, rate, and pitch settings
    - Handle browser compatibility
    - _Requirements: FR-006, NFR-003_
  
  - [x] 17.2 Implement narration event handling
    - Listen for narration events from SSE
    - Generate natural language for technical events
    - Queue and speak messages in order
    - Handle speech synthesis errors gracefully
    - _Requirements: FR-006_
  
  - [x] 17.3 Write tests for narrator
    - Test speech queue management
    - Test event handling
    - Mock Web Speech API
    - _Requirements: FR-006_

- [ ] 18. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 19. Implement 3D Ghost Tour Visualization
  - [ ] 19.1 Set up Three.js infrastructure
    - Install Three.js and React Three Fiber
    - Create Canvas component with lighting
    - Set up camera and orbit controls
    - Configure WebGL renderer
    - _Requirements: FR-007_
  
  - [ ] 19.2 Implement building generation
    - Create Building component (files as 3D boxes)
    - Calculate building positions (city layout algorithm)
    - Map LOC/complexity to building height
    - Map change frequency to building color
    - _Requirements: FR-007_
  
  - [ ] 19.3 Implement git history visualization
    - Fetch full git history via GitHub MCP
    - Generate building snapshots for each commit
    - Create timeline data structure
    - _Requirements: FR-007_
  
  - [ ] 19.4 Create interactive timeline
    - Implement timeline slider component
    - Update 3D scene based on timeline position
    - Animate transitions between timeline states
    - _Requirements: FR-007_
  
  - [ ] 19.5 Add hotspot highlighting
    - Identify frequently changed files
    - Highlight hotspot buildings with special effects
    - Add tooltips with file information
    - _Requirements: FR-007_
  
  - [ ] 19.6 Implement real-time updates (optional)
    - Listen for transformation_applied events
    - Update building heights/colors in real-time
    - Animate building changes
    - _Requirements: FR-007_
  
  - [ ] 19.7 Export 3D visualization
    - Implement export to standalone HTML file
    - Embed Three.js scene in HTML
    - Include interactive controls
    - _Requirements: FR-007, FR-010_
  
  - [ ]* 19.8 Write tests for 3D visualization
    - Test building generation
    - Test timeline functionality
    - Test hotspot detection
    - Mock Three.js for testing
    - _Requirements: FR-007_

- [ ] 20. Implement Resurrection Symphony
  - [ ] 20.1 Set up Tone.js infrastructure
    - Install Tone.js library
    - Create audio context and synthesizers
    - Configure audio output
    - _Requirements: FR-008_
  
  - [ ] 20.2 Implement metrics-to-music mapping
    - Map complexity to tempo
    - Map test coverage to harmony/consonance
    - Map vulnerabilities to dissonance
    - Map progress to key (minor → major)
    - _Requirements: FR-008_
  
  - [ ] 20.3 Create Symphony component
    - Listen for metric_updated events
    - Generate musical parameters from metrics
    - Trigger note sequences and chords
    - Implement smooth transitions
    - _Requirements: FR-008_
  
  - [ ] 20.4 Implement audio export (optional)
    - Record audio output to buffer
    - Export as WAV or MP3 file
    - Provide download link in report
    - _Requirements: FR-008, FR-010_
  
  - [ ]* 20.5 Write tests for symphony
    - Test metrics-to-music mapping functions
    - Test audio generation
    - Mock Tone.js for testing
    - _Requirements: FR-008_

- [ ] 21. Implement Time Machine Validation
  - [ ] 21.1 Set up Docker integration
    - Install Docker SDK for Node.js
    - Configure docker_server MCP connection
    - Implement Docker daemon detection
    - Handle Docker unavailable gracefully
    - _Requirements: FR-009, NFR-002_
  
  - [ ] 21.2 Implement historical environment detection
    - Parse package.json engines field for Node version
    - Analyze git history for Node version clues
    - Determine original Node.js version
    - _Requirements: FR-009_
  
  - [ ] 21.3 Create Docker container manager
    - Create containers with specific Node.js versions
    - Mount repository volumes
    - Install historical dependencies in container
    - Handle container lifecycle (create, start, stop, remove)
    - _Requirements: FR-009_
  
  - [ ] 21.4 Implement parallel test runner
    - Run original tests in Docker container
    - Run modernized tests in current environment
    - Capture stdout, stderr, and exit codes
    - Measure execution time for performance comparison
    - _Requirements: FR-009_
  
  - [ ] 21.5 Create results comparator
    - Compare test pass/fail status
    - Analyze output differences
    - Calculate performance delta
    - Determine functional equivalence
    - Generate validation report
    - _Requirements: FR-009, FR-010_
  
  - [ ]* 21.6 Write tests for Time Machine validation
    - Test Docker container creation
    - Test test execution in containers
    - Test results comparison
    - Mock Docker SDK for testing
    - _Requirements: FR-009_

- [ ] 22. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 23. Update Resurrection Planning with Hybrid Analysis
  - [ ] 23.1 Integrate AST analysis into planning
    - Use structural insights to identify refactoring opportunities
    - Prioritize updates based on complexity metrics
    - _Requirements: FR-004_
  
  - [ ] 23.2 Integrate LLM insights into planning
    - Use semantic insights to guide modernization strategy
    - Generate explanations for planned changes
    - _Requirements: FR-004_
  
  - [ ]* 23.3 Write tests for enhanced planning
    - Test planning with hybrid analysis
    - Test prioritization logic
    - _Requirements: FR-004_

- [ ] 24. Update Reporting with New Features
  - [ ] 24.1 Enhance Resurrection Report
    - Add AST analysis insights section
    - Add LLM semantic insights section
    - Add complexity metrics (before/after)
    - Add test coverage metrics (before/after)
    - Add Time Machine validation results
    - Include performance comparison data
    - _Requirements: FR-010_
  
  - [ ] 24.2 Embed visualizations in report
    - Embed or link to 3D Ghost Tour HTML
    - Embed Chart.js dashboard screenshots
    - Link to Resurrection Symphony audio file
    - Create interactive HTML report
    - _Requirements: FR-010_
  
  - [ ]* 24.3 Write tests for enhanced reporting
    - Test report generation with all sections
    - Test visualization embedding
    - _Requirements: FR-010_

- [ ] 25. Implement Enhanced Event Architecture
  - [ ] 25.1 Add new event types
    - Implement ast_analysis_complete event
    - Implement llm_insight event
    - Implement validation_complete event
    - Update event emitter to handle all event types
    - _Requirements: FR-004, FR-009_
  
  - [ ] 25.2 Update SSE server for new events
    - Forward new event types to frontend
    - Handle event filtering and routing
    - _Requirements: FR-004, FR-009_
  
  - [ ]* 25.3 Write tests for event architecture
    - Test event emission and handling
    - Test SSE forwarding
    - _Requirements: FR-004, FR-009_

- [ ] 26. Integration and Polish
  - [ ] 26.1 Integrate all components
    - Wire up AST analysis to resurrection pipeline
    - Wire up LLM analysis to resurrection pipeline
    - Wire up Time Machine validation to pipeline
    - Connect all frontend components to SSE events
    - _Requirements: All_
  
  - [ ] 26.2 Add error handling and resilience
    - Implement graceful degradation for optional features
    - Add comprehensive error messages
    - Handle missing dependencies (Docker, LLM API)
    - _Requirements: NFR-002_
  
  - [ ] 26.3 Performance optimization
    - Optimize AST parsing for large codebases
    - Implement caching for LLM responses
    - Optimize 3D rendering performance
    - Reduce SSE event frequency if needed
    - _Requirements: NFR-001_
  
  - [ ] 26.4 UI/UX polish
    - Apply gothic/spooky theme consistently
    - Add loading states and progress indicators
    - Improve responsive design
    - Add keyboard shortcuts and accessibility
    - _Requirements: NFR-003_
  
  - [ ]* 26.5 Write integration tests
    - Test full resurrection flow with all features
    - Test frontend-backend integration
    - Test error scenarios
    - _Requirements: All_

- [ ] 27. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
