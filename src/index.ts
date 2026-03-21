/**
 * Helix — Non-Linear Cognition Interface
 *
 * Entry point for the Helix session manager.
 * This module provides the public API for integrating Helix
 * into an OpenClaw skill or standalone application.
 */

export { HelixSessionManager } from './sessionManager';
export { generateArtefact } from './artefacts';
export type { ArtefactOptions, ArtefactJSON } from './artefacts';
export {
  HelixSession,
  HelixThread,
  HelixMode,
  HelixUserProfile,
  HelixLLMResponse,
  ConversationTurn,
  SynthesisCandidate,
  PatternDetection,
  SessionStats,
} from './types';

/**
 * Quick start:
 *
 * ```typescript
 * import { HelixSessionManager } from 'helix';
 *
 * const helix = new HelixSessionManager({
 *   name: 'Mark',
 *   cognitiveNotes: 'Non-linear thinker. Pattern recognition feels like synaesthesia.',
 *   synthesisFrequencyMinutes: 10,
 * });
 *
 * // User speaks
 * const { systemPrompt, contextSummary } = helix.addUserTurn(userSpeech);
 *
 * // Send to LLM with systemPrompt + contextSummary + userSpeech
 * const llmResponse = await callLLM(systemPrompt, contextSummary, userSpeech);
 *
 * // Process response — session manager updates its own state
 * const { spokenResponse, patternToSurface } = helix.processLLMResponse(llmResponse);
 *
 * // Send spokenResponse to TTS
 * // If patternToSurface, append it after the main response
 * ```
 */
