import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { MetricsSnapshot } from '../types';

interface SymphonyProps {
  metrics: MetricsSnapshot | null;
  enabled?: boolean;
  volume?: number;
  enableRecording?: boolean;
  onRecordingComplete?: (audioBlob: Blob) => void;
}

/**
 * Symphony Component - Translates code metrics into music
 * 
 * Musical Mapping Strategy:
 * - Complexity → Tempo (high complexity = faster tempo)
 * - Test Coverage → Harmony (high coverage = consonant chords)
 * - Vulnerabilities → Dissonance (more vulns = more tension)
 * - Progress → Key modulation (dead code = minor, resurrected = major)
 */
export function Symphony({ 
  metrics, 
  enabled = true, 
  volume = 0.5,
  enableRecording = false,
  onRecordingComplete
}: SymphonyProps) {
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const bassRef = useRef<Tone.Synth | null>(null);
  const recorderRef = useRef<Tone.Recorder | null>(null);
  const isInitializedRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);

  // Initialize Tone.js synthesizers
  useEffect(() => {
    if (!enabled || isInitializedRef.current) return;

    const initAudio = async () => {
      try {
        // Create recorder if recording is enabled
        if (enableRecording) {
          recorderRef.current = new Tone.Recorder();
        }

        // Create polyphonic synthesizer for chords
        synthRef.current = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' },
          envelope: {
            attack: 0.5,
            decay: 0.3,
            sustain: 0.4,
            release: 1.0,
          },
        });

        // Create bass synthesizer
        bassRef.current = new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: {
            attack: 0.1,
            decay: 0.2,
            sustain: 0.5,
            release: 0.8,
          },
        });

        // Connect to recorder if enabled, otherwise to destination
        if (enableRecording && recorderRef.current) {
          synthRef.current.connect(recorderRef.current);
          bassRef.current.connect(recorderRef.current);
          recorderRef.current.toDestination();
        } else {
          synthRef.current.toDestination();
          bassRef.current.toDestination();
        }

        // Set volume
        if (synthRef.current) {
          synthRef.current.volume.value = Tone.gainToDb(volume);
        }
        if (bassRef.current) {
          bassRef.current.volume.value = Tone.gainToDb(volume * 0.7);
        }

        isInitializedRef.current = true;
      } catch (error) {
        console.error('Failed to initialize Tone.js:', error);
      }
    };

    initAudio();

    return () => {
      // Cleanup
      if (synthRef.current) {
        synthRef.current.dispose();
        synthRef.current = null;
      }
      if (bassRef.current) {
        bassRef.current.dispose();
        bassRef.current = null;
      }
      if (recorderRef.current) {
        recorderRef.current.dispose();
        recorderRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, [enabled, volume, enableRecording]);

  // Start recording when enabled
  useEffect(() => {
    if (!enableRecording || !recorderRef.current || isRecording) return;

    const startRecording = async () => {
      try {
        if (Tone.context.state !== 'running') {
          await Tone.start();
        }
        
        await recorderRef.current?.start();
        setIsRecording(true);
        console.log('Recording started');
      } catch (error) {
        console.error('Failed to start recording:', error);
      }
    };

    startRecording();
  }, [enableRecording, isRecording]);

  // Stop recording when resurrection completes (progress = 1)
  useEffect(() => {
    if (!enableRecording || !isRecording || !recorderRef.current) return;
    if (!metrics || metrics.progress < 1) return;

    const stopRecording = async () => {
      try {
        const recording = await recorderRef.current?.stop();
        setIsRecording(false);
        
        if (recording && onRecordingComplete) {
          onRecordingComplete(recording);
          console.log('Recording complete');
        }
      } catch (error) {
        console.error('Failed to stop recording:', error);
      }
    };

    // Add a small delay to capture the final notes
    const timer = setTimeout(stopRecording, 2000);
    return () => clearTimeout(timer);
  }, [enableRecording, isRecording, metrics, onRecordingComplete]);

  // Play music based on metrics
  useEffect(() => {
    if (!enabled || !metrics || !synthRef.current || !bassRef.current) return;

    const playMusic = async () => {
      try {
        // Start Tone.js audio context (required for user interaction)
        if (Tone.context.state !== 'running') {
          await Tone.start();
        }

        // Map metrics to musical parameters
        const tempo = mapComplexityToTempo(metrics.complexity);
        const chord = mapCoverageToChord(metrics.coverage, metrics.progress);
        const bassNote = mapProgressToBassNote(metrics.progress);

        // Update tempo
        Tone.Transport.bpm.value = tempo;

        // Play chord (harmony based on coverage)
        if (synthRef.current) {
          synthRef.current.triggerAttackRelease(chord, '2n');
        }

        // Play bass note (foundation based on progress)
        if (bassRef.current) {
          bassRef.current.triggerAttackRelease(bassNote, '1n');
        }
      } catch (error) {
        console.error('Failed to play music:', error);
      }
    };

    playMusic();
  }, [metrics, enabled]);

  return null; // Headless component
}

/**
 * Map code complexity to tempo
 * Higher complexity = faster, more chaotic tempo
 * Lower complexity = slower, more controlled tempo
 */
function mapComplexityToTempo(complexity: number): number {
  // Normalize complexity (assume range 0-100)
  const normalized = Math.min(Math.max(complexity, 0), 100) / 100;
  
  // Map to tempo range: 60 BPM (calm) to 180 BPM (chaotic)
  const minTempo = 60;
  const maxTempo = 180;
  
  return minTempo + normalized * (maxTempo - minTempo);
}

/**
 * Map test coverage to chord harmony
 * High coverage = consonant, pleasant chords
 * Low coverage = dissonant, tense chords
 */
function mapCoverageToChord(coverage: number, progress: number): string[] {
  // Normalize coverage (0-1 range)
  const normalized = Math.min(Math.max(coverage, 0), 1);
  
  // Determine key based on progress
  const isMajor = progress > 0.5;
  
  if (normalized > 0.8) {
    // High coverage: Perfect consonance (major/minor triad)
    return isMajor ? ['C4', 'E4', 'G4'] : ['C4', 'Eb4', 'G4'];
  } else if (normalized > 0.6) {
    // Good coverage: Seventh chord (slightly more complex)
    return isMajor ? ['C4', 'E4', 'G4', 'B4'] : ['C4', 'Eb4', 'G4', 'Bb4'];
  } else if (normalized > 0.4) {
    // Medium coverage: Suspended chord (ambiguous)
    return ['C4', 'F4', 'G4'];
  } else if (normalized > 0.2) {
    // Low coverage: Diminished chord (tense)
    return ['C4', 'Eb4', 'Gb4'];
  } else {
    // Very low coverage: Augmented chord (very tense)
    return ['C4', 'E4', 'G#4'];
  }
}

/**
 * Map progress to bass note
 * Progress determines the root note and key
 */
function mapProgressToBassNote(progress: number): string {
  // Normalize progress (0-1 range)
  const normalized = Math.min(Math.max(progress, 0), 1);
  
  // Map to chromatic scale progression (C to C, one octave)
  const notes = ['C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2', 'C3'];
  const index = Math.floor(normalized * (notes.length - 1));
  
  return notes[index];
}


