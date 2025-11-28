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

// Stage 2: Hybrid Analysis
const astAnalysis = await analyzeAST(repo);
eventEmitter.emit('ast_analysis_complete', astAnalysis);

const llmInsights = await analyzeLLM(repo, astAnalysis);
eventEmitter.emit('llm_insight', llmInsights);

const combinedAnalysis = combineInsights(astAnalysis, llmInsights);

// Stage 3: Planning
const plan = await createResurrectionPlan(combinedAnalysis);

// Stage 4: Execution
for (const step of plan) {
  eventEmitter.emit('narration', { message: `Updating ${step.name}...` });
  const success = await executeStep(step);
  
  if (success) {
    metrics = await recalculateMetrics();
    eventEmitter.emit('metric_updated', metrics);
    eventEmitter.emit('transformation_applied', { step, metrics });
  }
}

// Stage 5: Time Machine Validation
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

### 2.5. Time Machine Validation Engine

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

### 2.6. Metrics Pipeline

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
