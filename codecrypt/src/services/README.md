# Enhanced Event Architecture

## Overview

The enhanced event architecture provides a type-safe, centralized event system for the CodeCrypt resurrection process. It enables real-time communication between the backend pipeline and frontend visualizations through Server-Sent Events (SSE).

## Components

### 1. Event Emitter (`eventEmitter.ts`)

The `ResurrectionEventEmitter` is a type-safe wrapper around Node.js EventEmitter that provides:

- Type-safe event emission and subscription
- Automatic event wrapping with timestamps
- Centralized logging of all events
- Support for all resurrection event types

**Usage:**

```typescript
import { getEventEmitter } from './services/eventEmitter';

const eventEmitter = getEventEmitter();

// Emit events
eventEmitter.emitNarration({
  message: 'Starting resurrection process...',
  priority: 'high',
  category: 'info',
});

eventEmitter.emitDependencyUpdated({
  packageName: 'react',
  previousVersion: '16.0.0',
  newVersion: '18.0.0',
  success: true,
  vulnerabilitiesFixed: 2,
});

// Subscribe to events
eventEmitter.onMetricUpdated((event) => {
  console.log('Metrics updated:', event.data);
});
```

### 2. SSE Server (`sseServer.ts`)

The `SSEServer` forwards events from the event emitter to connected frontend clients via Server-Sent Events.

**Usage:**

```typescript
import { createSSEServer } from './services/sseServer';
import { getEventEmitter } from './services/eventEmitter';

const eventEmitter = getEventEmitter();

// Start SSE server
const sseServer = await createSSEServer(eventEmitter, {
  port: 3000,
  host: 'localhost',
  corsOrigin: '*',
});

console.log(`SSE server running on port 3000`);
console.log(`Connected clients: ${sseServer.getClientCount()}`);

// Stop server when done
await sseServer.stop();
```

### 3. Event Types (`types.ts`)

All event types and payloads are defined in `types.ts`:

- `transformation_applied` - Code transformation events
- `dependency_updated` - Dependency update events
- `test_completed` - Test execution events
- `metric_updated` - Metrics calculation events
- `narration` - AI narrator events
- `ast_analysis_complete` - AST analysis completion
- `llm_insight` - LLM semantic insights
- `validation_complete` - Time Machine validation results

## Integration with Metrics Service

The `MetricsService` automatically subscribes to relevant events and recalculates metrics:

```typescript
import { createMetricsService } from './services/metrics';
import { getEventEmitter } from './services/eventEmitter';

const eventEmitter = getEventEmitter();
const metricsService = createMetricsService(eventEmitter);

// Initialize with context
metricsService.initialize(context, astAnalysis, testCoverage);

// Metrics are automatically updated when events are emitted
eventEmitter.emitTransformationApplied({
  transformationType: 'dependency_update',
  packageName: 'lodash',
  success: true,
  details: {},
});

// Get current metrics
const currentMetrics = metricsService.getCurrentMetrics();
```

## Frontend Integration

Frontend clients connect to the SSE server to receive real-time updates:

```typescript
// Frontend code
const eventSource = new EventSource('http://localhost:3000/events');

eventSource.addEventListener('metric_updated', (e) => {
  const event = JSON.parse(e.data);
  console.log('Metrics:', event.data);
  updateDashboard(event.data);
});

eventSource.addEventListener('narration', (e) => {
  const event = JSON.parse(e.data);
  speak(event.data.message);
});

eventSource.addEventListener('validation_complete', (e) => {
  const event = JSON.parse(e.data);
  displayValidationResults(event.data.results);
});
```

## Event Flow

1. **Backend Pipeline** performs an action (e.g., updates a dependency)
2. **Event Emitter** emits a typed event (e.g., `dependency_updated`)
3. **Metrics Service** listens to the event and recalculates metrics
4. **Metrics Service** emits a `metric_updated` event
5. **SSE Server** forwards all events to connected frontend clients
6. **Frontend Components** receive events and update UI in real-time

## Testing

The event architecture is fully tested in `metrics.test.ts`:

```typescript
import { ResurrectionEventEmitter } from '../services/eventEmitter';

const eventEmitter = new ResurrectionEventEmitter();

eventEmitter.onMetricUpdated((event) => {
  assert.strictEqual(event.type, 'metric_updated');
  assert.ok(event.data.depsUpdated >= 0);
});

eventEmitter.emitMetricUpdated({
  timestamp: Date.now(),
  depsUpdated: 5,
  vulnsFixed: 3,
  complexity: 10,
  coverage: 80,
  loc: 1000,
  progress: 50,
});
```

## Requirements Validation

This implementation satisfies:

- **FR-004**: Hybrid AST + LLM Analysis events (`ast_analysis_complete`, `llm_insight`)
- **FR-009**: Time Machine Validation events (`validation_complete`)
- **NFR-002**: Reliable event handling with proper error handling
- **NFR-004**: Real-time dashboard updates with <2s latency
