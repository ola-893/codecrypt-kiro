/**
 * Utility functions for exporting Resurrection Symphony audio
 */

/**
 * Download audio blob as a file
 */
export function downloadAudio(blob: Blob, filename: string = 'resurrection-symphony.webm'): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert audio blob to base64 for embedding in reports
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Create an HTML audio player element for the recording
 */
export function createAudioPlayer(blob: Blob): HTMLAudioElement {
  const url = URL.createObjectURL(blob);
  const audio = document.createElement('audio');
  audio.src = url;
  audio.controls = true;
  audio.style.width = '100%';
  return audio;
}

/**
 * Generate markdown for embedding audio in reports
 */
export function generateAudioMarkdown(audioUrl: string): string {
  return `
## Resurrection Symphony

Listen to the musical representation of the code resurrection process:

<audio controls>
  <source src="${audioUrl}" type="audio/webm">
  Your browser does not support the audio element.
</audio>

[Download Symphony](${audioUrl})
`;
}
