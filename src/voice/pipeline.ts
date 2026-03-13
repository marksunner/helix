/**
 * Helix Voice Pipeline — Orchestrator
 *
 * Coordinates the full voice loop:
 *   Mic → STT → Session Manager → LLM → TTS → Speaker
 *
 * This is the glue between audio I/O and Helix's cognitive engine.
 * The session manager does the hard work; this is plumbing.
 */

import { WhisperSTT, type STTResult } from './stt.js';
import { ElevenLabsTTS, type TTSResult } from './tts.js';
import { HelixSessionManager } from '../sessionManager.js';
import type { HelixLLMResponse, HelixMode } from '../types.js';

export interface PipelineConfig {
  stt: WhisperSTT;
  tts: ElevenLabsTTS;
  sessionManager: HelixSessionManager;
  /** Function that sends a prompt to the LLM and gets back a HelixLLMResponse */
  callLLM: (systemPrompt: string, context: string) => Promise<HelixLLMResponse>;
  /** Callback to play audio (implementation depends on environment) */
  playAudio: (stream: ReadableStream<Uint8Array>, contentType: string) => Promise<void>;
}

export interface TurnResult {
  /** What the user said */
  userText: string;
  /** What Helix said back */
  helixResponse: string;
  /** Current mode after this turn */
  mode: HelixMode;
  /** Total latency for the full turn (STT → LLM → TTS) */
  totalMs: number;
  /** Breakdown of latency per stage */
  latency: {
    sttMs: number;
    sessionMs: number;
    llmMs: number;
    ttsMs: number;
  };
  /** Whether synthesis was offered */
  synthesisOffered: boolean;
  /** Whether a pattern was surfaced */
  patternSurfaced: boolean;
}

export class VoicePipeline {
  private config: PipelineConfig;
  private processing = false;

  constructor(config: PipelineConfig) {
    this.config = config;
  }

  /**
   * Process a single voice turn.
   *
   * Takes raw audio, runs it through the full pipeline,
   * and speaks the response. Returns detailed metrics.
   */
  async processTurn(audioData: Blob | Buffer): Promise<TurnResult> {
    if (this.processing) {
      throw new PipelineError('Already processing a turn — wait for completion');
    }

    this.processing = true;
    const turnStart = performance.now();

    try {
      // 1. Speech-to-Text
      const stt = await this.config.stt.transcribe(audioData);

      // 2. Feed into session manager
      const sessionStart = performance.now();
      const { systemPrompt, contextSummary } =
        this.config.sessionManager.addUserTurn(stt.text);
      const sessionMs = Math.round(performance.now() - sessionStart);

      // 3. Call LLM
      const llmStart = performance.now();
      const llmResponse = await this.config.callLLM(systemPrompt, contextSummary);
      const llmMs = Math.round(performance.now() - llmStart);

      // 4. Process LLM response through session manager
      const result = this.config.sessionManager.processLLMResponse(llmResponse);

      // 5. Speak the main response
      const currentMode = this.config.sessionManager.getMode();
      const tts = await this.config.tts.speak(
        llmResponse.spokenResponse,
        currentMode,
      );
      await this.config.playAudio(tts.audioStream, tts.contentType);

      // 6. If synthesis was offered, speak that too
      if (
        llmResponse.synthesis?.detected &&
        llmResponse.synthesis.offerText
      ) {
        const synthTts = await this.config.tts.speak(
          llmResponse.synthesis.offerText,
          'synthesis',
        );
        await this.config.playAudio(synthTts.audioStream, synthTts.contentType);
      }

      // 7. If pattern detected, surface it
      if (llmResponse.pattern?.detected && llmResponse.pattern.surfaceText) {
        const patternTts = await this.config.tts.speak(
          llmResponse.pattern.surfaceText,
          'active',
        );
        await this.config.playAudio(patternTts.audioStream, patternTts.contentType);
      }

      const totalMs = Math.round(performance.now() - turnStart);

      return {
        userText: stt.text,
        helixResponse: llmResponse.spokenResponse,
        mode: currentMode,
        totalMs,
        latency: {
          sttMs: stt.processingMs,
          sessionMs,
          llmMs,
          ttsMs: tts.processingMs,
        },
        synthesisOffered: !!llmResponse.synthesis?.detected,
        patternSurfaced: !!llmResponse.pattern?.detected,
      };
    } finally {
      this.processing = false;
    }
  }

  get isProcessing(): boolean {
    return this.processing;
  }
}

export class PipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PipelineError';
  }
}
