import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEventSource } from '../hooks/useEventSource';

// Mock EventSource
class MockEventSource {
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  private listeners: Map<string, ((event: MessageEvent) => void)[]> = new Map();
  readyState: number = 0;
  CONNECTING = 0;
  OPEN = 1;
  CLOSED = 2;

  constructor(url: string) {
    this.url = url;
    // Simulate async connection
    setTimeout(() => {
      this.readyState = this.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  close() {
    this.readyState = this.CLOSED;
  }

  // Helper method to simulate receiving an event
  simulateEvent(type: string, data: any) {
    const event = new MessageEvent(type, {
      data: JSON.stringify(data),
    });

    if (type === 'message' && this.onmessage) {
      this.onmessage(event);
    } else {
      const listeners = this.listeners.get(type);
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

describe('useEventSource', () => {
  let mockEventSource: MockEventSource;

  beforeEach(() => {
    // Replace global EventSource with mock
    vi.stubGlobal('EventSource', class {
      constructor(url: string) {
        mockEventSource = new MockEventSource(url);
        return mockEventSource as any;
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllTimers();
  });

  it('should initialize with empty events and disconnected state', () => {
    const { result } = renderHook(() =>
      useEventSource({ url: 'http://localhost:3001/events' })
    );

    expect(result.current.events).toEqual([]);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should connect to EventSource and update connection state', async () => {
    const onOpen = vi.fn();
    const { result } = renderHook(() =>
      useEventSource({
        url: 'http://localhost:3001/events',
        onOpen,
      })
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    expect(onOpen).toHaveBeenCalled();
    expect(result.current.error).toBe(null);
  });

  it('should parse and store metric_updated events', async () => {
    const { result } = renderHook(() =>
      useEventSource({ url: 'http://localhost:3001/events' })
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const metricsData = {
      timestamp: Date.now(),
      depsUpdated: 5,
      vulnsFixed: 3,
      complexity: 10,
      coverage: 0.8,
      loc: 1000,
      progress: 0.5,
    };

    mockEventSource.simulateEvent('metric_updated', metricsData);

    await waitFor(() => {
      expect(result.current.events).toHaveLength(1);
    });

    expect(result.current.events[0]).toEqual({
      type: 'metric_updated',
      data: metricsData,
    });
  });

  it('should parse and store transformation_applied events', async () => {
    const { result } = renderHook(() =>
      useEventSource({ url: 'http://localhost:3001/events' })
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const transformationData = {
      type: 'dependency',
      timestamp: Date.now(),
      details: {
        name: 'react',
        oldVersion: '17.0.0',
        newVersion: '18.0.0',
        success: true,
      },
    };

    mockEventSource.simulateEvent('transformation_applied', transformationData);

    await waitFor(() => {
      expect(result.current.events).toHaveLength(1);
    });

    expect(result.current.events[0]).toEqual({
      type: 'transformation_applied',
      data: transformationData,
    });
  });

  it('should parse generic message events', async () => {
    const { result } = renderHook(() =>
      useEventSource({ url: 'http://localhost:3001/events' })
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const messageData = {
      type: 'metric_updated',
      payload: {
        timestamp: Date.now(),
        depsUpdated: 2,
        vulnsFixed: 1,
        complexity: 5,
        coverage: 0.9,
        loc: 500,
        progress: 0.3,
      },
    };

    mockEventSource.simulateEvent('message', messageData);

    await waitFor(() => {
      expect(result.current.events).toHaveLength(1);
    });

    expect(result.current.events[0].type).toBe('metric_updated');
    expect(result.current.events[0].data).toEqual(messageData.payload);
  });

  it('should handle multiple events', async () => {
    const { result } = renderHook(() =>
      useEventSource({ url: 'http://localhost:3001/events' })
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const event1 = { timestamp: Date.now(), message: 'Starting resurrection' };
    const event2 = { timestamp: Date.now(), message: 'Updating dependencies' };

    mockEventSource.simulateEvent('narration', event1);
    mockEventSource.simulateEvent('narration', event2);

    await waitFor(() => {
      expect(result.current.events).toHaveLength(2);
    });

    expect(result.current.events[0].data).toEqual(event1);
    expect(result.current.events[1].data).toEqual(event2);
  });

  it('should clear events when clearEvents is called', async () => {
    const { result } = renderHook(() =>
      useEventSource({ url: 'http://localhost:3001/events' })
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    mockEventSource.simulateEvent('narration', { timestamp: Date.now(), message: 'Test' });

    await waitFor(() => {
      expect(result.current.events).toHaveLength(1);
    });

    result.current.clearEvents();

    await waitFor(() => {
      expect(result.current.events).toHaveLength(0);
    });
  });

  it('should handle connection errors', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useEventSource({
        url: 'http://localhost:3001/events',
        onError,
        maxReconnectAttempts: 1,
      })
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    mockEventSource.simulateError();

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
    });

    expect(onError).toHaveBeenCalled();
    expect(result.current.error).toBeTruthy();
  });

  it('should handle malformed JSON gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() =>
      useEventSource({ url: 'http://localhost:3001/events' })
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Simulate event with invalid JSON
    const invalidEvent = new MessageEvent('metric_updated', {
      data: 'invalid json{',
    });

    if (mockEventSource.onmessage) {
      mockEventSource.onmessage(invalidEvent);
    }

    // Should not crash, just log error
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(result.current.events).toHaveLength(0);

    consoleErrorSpy.mockRestore();
  });

  it('should cleanup on unmount', async () => {
    const onClose = vi.fn();
    const { result, unmount } = renderHook(() =>
      useEventSource({
        url: 'http://localhost:3001/events',
        onClose,
      })
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const closeSpy = vi.spyOn(mockEventSource, 'close');

    unmount();

    expect(closeSpy).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('should support manual reconnection', async () => {
    const { result } = renderHook(() =>
      useEventSource({ url: 'http://localhost:3001/events' })
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    mockEventSource.simulateError();

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
    });

    result.current.reconnect();

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    expect(result.current.error).toBe(null);
  });
});
