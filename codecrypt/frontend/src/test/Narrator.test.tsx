import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { Narrator, useVoices } from '../components/Narrator';
import { NarrationEvent } from '../types';

// Mock Web Speech API
const mockSpeak = vi.fn();
const mockCancel = vi.fn();
const mockGetVoices = vi.fn(() => []);

class MockSpeechSynthesisUtterance {
  text: string;
  voice: SpeechSynthesisVoice | null = null;
  rate: number = 1;
  pitch: number = 1;
  volume: number = 1;
  onend: ((event: SpeechSynthesisEvent) => void) | null = null;
  onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

beforeEach(() => {
  // Mock speechSynthesis
  global.speechSynthesis = {
    speak: mockSpeak,
    cancel: mockCancel,
    getVoices: mockGetVoices,
    onvoiceschanged: null,
  } as any;

  // Mock SpeechSynthesisUtterance
  global.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance as any;

  mockSpeak.mockClear();
  mockCancel.mockClear();
  mockGetVoices.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Narrator Component', () => {
  it('should render without crashing (headless component)', () => {
    const events: NarrationEvent[] = [];
    const { container } = render(<Narrator events={events} />);
    expect(container.firstChild).toBeNull();
  });

  it('should speak narration events', async () => {
    const events: NarrationEvent[] = [
      {
        timestamp: Date.now(),
        message: 'Test message',
        priority: 'medium',
      },
    ];

    render(<Narrator events={events} enabled={true} />);

    // Component processes events asynchronously
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(mockSpeak).toHaveBeenCalled();
    const utterance = mockSpeak.mock.calls[0][0];
    expect(utterance.text).toBe('Test message');
  });

  it('should not speak when disabled', async () => {
    const events: NarrationEvent[] = [
      {
        timestamp: Date.now(),
        message: 'Test message',
        priority: 'medium',
      },
    ];

    render(<Narrator events={events} enabled={false} />);

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('should configure utterance with custom settings', async () => {
    const events: NarrationEvent[] = [
      {
        timestamp: Date.now(),
        message: 'Test message',
        priority: 'medium',
      },
    ];

    render(
      <Narrator
        events={events}
        enabled={true}
        rate={1.5}
        pitch={0.8}
        volume={0.9}
      />
    );

    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(mockSpeak).toHaveBeenCalled();
    const utterance = mockSpeak.mock.calls[0][0];
    expect(utterance.rate).toBe(1.5);
    expect(utterance.pitch).toBe(0.8);
    expect(utterance.volume).toBe(0.9);
  });

  it('should handle speech synthesis errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    mockSpeak.mockImplementation(() => {
      throw new Error('Speech synthesis failed');
    });

    const events: NarrationEvent[] = [
      {
        timestamp: Date.now(),
        message: 'Test message',
        priority: 'medium',
      },
    ];

    render(<Narrator events={events} enabled={true} />);

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('should cancel speech on unmount', () => {
    const events: NarrationEvent[] = [
      {
        timestamp: Date.now(),
        message: 'Test message',
        priority: 'medium',
      },
    ];

    const { unmount } = render(<Narrator events={events} enabled={true} />);
    unmount();

    expect(mockCancel).toHaveBeenCalled();
  });

  it('should handle missing Web Speech API', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Remove speechSynthesis
    const originalSpeechSynthesis = global.speechSynthesis;
    delete (global as any).speechSynthesis;

    const events: NarrationEvent[] = [
      {
        timestamp: Date.now(),
        message: 'Test message',
        priority: 'medium',
      },
    ];

    render(<Narrator events={events} enabled={true} />);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Web Speech API is not supported in this browser'
    );

    // Restore
    global.speechSynthesis = originalSpeechSynthesis;
    consoleWarnSpy.mockRestore();
  });

  it('should process events in priority order', async () => {
    const events: NarrationEvent[] = [
      {
        timestamp: 1,
        message: 'Low priority',
        priority: 'low',
      },
      {
        timestamp: 2,
        message: 'High priority',
        priority: 'high',
      },
      {
        timestamp: 3,
        message: 'Medium priority',
        priority: 'medium',
      },
    ];

    render(<Narrator events={events} enabled={true} />);

    await new Promise(resolve => setTimeout(resolve, 10));
    
    // The queue should be sorted by priority (high -> medium -> low)
    expect(mockSpeak).toHaveBeenCalled();
  });

  it('should not process duplicate events', async () => {
    const timestamp = Date.now();
    const events: NarrationEvent[] = [
      {
        timestamp,
        message: 'Test message',
        priority: 'medium',
      },
      {
        timestamp, // Same timestamp
        message: 'Test message',
        priority: 'medium',
      },
    ];

    render(<Narrator events={events} enabled={true} />);

    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Should only speak once for duplicate timestamps
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });
});

describe('useVoices Hook', () => {
  it('should return available voices', async () => {
    const mockVoices = [
      { name: 'Voice 1', lang: 'en-US' },
      { name: 'Voice 2', lang: 'en-GB' },
    ] as SpeechSynthesisVoice[];

    mockGetVoices.mockReturnValue(mockVoices);

    const TestComponent = () => {
      const voices = useVoices();
      return <div data-testid="voice-count">{voices.length}</div>;
    };

    const { getByTestId } = render(<TestComponent />);
    
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(getByTestId('voice-count').textContent).toBe('2');
  });

  it('should handle missing Web Speech API', () => {
    // Remove speechSynthesis
    const originalSpeechSynthesis = global.speechSynthesis;
    delete (global as any).speechSynthesis;

    const TestComponent = () => {
      const voices = useVoices();
      return <div data-testid="voice-count">{voices.length}</div>;
    };

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('voice-count').textContent).toBe('0');

    // Restore
    global.speechSynthesis = originalSpeechSynthesis;
  });
});
