/**
 * Helix Server — Express routes for the voice pipeline
 *
 * Exposes REST endpoints for:
 *   POST /api/turn       — Process a voice turn (audio in → audio + metadata out)
 *   POST /api/text-turn  — Process a text turn (text in → text + metadata out)
 *   GET  /api/session     — Get current session state
 *   POST /api/session/reset — Reset the session
 *   GET  /api/health      — Health check
 *
 * Phase 2, Step 2: Wire the voice pipeline to HTTP.
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { HelixSessionManager } from '../sessionManager.js';
import { WhisperSTT } from '../voice/stt.js';
import { ElevenLabsTTS } from '../voice/tts.js';
import type { HelixLLMResponse, HelixUserProfile } from '../types.js';

// ── Config ─────────────────────────────────────────────────────

export interface ServerConfig {
  port: number;
  /** OpenAI API key for Whisper STT */
  openaiApiKey: string;
  /** ElevenLabs API key for TTS */
  elevenLabsApiKey: string;
  /** ElevenLabs voice ID */
  elevenLabsVoiceId: string;
  /** Function that calls the LLM — injected so server doesn't own LLM choice */
  callLLM: (systemPrompt: string, context: string) => Promise<HelixLLMResponse>;
  /** Optional user profile overrides */
  userProfile?: Partial<HelixUserProfile>;
  /** Optional: Whisper base URL (for local Whisper) */
  whisperBaseUrl?: string;
}

// ── Server ─────────────────────────────────────────────────────

export function createHelixServer(config: ServerConfig): express.Application {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Shared instances
  let sessionManager = new HelixSessionManager(config.userProfile);
  const stt = new WhisperSTT({
    apiKey: config.openaiApiKey,
    baseUrl: config.whisperBaseUrl,
  });
  const tts = new ElevenLabsTTS({
    apiKey: config.elevenLabsApiKey,
    voiceId: config.elevenLabsVoiceId,
  });

  // ── POST /api/turn — Full voice turn ───────────────────────

  app.post('/api/turn', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { audio, filename } = req.body as {
        audio: string;       // base64-encoded audio
        filename?: string;   // e.g. 'speech.webm'
      };

      if (!audio) {
        res.status(400).json({ error: 'Missing "audio" field (base64-encoded)' });
        return;
      }

      const audioBuffer = Buffer.from(audio, 'base64');
      const turnStart = performance.now();

      // 1. STT
      const sttResult = await stt.transcribe(audioBuffer, filename);

      // 2. Session manager processes input
      const sessionStart = performance.now();
      const { systemPrompt, contextSummary } =
        sessionManager.addUserTurn(sttResult.text);
      const sessionMs = Math.round(performance.now() - sessionStart);

      // 3. LLM
      const llmStart = performance.now();
      const llmResponse = await config.callLLM(systemPrompt, contextSummary);
      const llmMs = Math.round(performance.now() - llmStart);

      // 4. Process response through session manager
      sessionManager.processLLMResponse(llmResponse);

      // 5. TTS — spoken response
      const currentMode = sessionManager.getMode();
      const ttsResult = await tts.speakToBuffer(
        llmResponse.spokenResponse,
        currentMode,
      );

      const totalMs = Math.round(performance.now() - turnStart);

      res.json({
        userText: sttResult.text,
        helixResponse: llmResponse.spokenResponse,
        audio: ttsResult.audio.toString('base64'),
        audioContentType: ttsResult.contentType,
        mode: currentMode,
        totalMs,
        latency: {
          sttMs: sttResult.processingMs,
          sessionMs,
          llmMs,
          ttsMs: ttsResult.processingMs,
        },
        synthesisOffered: !!llmResponse.synthesis?.detected,
        patternSurfaced: !!llmResponse.pattern?.detected,
        synthesis: llmResponse.synthesis?.detected
          ? { text: llmResponse.synthesis.offerText }
          : undefined,
        pattern: llmResponse.pattern?.detected
          ? { text: llmResponse.pattern.surfaceText }
          : undefined,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── POST /api/text-turn — Text-only turn (no audio) ───────

  app.post('/api/text-turn', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { text } = req.body as { text: string };

      if (!text) {
        res.status(400).json({ error: 'Missing "text" field' });
        return;
      }

      const turnStart = performance.now();

      // 1. Session manager processes input
      const sessionStart = performance.now();
      const { systemPrompt, contextSummary } =
        sessionManager.addUserTurn(text);
      const sessionMs = Math.round(performance.now() - sessionStart);

      // 2. LLM
      const llmStart = performance.now();
      const llmResponse = await config.callLLM(systemPrompt, contextSummary);
      const llmMs = Math.round(performance.now() - llmStart);

      // 3. Process response
      sessionManager.processLLMResponse(llmResponse);

      const currentMode = sessionManager.getMode();
      const totalMs = Math.round(performance.now() - turnStart);

      res.json({
        userText: text,
        helixResponse: llmResponse.spokenResponse,
        mode: currentMode,
        totalMs,
        latency: { sessionMs, llmMs },
        synthesisOffered: !!llmResponse.synthesis?.detected,
        patternSurfaced: !!llmResponse.pattern?.detected,
        synthesis: llmResponse.synthesis?.detected
          ? { text: llmResponse.synthesis.offerText }
          : undefined,
        pattern: llmResponse.pattern?.detected
          ? { text: llmResponse.pattern.surfaceText }
          : undefined,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /api/session — Current session state ───────────────

  app.get('/api/session', (_req: Request, res: Response) => {
    const session = sessionManager.getSession();

    res.json({
      sessionId: session.sessionId,
      mode: session.mode,
      stats: session.stats,
      threads: session.threads,
      synthesisCandidates: session.synthesisCandidates,
      patterns: session.patterns,
      turnCount: session.turns.length,
    });
  });

  // ── POST /api/session/reset — Start fresh ─────────────────

  app.post('/api/session/reset', (_req: Request, res: Response) => {
    sessionManager = new HelixSessionManager(config.userProfile);
    const session = sessionManager.getSession();
    res.json({ status: 'reset', newSessionId: session.sessionId });
  });

  // ── GET /api/health ────────────────────────────────────────

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version: '0.1.0',
      uptime: process.uptime(),
    });
  });

  // ── Error handler ──────────────────────────────────────────

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Helix Server Error]', err.message);
    res.status(500).json({
      error: err.message,
      type: err.constructor.name,
    });
  });

  return app;
}

// ── Standalone launcher ──────────────────────────────────────

export function startServer(config: ServerConfig): void {
  const app = createHelixServer(config);
  app.listen(config.port, () => {
    console.log(`🧬 Helix server listening on port ${config.port}`);
    console.log(`   Health: http://localhost:${config.port}/api/health`);
    console.log(`   Session: http://localhost:${config.port}/api/session`);
  });
}
