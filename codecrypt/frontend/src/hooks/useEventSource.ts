import { useEffect, useRef, useState, useCallback } from 'react';
import { SSEEvent, EventType } from '../types';

interface UseEventSourceOptions {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

interface UseEventSourceReturn {
  events: SSEEvent[];
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
  clearEvents: () => void;
}

/**
 * Custom hook for managing Server-Sent Events (SSE) connection
 * Handles connection, reconnection, cleanup, and event parsing
 */
export function useEventSource(options: UseEventSourceOptions): UseEventSourceReturn {
  const {
    url,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    onError,
    onOpen,
    onClose,
  } = options;

  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const connect = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        onOpen?.();
      };

      eventSource.onerror = (event) => {
        setIsConnected(false);
        
        const errorMessage = `SSE connection error (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`;
        setError(errorMessage);
        onError?.(event);

        // Attempt reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else {
          setError(`Failed to connect after ${maxReconnectAttempts} attempts`);
          onClose?.();
        }
      };

      // Listen for specific event types
      const eventTypes: EventType[] = [
        'metric_updated',
        'transformation_applied',
        'narration',
        'ast_analysis_complete',
        'llm_insight',
        'validation_complete',
      ];

      eventTypes.forEach((eventType) => {
        eventSource.addEventListener(eventType, (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            const sseEvent: SSEEvent = {
              type: eventType,
              data,
            };
            
            setEvents((prev) => [...prev, sseEvent]);
          } catch (parseError) {
            console.error(`Failed to parse ${eventType} event:`, parseError);
          }
        });
      });

      // Also listen for generic 'message' events
      eventSource.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const sseEvent: SSEEvent = {
            type: data.type || 'metric_updated',
            data: data.payload || data,
          };
          
          setEvents((prev) => [...prev, sseEvent]);
        } catch (parseError) {
          console.error('Failed to parse message event:', parseError);
        }
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to create EventSource: ${errorMessage}`);
      setIsConnected(false);
    }
  }, [url, reconnectInterval, maxReconnectAttempts, onError, onOpen, onClose]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setError(null);
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      setIsConnected(false);
      onClose?.();
    };
  }, [connect, onClose]);

  return {
    events,
    isConnected,
    error,
    reconnect,
    clearEvents,
  };
}
