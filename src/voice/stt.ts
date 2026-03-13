/**
 * Helix Voice Pipeline — Speech-to-Text (Whisper)
 *
 * Wraps the OpenAI Whisper API for converting audio segments to text.
 * Designed for non-linear thinkers: no autocorrect, no grammar smoothing.
 * Whisper transcribes what's said — that's exactly right for Helix.
 */

export interface STTConfig {
  apiKey: string;
  /** Whisper model to use (default: 'whisper-1') */
  model?: string;
  /** Language hint — explicit is faster than auto-detect */
  language?: string;
  /** Base URL override (for local Whisper on Playground) */
  baseUrl?: string;
}

export interface STTResult {
  text: string;
  /** Duration of the audio segment in seconds */
  durationSeconds: number;
  /** Processing time in ms (for latency tracking) */
  processingMs: number;
}

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'whisper-1';
const DEFAULT_LANGUAGE = 'en';

export class WhisperSTT {
  private config: Required<STTConfig>;

  constructor(config: STTConfig) {
    this.config = {
      model: DEFAULT_MODEL,
      language: DEFAULT_LANGUAGE,
      baseUrl: DEFAULT_BASE_URL,
      ...config,
    };
  }

  /**
   * Transcribe an audio blob to text.
   *
   * Accepts any format Whisper supports: webm, mp3, wav, m4a, etc.
   * For browser capture, webm/opus is typical.
   */
  async transcribe(
    audioData: Blob | Buffer,
    filename: string = 'speech.webm',
  ): Promise<STTResult> {
    const start = performance.now();

    const formData = new FormData();

    if (audioData instanceof Blob) {
      formData.append('file', audioData, filename);
    } else {
      // Node.js Buffer — wrap as Blob via Uint8Array
      const blob = new Blob([new Uint8Array(audioData)]);
      formData.append('file', blob, filename);
    }

    formData.append('model', this.config.model);
    formData.append('language', this.config.language);
    formData.append('response_format', 'text');

    const response = await fetch(
      `${this.config.baseUrl}/audio/transcriptions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new STTError(
        `Whisper API error (${response.status}): ${error}`,
        response.status,
      );
    }

    const text = (await response.text()).trim();
    const processingMs = Math.round(performance.now() - start);

    return {
      text,
      durationSeconds: 0, // TODO: extract from audio metadata
      processingMs,
    };
  }
}

export class STTError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'STTError';
  }
}
