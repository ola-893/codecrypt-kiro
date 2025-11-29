import { useMemo } from 'react';
import { SSEEvent, EventType } from '../types';

/**
 * Hook to filter events by type
 */
export function useFilteredEvents(events: SSEEvent[], eventType: EventType) {
  return useMemo(() => {
    return events.filter((event) => event.type === eventType);
  }, [events, eventType]);
}

/**
 * Hook to get the latest event of a specific type
 */
export function useLatestEvent(events: SSEEvent[], eventType: EventType) {
  return useMemo(() => {
    const filtered = events.filter((event) => event.type === eventType);
    return filtered.length > 0 ? filtered[filtered.length - 1] : null;
  }, [events, eventType]);
}
