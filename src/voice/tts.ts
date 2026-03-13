/**
 * Helix Voice Pipeline — Text-to-Speech (ElevenLabs)
 *
 * Mode-aware TTS: Helix's voice should match its conversational mode.
 * - Active: warm, conversational pace
 * - Listening: brief acknowledgements ("mm", "I hear you")
 * - Synthesis: slower, more deliberate — weaving is careful work
 */

export interface TTSConfig {
  apiKey: string;
  /** ElevenLabs voice ID */
  voiceId: string;
  /** Model to use (default: 'eleven_multilingual_v2') */
  model?: string;
  /** Base URL override */
  baseUrl?: string;
}

export interface VoiceSettings {
  /** 0.0–1.0: higher = more consistent/stable voice */
  stability: number;
  /** 0.0–1.0: higher = closer to original voice */
  similarityBoost: number;
  /** 0.0–1.0: higher = more expressive */
  style: number;
}

/** Mode-aware voice presets */
const MODE_PRESETS: Record<string, VoiceSettings> = {
  active: { stability: 0.5, similarityBoost: 0.75, style: 0.3 },
  listening: { stability: 0.7, similarityBoost: 0.8, style: 0.1 },
  synthesis: { stability: 0.6, similarityBoost: 0.75, style: 0.4 },
};

const DEFAULT_BASE_URL = 'https://api.elevenlabs.io/v1';
const DEFAULT_MODEL = 'eleven_multilingual_v2';

export class ElevenLabsTTS {
  private config: Required<TTSConfig>;

  constructor(config: TTSConfig) {
    this.config = {
      model: DEFAULT_MODEL,
      baseUrl: DEFAULT_BASE_URL,
      ...config,
    };
  }

  /**
   * Convert text to speech audio.
   *
   * Returns the raw audio stream (mp3) for playback.
   * Use `mode` to automatically adjust voice parameters.
   */
  async speak(
    text: string,
    mode: 'active' | 'listening' | 'synthesis' = 'active',
  ): Promise<TTSResult> {
    const start = performance.now();
    const settings = MODE_PRESETS[mode];

    const response = await fetch(
      `${this.config.baseUrl}/text-to-speech/${this.config.voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: this.config.model,
          voice_settings: {
            stability: settings.stability,
            similarity_boost: settings.similarityBoost,
            style: settings.style,
          },
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new TTSError(
        `ElevenLabs API error (${response.status}): ${error}`,
        response.status,
      );
    }

    const processingMs = Math.round(performance.now() - start);

    return {
      audioStream: response.body!,
      contentType: response.headers.get('content-type') || 'audio/mpeg',
      processingMs,
      mode,
    };
  }

  /**
   * Convenience: speak and collect full audio buffer.
   * Use `speak()` with streaming for lower latency in production.
   */
  async speakToBuffer(
    text: string,
    mode: 'active' | 'listening' | 'synthesis' = 'active',
  ): Promise<{ audio: Buffer; contentType: string; processingMs: number }> {
    const result = await this.speak(text, mode);
    const reader = result.audioStream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const audio = Buffer.alloc(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      audio.set(chunk, offset);
      offset += chunk.length;
    }

    return { audio, contentType: result.contentType, processingMs: result.processingMs };
  }
}

export interface TTSResult {
  /** Readable stream of audio data (mp3) */
  audioStream: ReadableStream<Uint8Array>;
  contentType: string;
  processingMs: number;
  mode: string;
}

export class TTSError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'TTSError';
  }
}
