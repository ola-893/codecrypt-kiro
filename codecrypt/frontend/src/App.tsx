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
} from './context/actions';
import {
  MetricsSnapshot,
  TransformationEvent,
  NarrationEvent,
  ASTAnalysisResult,
  LLMInsight,
  ValidationResult,
} from './types';
import { Dashboard, Narrator, Symphony } from './components';
import './styles/App.css';

function App() {
  const { dispatch, state } = useResurrection();
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Connect to SSE endpoint
  const { events, isConnected, error } = useEventSource({
    url: '/events',
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
    onOpen: () => {
      console.log('SSE connection established');
    },
    onError: (err) => {
      console.error('SSE connection error:', err);
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
    const timer = setTimeout(() => setIsInitializing(false), 800);
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
            <span className="status-connected" title="Connected to resurrection server" aria-label="Connected">
              ● Connected
            </span>
          ) : (
            <span className="status-disconnected" title="Waiting for connection" aria-label="Disconnected">
              ○ Disconnected
            </span>
          )}
        </div>
        {error && (
          <div className="connection-error" role="alert">
            <strong>Connection Error:</strong> {error}
            <br />
            <small>Make sure the backend server is running on port 3000.</small>
          </div>
        )}
      </header>
      <main className="app-main">
        {!isConnected && !error && (
          <div className="waiting-message">
            <div className="pulse-icon">⏳</div>
            <p>Waiting for resurrection process to begin...</p>
            <small>Start a resurrection from VS Code to see live updates</small>
          </div>
        )}
        <Dashboard />
      </main>
      {/* AI Narrator - headless component for audio narration */}
      <Narrator 
        events={narrationEvents}
        enabled={true}
        rate={1.1}
        pitch={0.9}
        volume={1.0}
      />
      {/* Resurrection Symphony - headless component for music generation */}
      <Symphony 
        metrics={state.currentMetrics}
        enabled={true}
        volume={0.5}
      />
    </div>
  );
}

export default App;
