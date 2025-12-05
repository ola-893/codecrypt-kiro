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
  const [demoMode, setDemoMode] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  
  // Detect if we're in production (Netlify) or development
  const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  
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
  
  // Connect to SSE endpoint - try real backend first, fallback to demo
  const { events, isConnected, error } = useEventSource({
    url: 'http://localhost:3000/events', // Always try to connect to backend
    reconnectInterval: 3000,
    maxReconnectAttempts: 2, // Try a couple times before giving up
    onOpen: () => {
      console.log('SSE connection established - connected to live backend!');
      setDemoMode(false); // Disable demo mode when connected
    },
    onError: (err) => {
      console.warn('SSE connection error - will fallback to demo mode', err);
      // Switch to demo mode after connection fails
      if (!demoMode) {
        setTimeout(() => setDemoMode(true), 1000);
      }
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

  // Load demo data only when in demo mode
  useEffect(() => {
    if (demoMode) {
      console.log('Demo mode activated - loading demo data...');
      fetch('/demo-data.json')
        .then(res => res.json())
        .then(data => {
          console.log('Loading demo data...');
          // Simulate events coming in over time
          let eventIndex = 0;
          const interval = setInterval(() => {
            if (eventIndex < data.events.length) {
              const event = data.events[eventIndex];
              
              switch (event.type) {
                case 'metric_updated':
                  // Ensure all required fields are present with defaults
                  const metrics: MetricsSnapshot = {
                    timestamp: event.data.timestamp || Date.now(),
                    depsUpdated: event.data.depsUpdated || event.data.dependenciesUpdated || 0,
                    vulnsFixed: event.data.vulnsFixed || event.data.vulnerabilities || 0,
                    complexity: event.data.complexity || 0,
                    coverage: event.data.coverage || 0,
                    loc: event.data.loc || event.data.linesOfCode || 0,
                    progress: event.data.progress || (event.data.depsUpdated / event.data.totalDependencies) || 0
                  };
                  dispatch(updateMetrics(metrics));
                  break;
                case 'transformation_applied':
                  dispatch(addTransformation(event.data as TransformationEvent));
                  break;
                case 'narration':
                  dispatch(addNarration(event.data as NarrationEvent));
                  break;
                case 'ast_analysis_complete':
                  dispatch(setASTAnalysis(event.data as ASTAnalysisResult));
                  break;
                case 'llm_insight':
                  dispatch(addLLMInsight(event.data as LLMInsight));
                  break;
                case 'validation_complete':
                  dispatch(setValidationResult(event.data as ValidationResult));
                  break;
              }
              
              eventIndex++;
            } else {
              clearInterval(interval);
              dispatch(setConnected(true));
            }
          }, 1500); // Event every 1.5 seconds
          
          return () => clearInterval(interval);
        })
        .catch(err => {
          console.error('Failed to load demo data:', err);
        });
    }
  }, [demoMode, dispatch]);

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
          {demoMode ? (
            <span className="status-demo" title="Demo mode - using sample data" aria-label="Demo Mode">
              ● Demo Mode
            </span>
          ) : isConnected ? (
            <span className="status-connected" title="Connected to live backend on localhost:3000" aria-label="Connected">
              ● Live Connected
            </span>
          ) : (
            <span className="status-disconnected" title="Waiting for backend connection" aria-label="Disconnected">
              ○ Connecting...
            </span>
          )}
        </div>
        {error && !demoMode && (
          <div className="connection-error" role="alert">
            <strong>Backend Connection:</strong> {error}
            <br />
            <small>Start a resurrection from VS Code to see live updates, or demo mode will activate automatically.</small>
          </div>
        )}
      </header>
      <main className="app-main">
        {!isConnected && !error && !demoMode && (
          <div className="waiting-message">
            <div className="pulse-icon">⏳</div>
            <p>Connecting to backend server...</p>
            <small>Start a resurrection from VS Code to see live updates</small>
          </div>
        )}
        
        {/* Audio enable button - only show if audio not enabled yet */}
        {!audioEnabled && (demoMode || isConnected) && (
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
