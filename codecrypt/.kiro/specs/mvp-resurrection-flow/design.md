# MVP Resurrection Flow: Design Document

## 1. System Architecture & Flow

The MVP will implement a simplified version of the full event-driven architecture. A **Kiro Agent** will execute the core **Resurrection Pipeline**. As the pipeline runs, it will emit events to a simple, local **Event Emitter**. A web-based **Frontend** will listen for these events to power the live dashboard and narration.

### High-Level Data Flow:
1.  **Input:** A GitHub URL is provided.
2.  **Agent Starts:** The Kiro Agent begins the resurrection process.
3.  **Pipeline Execution & Event Emission:**
    - The agent clones the repo, analyzes dependencies, and starts the update loop.
    - After each significant action (e.g., `dependency X updated`, `tests passed`), the agent calls `eventEmitter.emit('eventName', payload)`.
4.  **Frontend Receives Events:**
    - A simple WebSocket or SSE (Server-Sent Events) connection is established between the Kiro environment and the frontend.
    - The server listens to the `eventEmitter` and forwards events to the frontend.
    - The frontend React components update their state based on the incoming events.
5.  **Output:** The agent generates the final Markdown report.

## 2. Component Design

### 2.1. Kiro Agent & Resurrection Pipeline
-   **State:** The Kiro context will hold the core state of the resurrection (`dependencies`, `transformationLog`, etc.).
-   **Event Emitter:** A simple `EventEmitter` instance (from Node.js `events` module) will be used within the Kiro agent's process to decouple the pipeline logic from the real-time communication.
-   **Main Logic:** The `resurrect` function will proceed as planned, but now with `emit` calls at key points:
    ```typescript
    // Inside the dependency update loop
    eventEmitter.emit('narration', { message: `Updating ${dep.name}...` });
    const success = await updateDependencyAndTest(dep);
    if (success) {
      metrics.depsUpdated++;
      eventEmitter.emit('metrics', metrics);
      eventEmitter.emit('narration', { message: `${dep.name} updated successfully.` });
    }
    ```

### 2.2. Real-time Communication Layer
-   **Backend (Kiro side):** An `http` server will be created within the Kiro tool. It will expose a Server-Sent Events (SSE) endpoint (e.g., `/events`).
-   **SSE Endpoint:** When a client connects, the endpoint will register a listener to the local `eventEmitter`. Whenever an event is emitted, it will be formatted as an SSE message and sent to the client.
    ```typescript
    // Inside the SSE endpoint handler
    eventEmitter.on('metrics', (data) => {
      response.write(`event: metrics\n`);
      response.write(`data: ${JSON.stringify(data)}\n\n`);
    });
    ```
-   **Frontend (Browser side):** The frontend will use the native `EventSource` API to connect to the `/events` endpoint and listen for incoming messages.

### 2.3. Frontend Application (React)

-   **Structure:** A single-page React application.
-   **`EventSource` Hook:** A custom hook (`useEventSource`) will manage the connection to the SSE endpoint and update the application's state.
-   **State Management:** A simple `useState` or `useReducer` hook will hold the global state for the dashboard metrics.
-   **Components:**
    -   **`Dashboard.tsx`:** The main component that displays the charts. It will receive the metrics state and pass it to individual chart components.
    -   **`Counter.tsx`:** A simple component to display a number (e.g., "Dependencies Updated: 5").
    -   **`ProgressBar.tsx`:** A component to visualize the overall progress.
    -   **`Narrator.tsx`:** A component that listens for `narration` events. When an event is received, it will use the `Web Speech API` to speak the message.
        ```typescript
        // Inside Narrator.tsx
        useEffect(() => {
          const eventSource = new EventSource('/events');
          eventSource.addEventListener('narration', (e) => {
            const data = JSON.parse(e.data);
            const utterance = new SpeechSynthesisUtterance(data.message);
            speechSynthesis.speak(utterance);
          });
          // ... cleanup ...
        }, []);
        ```

## 4. MVP "Frankenstein" Features Implementation

### Chart.js Dashboard
-   The `Dashboard.tsx` component will import `Chart.js`.
-   It will use a `useEffect` hook to create and update chart instances whenever the metrics state changes.

### Web Speech API Narration
-   The `Narrator.tsx` component will encapsulate all logic for speech synthesis.
-   It will be a "headless" component (i.e., it renders no UI itself) that simply listens for events and triggers the browser's speech API.
