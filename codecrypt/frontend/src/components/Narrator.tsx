import { useEffect, useRef, useState } from 'react';
import { NarrationEvent } from '../types';

interface NarratorProps {
  events: NarrationEvent[];
  enabled?: boolean;
  voice?: SpeechSynthesisVoice | null;
  rate?: number;
  pitch?: number;
  volume?: number;
}

interface SpeechQueueItem {
  text: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: number;
}

/**
 * AI Narrator component that provides real-time audio narration
 * using the Web Speech API
 * 
 * This is a headless component (renders nothing) that manages
 * speech synthesis for resurrection events
 */
export function Narrator({
  events,
  enabled = true,
  voice = null,
  rate = 1.1,
  pitch = 0.9,
  volume = 1.0,
}: NarratorProps) {
  const [isSupported, setIsSupported] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const queueRef = useRef<SpeechQueueItem[]>([]);
  const processedEventsRef = useRef<Set<number>>(new Set());
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Check browser compatibility
  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      console.warn('Web Speech API is not supported in this browser');
      setIsSupported(false);
    }
  }, []);

  // Process new events and add to queue
  useEffect(() => {
    if (!enabled || !isSupported) {
      return;
    }

    // Filter out already processed events
    const newEvents = events.filter(
      (event) => !processedEventsRef.current.has(event.timestamp)
    );

    // Add new events to queue
    newEvents.forEach((event) => {
      processedEventsRef.current.add(event.timestamp);
      
      queueRef.current.push({
        text: event.message,
        priority: event.priority,
        timestamp: event.timestamp,
      });
    });

    // Sort queue by priority (high -> medium -> low) and timestamp
    queueRef.current.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      
      return a.timestamp - b.timestamp;
    });

    // Start processing queue if not already speaking
    if (!isSpeaking && queueRef.current.length > 0) {
      processQueue();
    }
  }, [events, enabled, isSupported, isSpeaking]);

  // Process speech queue
  const processQueue = () => {
    if (!isSupported || !enabled) {
      return;
    }

    const nextItem = queueRef.current.shift();
    
    if (!nextItem) {
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(nextItem.text);
    currentUtteranceRef.current = utterance;

    // Configure voice settings
    if (voice) {
      utterance.voice = voice;
    }
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    // Handle utterance events
    utterance.onend = () => {
      currentUtteranceRef.current = null;
      
      // Process next item in queue
      if (queueRef.current.length > 0) {
        processQueue();
      } else {
        setIsSpeaking(false);
      }
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      currentUtteranceRef.current = null;
      
      // Continue with next item despite error
      if (queueRef.current.length > 0) {
        processQueue();
      } else {
        setIsSpeaking(false);
      }
    };

    // Speak the utterance
    try {
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Failed to speak utterance:', error);
      setIsSpeaking(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel any ongoing speech
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      
      // Clear queue
      queueRef.current = [];
      currentUtteranceRef.current = null;
    };
  }, []);

  // Pause/resume when enabled changes
  useEffect(() => {
    if (!isSupported) {
      return;
    }

    if (!enabled && isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [enabled, isSupported, isSpeaking]);

  // This is a headless component
  return null;
}

/**
 * Hook to get available voices
 * Voices may not be immediately available, so this hook
 * handles the async loading
 */
export function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      return;
    }

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    // Load voices immediately
    loadVoices();

    // Voices may load asynchronously
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  return voices;
}
