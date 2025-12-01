# CodeCrypt Full Resurrection Flow: Design Document

## 1. System Architecture & Flow

CodeCrypt implements a modular, event-driven architecture with two parallel streams: the **Analysis & Transformation Pipeline** (the "Engine") and the **Live Experience Layer** (the "Show"). A **Kiro Agent** orchestrates the core **Resurrection Pipeline**, emitting events to a local **Event Emitter**. A web-based **Frontend** listens for these events to power the live dashboard, narration, 3D visualization, and audio synthesis.

### High-Level Data Flow:
1.  **Input:** A GitHub URL is provided.
2.  **Agent Starts:** The Kiro Agent begins the resurrection process.
3.  **Initial Analysis:**
    - The agent clones the repo and performs death detection.
    - Hybrid Analysis (AST + LLM) runs to understand code structure and intent.
    - Git history is fetched for 3D Ghost Tour generation.
    - Initial metrics are calculated for baseline symphony and dashboard.
4.  **Pipeline Execution & Event Emission:**
    - The agent executes the resurrection plan (dependency updates, code transformations).
    - After each significant action, the agent emits events: `transformation_applied`, `dependency_updated`, `test_completed`, `metric_updated`.
5.  **Frontend Receives Events:**
    - A Server-Sent Events (SSE) connection is established between the backend and frontend.
    - The server listens to the `eventEmitter` and forwards events to the frontend.
    - Frontend React components update their state based on incoming events:
      - **Dashboard** updates charts
      - **Narrator** speaks events
      - **Symphony** adjusts music
      - **3D Ghost Tour** shows real-time changes (optional)
6.  **Time Machine Validation:**
    - Docker containers are created for original and modernized environments.
    - Tests run in parallel, results are compared.
7.  **Output:** The agent generates the final Markdown report with embedded visualizations and links.

## 2. Component Design

### 2.1. Kiro Agent & Resurrection Pipeline

#### Core State Management
-   **State:** The Kiro context holds the core state:
    - `dependencies`: Current dependency information
    - `transformationLog`: History of all changes
    - `metricsHistory`: Time-series of all metrics snapshots
    - `astAnalysis`: Structural analysis results
    - `llmInsights`: Semantic analysis results
    - `gitHistory`: Full commit history for visualization

#### Event Emitter Architecture
-   **Event Emitter:** A `EventEmitter` instance (Node.js `events` module) decouples pipeline logic from real-time communication.
-   **Event Types:**
    - `transformation_applied`: Fired after any code change
    - `dependency_updated`: Fired after dependency update
    - `test_completed`: Fired after test run
    - `metric_updated`: Fired when metrics are recalculated
    - `narration`: Fired for AI narrator events
    - `ast_analysis_complete`: Fired when AST analysis finishes
    - `llm_insight`: Fired when LLM provides insights

#### Main Pipeline Logic
```typescript
// Stage 1: Death Detection
const deathCertificate = await detectDeath(repo);
eventEmitter.emit('narration', { message: 'Repository classified as dead...' });

// Stage 1.5: BASELINE COMPILATION CHECK (CRITICAL - Prove it's broken)
eventEmitter.emit('narration', { message: 'Running baseline compilation check...' });
const baselineCompilation = await runBaselineCompilationCheck(repo);
context.baselineCompilation = baselineCompilation;

if (baselineCompilation.success) {
  eventEmitter.emit('narration', { 
    message: 'Repository compiles successfully! No resurrection needed.',
    category: 'success'
  });
} else {
  eventEmitter.emit('narration', { 
    message: `Compilation FAILED with ${baselineCompilation.errorCount} errors. Beginning resurrection...`,
    category: 'warning'
  });
  eventEmitter.emit('baseline_compilation_complete', baselineCompilation);
}

// Stage 2: Hybrid Analysis
const astAnalysis = await analyzeAST(repo);
eventEmitter.emit('ast_analysis_complete', astAnalysis);

const llmInsights = await analyzeLLM(repo, astAnalysis);
eventEmitter.emit('llm_insight', llmInsights);

const combinedAnalysis = combineInsights(astAnalysis, llmInsights);

// Stage 3: Planning
const plan = await createResurrectionPlan(combinedAnalysis);

// Stage 4: Execution with Validation
for (const step of plan) {
  eventEmitter.emit('narration', { message: `Updating ${step.name}...` });
  const success = await executeStep(step);
  
  if (success) {
    // Validate: Compilation (if TypeScript) + Tests (if available)
    const validationResult = await validateAfterUpdate(repo);
    
    if (validationResult.success) {
      metrics = await recalculateMetrics();
      eventEmitter.emit('metric_updated', metrics);
      eventEmitter.emit('transformation_applied', { step, metrics });
      eventEmitter.emit('test_completed', validationResult);
    } else {
      // Rollback on validation failure
      await rollbackLastCommit(repo);
      eventEmitter.emit('narration', { 
        message: `Update failed validation: ${validationResult.error}. Rolling back.`,
        category: 'warning'
      });
    }
  }
}

// Stage 5: FINAL COMPILATION CHECK (CRITICAL - Prove it's fixed)
eventEmitter.emit('narration', { message: 'Running final compilation verification...' });
const finalCompilation = await runFinalCompilationCheck(repo);
context.finalCompilation = finalCompilation;

// Stage 5.5: Generate Resurrection Verdict
const verdict = generateResurrectionVerdict(baselineCompilation, finalCompilation);
context.resurrectionVerdict = verdict;

if (verdict.resurrected) {
  eventEmitter.emit('narration', { 
    message: `🎉 RESURRECTION SUCCESSFUL! Fixed ${verdict.errorsFixed} compilation errors.`,
    category: 'success'
  });
} else if (finalCompilation.success) {
  eventEmitter.emit('narration', { 
    message: 'Repository was already compiling. No resurrection needed.',
    category: 'info'
  });
} else {
  eventEmitter.emit('narration', { 
    message: `Resurrection incomplete. ${verdict.errorsRemaining} errors remain.`,
    category: 'warning'
  });
}
eventEmitter.emit('resurrection_verdict', verdict);

// Stage 6: Time Machine Validation
const validationResults = await runTimeMachineTests();
eventEmitter.emit('validation_complete', validationResults);
```

### 2.2. Hybrid Analysis Engine

#### AST Parser
-   **Technology:** Babel for JavaScript, ts-morph for TypeScript
-   **Extracts:**
    - Function signatures and call graphs
    - Dependency relationships
    - Cyclomatic complexity
    - Code structure (classes, modules, exports)
-   **Output:** Structured JSON with code metrics and relationships

#### LLM Analyzer
-   **Technology:** Anthropic SDK (Claude) or OpenAI SDK
-   **Analyzes:**
    - Developer intent from comments and naming
    - Domain concepts and business logic
    - Idiomatic patterns and anti-patterns
    - Suggested modernization strategies
-   **Input:** Code snippets + AST context
-   **Output:** Semantic insights and recommendations

#### Insight Combiner
-   **Purpose:** Merge deterministic AST data with probabilistic LLM insights
-   **Strategy:**
    - Use AST for structural decisions (what to change)
    - Use LLM for semantic decisions (how to change)
    - Prioritize AST when conflicts arise
    - Use LLM to explain complex transformations
-   **Output:** Comprehensive analysis for planning stage

### 2.3. Real-time Communication Layer

#### Backend SSE Server
-   **Technology:** Node.js `http` server
-   **Endpoint:** `/events` (Server-Sent Events)
-   **Implementation:**
    ```typescript
    // SSE endpoint handler
    app.get('/events', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      // Forward all events to client
      const handlers = {
        metric_updated: (data) => {
          res.write(`event: metric_updated\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        },
        narration: (data) => {
          res.write(`event: narration\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        },
        transformation_applied: (data) => {
          res.write(`event: transformation_applied\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      };
      
      Object.entries(handlers).forEach(([event, handler]) => {
        eventEmitter.on(event, handler);
      });
      
      req.on('close', () => {
        Object.entries(handlers).forEach(([event, handler]) => {
          eventEmitter.off(event, handler);
        });
      });
    });
    ```

#### Frontend EventSource Client
-   **Technology:** Native browser `EventSource` API
-   **Custom Hook:** `useEventSource` manages connection and state updates
-   **Implementation:**
    ```typescript
    function useEventSource(url: string) {
      const [events, setEvents] = useState<Event[]>([]);
      
      useEffect(() => {
        const eventSource = new EventSource(url);
        
        eventSource.addEventListener('metric_updated', (e) => {
          const data = JSON.parse(e.data);
          setEvents(prev => [...prev, { type: 'metric', data }]);
        });
        
        eventSource.addEventListener('narration', (e) => {
          const data = JSON.parse(e.data);
          setEvents(prev => [...prev, { type: 'narration', data }]);
        });
        
        return () => eventSource.close();
      }, [url]);
      
      return events;
    }
    ```

### 2.4. Frontend Application (React)

#### Application Structure
-   **Framework:** React with TypeScript
-   **State Management:** `useReducer` for global state, Context API for sharing
-   **Styling:** CSS Modules with gothic/spooky theme

#### Core Components

##### Dashboard.tsx
-   **Purpose:** Main container for all visualizations
-   **Technology:** Chart.js for 2D charts
-   **Features:**
    - Real-time updating line charts for metrics over time
    - Counter components for key statistics
    - Progress bar for overall resurrection status
    - Time-series history display
-   **Implementation:**
    ```typescript
    function Dashboard({ metrics }: { metrics: Metrics }) {
      const chartRef = useRef<Chart>();
      
      useEffect(() => {
        if (chartRef.current) {
          chartRef.current.data.datasets[0].data.push(metrics.complexity);
          chartRef.current.update();
        }
      }, [metrics]);
      
      return (
        <div className="dashboard">
          <canvas ref={chartRef} />
          <Counter label="Dependencies Updated" value={metrics.depsUpdated} />
          <Counter label="Vulnerabilities Fixed" value={metrics.vulnsFixed} />
          <ProgressBar progress={metrics.progress} />
        </div>
      );
    }
    ```

##### Narrator.tsx
-   **Purpose:** AI-powered audio narration
-   **Technology:** Web Speech API
-   **Features:**
    - Speaks key events in real-time
    - Configurable voice and rate
    - Queue management for multiple events
-   **Implementation:**
    ```typescript
    function Narrator() {
      const events = useEventSource('/events');
      const queueRef = useRef<string[]>([]);
      
      useEffect(() => {
        const narrationEvents = events.filter(e => e.type === 'narration');
        narrationEvents.forEach(event => {
          const utterance = new SpeechSynthesisUtterance(event.data.message);
          utterance.rate = 1.1;
          utterance.pitch = 0.9;
          speechSynthesis.speak(utterance);
        });
      }, [events]);
      
      return null; // Headless component
    }
    ```

##### GhostTour.tsx
-   **Purpose:** 3D visualization of codebase
-   **Technology:** Three.js with React Three Fiber
-   **Features:**
    - 3D city representation (files as buildings)
    - Interactive timeline slider
    - Hotspot highlighting
    - Camera controls (orbit, zoom, pan)
    - Real-time updates during resurrection
-   **Data Structure:**
    ```typescript
    interface Building {
      id: string;
      name: string;
      position: [number, number, number];
      height: number; // LOC or complexity
      color: string; // Based on change frequency
      history: BuildingSnapshot[]; // For timeline
    }
    ```
-   **Implementation:**
    ```typescript
    function GhostTour({ gitHistory, currentMetrics }: Props) {
      const [timelinePosition, setTimelinePosition] = useState(0);
      
      const buildings = useMemo(() => 
        generateBuildings(gitHistory, timelinePosition),
        [gitHistory, timelinePosition]
      );
      
      return (
        <Canvas>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <OrbitControls />
          {buildings.map(building => (
            <Building key={building.id} {...building} />
          ))}
          <Timeline 
            position={timelinePosition} 
            onChange={setTimelinePosition} 
          />
        </Canvas>
      );
    }
    ```

##### Symphony.tsx
-   **Purpose:** Audio synthesis based on code metrics
-   **Technology:** Tone.js
-   **Features:**
    - Real-time music generation
    - Metrics-to-music mapping
    - Evolving soundtrack (chaos → harmony)
    - Export to audio file
-   **Mapping Strategy:**
    - **Complexity** → Tempo (high complexity = fast tempo)
    - **Test Coverage** → Harmony (high coverage = consonant chords)
    - **Vulnerabilities** → Dissonance (more vulns = more tension)
    - **Progress** → Key modulation (dead code = minor, resurrected = major)
-   **Implementation:**
    ```typescript
    function Symphony({ metrics }: { metrics: Metrics }) {
      const synthRef = useRef<Tone.PolySynth>();
      
      useEffect(() => {
        if (!synthRef.current) {
          synthRef.current = new Tone.PolySynth().toDestination();
        }
        
        // Map metrics to musical parameters
        const tempo = mapComplexityToTempo(metrics.complexity);
        const chord = mapCoverageToChord(metrics.coverage);
        const key = metrics.progress > 0.5 ? 'major' : 'minor';
        
        Tone.Transport.bpm.value = tempo;
        synthRef.current.triggerAttackRelease(chord, '4n');
      }, [metrics]);
      
      return null; // Headless component
    }
    ```

### 2.5. Compilation Proof Engine

#### Purpose
The Compilation Proof Engine is the **core of CodeCrypt** - it proves that dead code has been resurrected by:
1. Establishing a baseline (proving the code is broken)
2. Attempting resurrection (fixing compilation errors)
3. Verifying success (proving the code now compiles)

#### Compilation Strategy Detection
-   **Purpose:** Automatically detect the best compilation strategy for the project
-   **Strategies:**
    ```typescript
    type CompilationStrategy = 
      | 'typescript'      // tsc --noEmit
      | 'npm-build'       // npm run build
      | 'webpack'         // npx webpack --mode production
      | 'vite'            // npx vite build
      | 'custom';         // project-specific
    
    async function detectCompilationStrategy(repoPath: string): Promise<CompilationStrategy> {
      // Check for TypeScript
      if (await fileExists(path.join(repoPath, 'tsconfig.json'))) {
        return 'typescript';
      }
      
      // Check for Vite
      if (await fileExists(path.join(repoPath, 'vite.config.js')) ||
          await fileExists(path.join(repoPath, 'vite.config.ts'))) {
        return 'vite';
      }
      
      // Check for Webpack
      if (await fileExists(path.join(repoPath, 'webpack.config.js'))) {
        return 'webpack';
      }
      
      // Check for build script in package.json
      const pkg = await readPackageJson(repoPath);
      if (pkg.scripts?.build) {
        return 'npm-build';
      }
      
      return 'custom';
    }
    ```

#### Error Categorization
-   **Purpose:** Classify errors to enable targeted fixes
-   **Categories:**
    ```typescript
    type ErrorCategory = 
      | 'type'           // TS2xxx - type mismatches, missing properties
      | 'import'         // Cannot find module, missing exports
      | 'syntax'         // Unexpected token, parsing failures
      | 'dependency'     // Missing packages, version conflicts
      | 'config';        // tsconfig issues, build config problems
    
    interface CategorizedError extends CompilationError {
      category: ErrorCategory;
      suggestedFix?: string;
    }
    
    function categorizeError(error: CompilationError): ErrorCategory {
      const code = error.code;
      const message = error.message.toLowerCase();
      
      // Type errors (TS2xxx series)
      if (code.startsWith('TS2') || message.includes('type')) {
        return 'type';
      }
      
      // Import/Module errors
      if (code === 'TS2307' || message.includes('cannot find module') || 
          message.includes('has no exported member')) {
        return 'import';
      }
      
      // Syntax errors
      if (code.startsWith('TS1') || message.includes('unexpected') ||
          message.includes('expected')) {
        return 'syntax';
      }
      
      // Dependency errors
      if (message.includes('peer dep') || message.includes('version')) {
        return 'dependency';
      }
      
      // Config errors
      if (message.includes('tsconfig') || message.includes('config')) {
        return 'config';
      }
      
      return 'type'; // Default
    }
    ```

#### Automatic Fix Suggestions
-   **Purpose:** Suggest fixes based on error category
-   **Implementation:**
    ```typescript
    interface FixSuggestion {
      errorCategory: ErrorCategory;
      description: string;
      autoApplicable: boolean;
      fix: () => Promise<void>;
    }
    
    function generateFixSuggestions(errors: CategorizedError[]): FixSuggestion[] {
      const suggestions: FixSuggestion[] = [];
      
      // Group errors by category
      const byCategory = groupBy(errors, 'category');
      
      // Type errors
      if (byCategory.type?.length > 0) {
        suggestions.push({
          errorCategory: 'type',
          description: `Add type annotations or use 'any' for ${byCategory.type.length} type errors`,
          autoApplicable: false,
          fix: async () => { /* LLM-assisted type fixing */ }
        });
      }
      
      // Import errors
      if (byCategory.import?.length > 0) {
        const missingModules = extractMissingModules(byCategory.import);
        suggestions.push({
          errorCategory: 'import',
          description: `Install missing packages: ${missingModules.join(', ')}`,
          autoApplicable: true,
          fix: async () => { await installPackages(missingModules); }
        });
      }
      
      // Dependency errors
      if (byCategory.dependency?.length > 0) {
        suggestions.push({
          errorCategory: 'dependency',
          description: 'Update dependencies to resolve version conflicts',
          autoApplicable: true,
          fix: async () => { await updateDependencies(); }
        });
      }
      
      return suggestions;
    }
    ```

#### Baseline Compilation Check
-   **When:** Immediately after cloning, before any modifications
-   **Purpose:** Prove the repository is "dead" (doesn't compile)
-   **Technology:** Uses detected compilation strategy
-   **Output:** `BaselineCompilationResult`
    ```typescript
    interface BaselineCompilationResult {
      timestamp: Date;
      success: boolean;
      errorCount: number;
      errors: CategorizedError[];
      errorsByCategory: Record<ErrorCategory, number>;
      output: string;
      projectType: 'typescript' | 'javascript' | 'unknown';
      strategy: CompilationStrategy;
      suggestedFixes: FixSuggestion[];
    }
    
    interface CompilationError {
      file: string;
      line: number;
      column: number;
      message: string;
      code: string; // e.g., "TS2307"
    }
    
    interface CategorizedError extends CompilationError {
      category: ErrorCategory;
      suggestedFix?: string;
    }
    ```

#### Final Compilation Verification
-   **When:** After all resurrection steps complete
-   **Purpose:** Prove the repository is "alive" (now compiles)
-   **Comparison:** Compare against baseline to determine resurrection success

#### Resurrection Verdict
```typescript
interface ResurrectionVerdict {
  baselineCompilation: BaselineCompilationResult;
  finalCompilation: BaselineCompilationResult;
  resurrected: boolean; // true if baseline failed AND final passed
  errorsFixed: number;
  errorsRemaining: number;
  fixedErrors: CompilationError[];
  newErrors: CompilationError[]; // errors that appeared during resurrection
}
```

#### Implementation Flow
```typescript
// Stage 1: Baseline Compilation Check (after clone, before any changes)
async function runBaselineCompilationCheck(repoPath: string): Promise<BaselineCompilationResult> {
  const projectType = await detectProjectType(repoPath);
  
  if (projectType === 'typescript') {
    return await runTypeScriptCompilation(repoPath);
  } else if (projectType === 'javascript' && await hasBuildScript(repoPath)) {
    return await runJavaScriptBuild(repoPath);
  }
  
  return { success: true, errorCount: 0, errors: [], projectType: 'unknown' };
}

// Stage 2: Final Compilation Verification (after all resurrection steps)
async function runFinalCompilationCheck(repoPath: string): Promise<BaselineCompilationResult> {
  // Same logic as baseline - run compilation and capture results
  return await runBaselineCompilationCheck(repoPath);
}

// Stage 3: Generate Resurrection Verdict
function generateResurrectionVerdict(
  baseline: BaselineCompilationResult,
  final: BaselineCompilationResult
): ResurrectionVerdict {
  const resurrected = !baseline.success && final.success;
  const errorsFixed = baseline.errorCount - final.errorCount;
  
  // Find which errors were fixed
  const fixedErrors = baseline.errors.filter(
    baseErr => !final.errors.some(
      finalErr => finalErr.file === baseErr.file && 
                  finalErr.line === baseErr.line && 
                  finalErr.code === baseErr.code
    )
  );
  
  // Find new errors (shouldn't happen, but track them)
  const newErrors = final.errors.filter(
    finalErr => !baseline.errors.some(
      baseErr => baseErr.file === finalErr.file && 
                 baseErr.line === finalErr.line && 
                 baseErr.code === finalErr.code
    )
  );
  
  return {
    baselineCompilation: baseline,
    finalCompilation: final,
    resurrected,
    errorsFixed: fixedErrors.length,
    errorsRemaining: final.errorCount,
    fixedErrors,
    newErrors
  };
}
```

### 2.6. Per-Update Validation Engine

#### Test Validation
-   **Purpose:** Verify functional correctness after each update
-   **Technology:** Sandboxed npm test execution
-   **Features:**
    - Detect test scripts in `package.json`
    - Run tests in isolated environment
    - Capture test results and output
    - Parse test framework output (Jest, Mocha, Vitest)

#### Validation Flow
```typescript
async function validateAfterUpdate(repoPath: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    success: true,
    compilationChecked: false,
    testsRun: false
  };
  
  // Check if TypeScript project
  const isTS = await isTypeScriptProject(repoPath);
  
  if (isTS) {
    // Run compilation check
    result.compilationChecked = true;
    const compilationResult = await runCompilationCheck(repoPath);
    result.compilationPassed = compilationResult.success;
    
    if (!compilationResult.success) {
      result.success = false;
      result.error = 'Compilation failed';
      return result;
    }
  }
  
  // Check if test script exists
  const hasTests = await hasTestScript(repoPath);
  
  if (hasTests) {
    // Run tests
    result.testsRun = true;
    const testResult = await runTests(repoPath);
    result.testsPassed = testResult.success;
    
    if (!testResult.success) {
      result.success = false;
      result.error = 'Tests failed';
      return result;
    }
  }
  
  return result;
}
```

### 2.7. Time Machine Validation Engine

#### Docker Environment Manager
-   **Technology:** Docker SDK for Node.js
-   **MCP Integration:** `docker_server` MCP for container operations
-   **Features:**
    - Create containers with historical Node.js versions
    - Install historical dependencies
    - Run tests in isolated environments
    - Capture and compare outputs

#### Implementation Strategy
```typescript
async function runTimeMachineValidation(repo: Repository) {
  // Determine original Node.js version from git history
  const originalNodeVersion = await detectNodeVersion(repo.firstCommit);
  
  // Create Docker container with original environment
  const originalContainer = await docker.createContainer({
    image: `node:${originalNodeVersion}`,
    volumes: [{ host: repo.path, container: '/app' }]
  });
  
  // Run original tests
  const originalResults = await docker.exec(originalContainer, 'npm test');
  
  // Run modernized tests in current environment
  const modernResults = await exec('npm test', { cwd: repo.path });
  
  // Compare results
  return {
    originalPassed: originalResults.exitCode === 0,
    modernPassed: modernResults.exitCode === 0,
    functionalEquivalence: compareOutputs(originalResults, modernResults),
    performanceImprovement: calculatePerformanceDelta(originalResults, modernResults)
  };
}
```

### 2.8. Metrics Pipeline

#### Metrics Calculation
-   **Triggers:** After every transformation event
-   **Calculated Metrics:**
    - Dependencies updated count
    - Security vulnerabilities fixed count
    - Code complexity (cyclomatic complexity from AST)
    - Test coverage percentage (from test results)
    - Lines of code (from AST)
    - Overall progress percentage

#### Metrics Storage
-   **Format:** Time-series array in Kiro context
-   **Structure:**
    ```typescript
    interface MetricsSnapshot {
      timestamp: number;
      depsUpdated: number;
      vulnsFixed: number;
      complexity: number;
      coverage: number;
      loc: number;
      progress: number;
    }
    ```

#### Event Flow
```typescript
eventEmitter.on('transformation_applied', async (transformation) => {
  const newMetrics = await calculateMetrics(context);
  context.metricsHistory.push({
    timestamp: Date.now(),
    ...newMetrics
  });
  eventEmitter.emit('metric_updated', newMetrics);
});
```

## 3. Error Handling & Resilience

### AST Analysis Errors
-   Gracefully handle unparseable files
-   Log parsing errors but continue with partial analysis
-   Fall back to LLM analysis if AST fails

### LLM API Errors
-   Implement retry logic with exponential backoff
-   Set reasonable timeouts (30s per request)
-   Fall back to AST-only analysis if LLM unavailable
-   Cache LLM responses to avoid redundant calls

### Docker Errors
-   Handle missing Docker daemon gracefully
-   Provide clear error messages if Docker unavailable
-   Make Time Machine validation optional (skip if Docker fails)

### Frontend Errors
-   Handle SSE connection failures with reconnection logic
-   Gracefully degrade if WebGL unavailable (3D visualization)
-   Provide fallback UI if audio synthesis fails

## 4. Testing Strategy

### Unit Tests
-   Test AST parsing logic with sample code
-   Test metrics calculation functions
-   Test event emitter behavior
-   Test Docker container creation and cleanup

### Integration Tests
-   Test full pipeline with sample repository
-   Test SSE communication between backend and frontend
-   Test 3D visualization rendering
-   Test audio synthesis with sample metrics

### End-to-End Tests
-   Test complete resurrection flow on real repositories
-   Validate Time Machine results match expectations
-   Verify all visualizations render correctly
