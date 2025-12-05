import { useEffect, useState } from 'react';
import { useResurrection } from './context';
import { useEventSource, useNarrationEvents } from './hooks';
import {
  setConnected,
  updateMetrics,
  addTransformation,
  addNarration,
  setASTAnalysis,
  addLLMInsight,
  setValidationResult,
  setGitHistory,
} from './context/actions';
import {
  MetricsSnapshot,
  TransformationEvent,
  NarrationEvent,
  ASTAnalysisResult,
  LLMInsight,
  ValidationResult,
} from './types';
import { Dashboard, Narrator, Symphony, GhostTour } from './components';
import './styles/App.css';

function App() {
  const { dispatch, state } = useResurrection();
  const [isInitializing, setIsInitializing] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  
  // Handle audio initialization on user click
  const handleEnableAudio = async () => {
    try {
      // Import Tone.js dynamically
      const Tone = await import('tone');
      await Tone.start();
      setAudioEnabled(true);
    } catch (error) {
      console.error('Failed to enable audio:', error);
    }
  };
  
  // Connect to SSE endpoint
  const { events, isConnected, error } = useEventSource({
    url: 'http://localhost:3000/events',
    reconnectInterval: 3000,
    maxReconnectAttempts: 3,
    onOpen: () => {
      console.log('SSE connection established - connected to live backend!');
    },
    onError: (err) => {
      console.warn('SSE connection error:', err);
    },
    onClose: () => {
      console.log('SSE connection closed');
    },
  });

  // Convert SSE events to narration events
  const narrationEvents = useNarrationEvents(events);

  // Update connection status
  useEffect(() => {
    dispatch(setConnected(isConnected));
  }, [isConnected, dispatch]);

  // Handle initialization
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Process incoming events
  useEffect(() => {
    if (events.length === 0) return;

    const latestEvent = events[events.length - 1];

    switch (latestEvent.type) {
      case 'metric_updated':
        dispatch(updateMetrics(latestEvent.data as MetricsSnapshot));
        break;

      case 'transformation_applied':
        dispatch(addTransformation(latestEvent.data as TransformationEvent));
        break;

      case 'narration':
        dispatch(addNarration(latestEvent.data as NarrationEvent));
        break;

      case 'ast_analysis_complete':
        dispatch(setASTAnalysis(latestEvent.data as ASTAnalysisResult));
        break;

      case 'llm_insight':
        dispatch(addLLMInsight(latestEvent.data as LLMInsight));
        break;

      case 'validation_complete':
        dispatch(setValidationResult(latestEvent.data as ValidationResult));
        break;

      case 'git_history_loaded':
        const gitData = latestEvent.data as any;
        dispatch(setGitHistory(gitData.commits || [], gitData.fileHistories || []));
        break;
    }
  }, [events, dispatch]);

  // Show loading screen during initialization
  if (isInitializing) {
    return (
      <div className="app loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h2 className="loading-text">Awakening CodeCrypt...</h2>
          <p className="loading-subtext">Preparing the resurrection chamber</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🧟 CodeCrypt</h1>
        <p className="tagline">Resurrection Dashboard</p>
        <div className="connection-status">
          {isConnected ? (
            <span className="status-connected" title="Connected to live backend on localhost:3000" aria-label="Connected">
              ● Live Connected
            </span>
          ) : (
            <span className="status-disconnected" title="Waiting for backend connection" aria-label="Disconnected">
              ○ Disconnected
            </span>
          )}
        </div>
      </header>
      <main className="app-main">
        {!isConnected ? (
          <div className="instructions-container">
            <div className="instructions-card">
              <h2>🪦 Welcome to CodeCrypt</h2>
              <p className="intro">
                CodeCrypt brings dead code back to life by automatically modernizing dependencies, 
                fixing vulnerabilities, and updating deprecated APIs.
              </p>
              
              <div className="how-it-works">
                <h3>⚡ How It Works</h3>
                <ol className="steps-list">
                  <li>
                    <strong>Death Detection:</strong> Analyzes your repository to identify outdated dependencies, 
                    security vulnerabilities, and deprecated code patterns.
                  </li>
                  <li>
                    <strong>Hybrid Analysis:</strong> Combines AST parsing with AI to understand your code's 
                    structure and intent.
                  </li>
                  <li>
                    <strong>Resurrection Planning:</strong> Creates a detailed modernization plan with 
                    step-by-step transformations.
                  </li>
                  <li>
                    <strong>Automated Resurrection:</strong> Applies updates, runs tests, and validates 
                    changes in real-time.
                  </li>
                  <li>
                    <strong>Live Visualization:</strong> Watch the resurrection unfold with real-time metrics, 
                    3D code city, and AI narration.
                  </li>
                </ol>
              </div>

              <div className="getting-started">
                <h3>🚀 Getting Started</h3>
                <div className="step-box">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <h4>Open VS Code</h4>
                    <p>Make sure you have the CodeCrypt extension installed</p>
                  </div>
                </div>
                <div className="step-box">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <h4>Run the Command</h4>
                    <p>Press <code>Cmd+Shift+P</code> (Mac) or <code>Ctrl+Shift+P</code> (Windows/Linux)</p>
                    <p>Type: <code>CodeCrypt: Resurrect Repository</code></p>
                  </div>
                </div>
                <div className="step-box">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <h4>Enter GitHub URL</h4>
                    <p>Provide the URL of the repository you want to resurrect</p>
                    <p className="example">Example: <code>https://github.com/user/old-project</code></p>
                  </div>
                </div>
                <div className="step-box">
                  <div className="step-number">4</div>
                  <div className="step-content">
                    <h4>Watch the Magic</h4>
                    <p>This dashboard will come alive with real-time updates, metrics, and visualizations!</p>
                  </div>
                </div>
              </div>

              <div className="features-preview">
                <h3>✨ What You'll See</h3>
                <ul className="features-list">
                  <li>📊 <strong>Live Metrics Dashboard</strong> - Real-time charts showing progress</li>
                  <li>🏙️ <strong>3D Ghost Tour</strong> - Interactive code city visualization</li>
                  <li>🎙️ <strong>AI Narration</strong> - Voice explaining each step</li>
                  <li>🎵 <strong>Resurrection Symphony</strong> - Music that evolves with code quality</li>
                  <li>✅ <strong>Compilation Status</strong> - Before/after comparison</li>
                </ul>
              </div>

              <div className="waiting-indicator">
                <div className="pulse-icon">⏳</div>
                <p>Waiting for resurrection to begin...</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Audio enable button - only show if audio not enabled yet */}
            {!audioEnabled && (
              <div className="audio-prompt">
                <button onClick={handleEnableAudio} className="audio-enable-btn">
                  🔊 Enable Audio Experience
                </button>
                <small>Click to enable narration and symphony</small>
              </div>
            )}

            <Dashboard />

            {/* Ghost Tour - 3D Code Visualization */}
            {state.fileHistories.length > 0 && (
              <div className="ghost-tour-container">
                <h2 className="section-title">🏙️ 3D Code City - Ghost Tour</h2>
                <p className="section-subtitle">Explore the codebase evolution in 3D</p>
                <GhostTour 
                  fileHistories={state.fileHistories}
                  gitCommits={state.gitCommits}
                />
              </div>
            )}
          </>
        )}
      </main>
      {/* AI Narrator - headless component for audio narration */}
      <Narrator 
        events={narrationEvents}
        enabled={audioEnabled}
        rate={1.1}
        pitch={0.9}
        volume={1.0}
      />
      {/* Resurrection Symphony - headless component for music generation */}
      <Symphony 
        metrics={state.currentMetrics}
        enabled={audioEnabled}
        volume={0.5}
      />
    </div>
  );
}

export default App;
