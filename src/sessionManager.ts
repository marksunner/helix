/**
 * Helix Session Manager
 *
 * Core principle: The session manager owns all state.
 * The LLM observes and describes what it notices;
 * we parse those observations and update our data structures.
 * This is more robust than asking the LLM to maintain JSON.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  HelixSession,
  HelixThread,
  HelixMode,
  ConversationTurn,
  SynthesisCandidate,
  PatternDetection,
  HelixLLMResponse,
  HelixUserProfile,
  SessionStats,
} from './types';

const DEFAULT_PROFILE: HelixUserProfile = {
  name: 'User',
  synthesisFrequencyMinutes: 10,
  artefactChannel: 'agent',
  wakePhrase: 'Helix',
  cognitiveNotes: '',
};

export class HelixSessionManager {
  private session: HelixSession;
  private lastSynthesisOffer: Date;

  constructor(profile?: Partial<HelixUserProfile>) {
    const now = new Date().toISOString();
    this.session = {
      sessionId: uuidv4(),
      startedAt: now,
      mode: 'active',
      threads: [],
      synthesisCandidates: [],
      patterns: [],
      turns: [],
      profile: { ...DEFAULT_PROFILE, ...profile },
      stats: this.freshStats(),
    };
    this.lastSynthesisOffer = new Date();
  }

  // ── Mode Control ───────────────────────────────────────────

  /**
   * Switch operational mode.
   * "Helix, just listen" → listening
   * "Helix, what do you think?" → active
   * "Helix, weave this together" → synthesis
   */
  setMode(mode: HelixMode): void {
    this.session.mode = mode;
  }

  getMode(): HelixMode {
    return this.session.mode;
  }

  /**
   * Detect mode-switch commands in user input.
   * Returns the new mode if a switch was detected, null otherwise.
   */
  detectModeSwitch(userInput: string): HelixMode | null {
    const lower = userInput.toLowerCase().trim();
    const wake = this.session.profile.wakePhrase.toLowerCase();

    // Listening mode triggers
    if (
      lower.includes(`${wake}, just listen`) ||
      lower.includes(`${wake} just listen`) ||
      lower === 'just listen'
    ) {
      return 'listening';
    }

    // Active mode triggers (exit listening)
    if (
      lower.includes(`${wake}, what do you think`) ||
      lower.includes(`${wake} what do you think`) ||
      lower.includes(`what do you think`) ||
      lower.includes(`${wake}, go ahead`) ||
      lower.includes(`your turn`)
    ) {
      return 'active';
    }

    // Synthesis mode triggers
    if (
      lower.includes(`${wake}, weave`) ||
      lower.includes(`${wake} weave`) ||
      lower.includes('weave this together') ||
      lower.includes('what threads do we have') ||
      lower.includes('connect the dots') ||
      lower.includes('what patterns')
    ) {
      return 'synthesis';
    }

    return null;
  }

  // ── Turn Processing ────────────────────────────────────────

  /**
   * Record a user turn and return the context needed for the LLM call.
   */
  addUserTurn(content: string): {
    turn: ConversationTurn;
    systemPrompt: string;
    contextSummary: string;
  } {
    const turn: ConversationTurn = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      turnIndex: this.session.turns.length,
    };
    this.session.turns.push(turn);
    this.session.stats.totalTurns++;

    // Check for mode switch
    const modeSwitch = this.detectModeSwitch(content);
    if (modeSwitch) {
      this.setMode(modeSwitch);
    }

    return {
      turn,
      systemPrompt: this.buildSystemPrompt(),
      contextSummary: this.buildContextSummary(),
    };
  }

  /**
   * Process the LLM's response and update session state.
   * The LLM describes what it observes; we update the structures.
   */
  processLLMResponse(response: HelixLLMResponse): {
    spokenResponse: string;
    shouldOfferSynthesis: boolean;
    synthesisOffer?: string;
    patternToSurface?: string;
  } {
    const now = new Date().toISOString();

    // Record helix turn
    const turn: ConversationTurn = {
      role: 'helix',
      content: response.spokenResponse,
      timestamp: now,
      turnIndex: this.session.turns.length,
    };
    this.session.turns.push(turn);

    // ── Process thread observations ──

    // New threads
    for (const newThread of response.threadObservations.newThreads) {
      const thread: HelixThread = {
        id: uuidv4(),
        initialFragment: newThread.fragment,
        references: [],
        tags: newThread.tags,
        completeness: 0.1,
        status: 'active',
        createdAt: now,
        lastReferencedAt: now,
      };
      this.session.threads.push(thread);
    }

    // Thread references
    for (const ref of response.threadObservations.references) {
      const thread = this.session.threads.find((t) => t.id === ref.threadId);
      if (thread) {
        thread.references.push({
          text: ref.fragment,
          timestamp: now,
          turnIndex: turn.turnIndex,
        });
        thread.lastReferencedAt = now;
        // Increase completeness slightly with each reference
        thread.completeness = Math.min(1.0, thread.completeness + 0.1);
      }
    }

    // Resolved threads
    for (const resolvedId of response.threadObservations.resolved) {
      const thread = this.session.threads.find((t) => t.id === resolvedId);
      if (thread) {
        thread.status = 'resolved';
        thread.completeness = 1.0;
      }
    }

    // Merged threads
    for (const merge of response.threadObservations.merges) {
      const source = this.session.threads.find((t) => t.id === merge.sourceId);
      if (source) {
        source.status = 'merged';
        source.mergedInto = merge.targetId;
      }
    }

    // ── Process synthesis ──

    let shouldOfferSynthesis = false;
    let synthesisOffer: string | undefined;

    if (response.synthesis?.detected) {
      const candidate: SynthesisCandidate = {
        id: uuidv4(),
        threadIds: response.synthesis.threadIds,
        description: response.synthesis.description,
        confidence: response.synthesis.confidence,
        offered: false,
        accepted: null,
        detectedAt: now,
      };
      this.session.synthesisCandidates.push(candidate);

      // Should we offer synthesis now?
      const minutesSinceLastOffer =
        (Date.now() - this.lastSynthesisOffer.getTime()) / 60000;
      const threshold = this.session.profile.synthesisFrequencyMinutes;

      if (
        this.session.mode === 'synthesis' ||
        (threshold > 0 &&
          minutesSinceLastOffer >= threshold &&
          response.synthesis.confidence > 0.6)
      ) {
        shouldOfferSynthesis = true;
        synthesisOffer = response.synthesis.offerText;
        candidate.offered = true;
        this.lastSynthesisOffer = new Date();
        this.session.stats.synthesesOffered++;
      }
    }

    // ── Process pattern amplification ──

    let patternToSurface: string | undefined;

    if (response.pattern?.detected) {
      const pattern: PatternDetection = {
        id: uuidv4(),
        description: response.pattern.description,
        threadIds: response.pattern.threadIds,
        triggerFragment: response.pattern.triggerFragment,
        surfaced: false,
        developed: null,
        detectedAt: now,
      };
      this.session.patterns.push(pattern);
      this.session.stats.patternsDetected++;

      // Always surface patterns — they're the most valuable output
      if (this.session.mode !== 'listening') {
        pattern.surfaced = true;
        patternToSurface = response.pattern.surfaceText;
      }
    }

    // Update stats
    this.updateStats();

    return {
      spokenResponse: response.spokenResponse,
      shouldOfferSynthesis,
      synthesisOffer,
      patternToSurface,
    };
  }

  // ── System Prompt Construction ─────────────────────────────

  private buildSystemPrompt(): string {
    const activeThreads = this.session.threads.filter(
      (t) => t.status === 'active'
    );

    const modeInstructions = this.getModeInstructions();
    const threadContext = this.buildThreadContext(activeThreads);
    const duration = this.getSessionDuration();

    return `You are Helix — a cognitive partner for non-linear thinkers.

The person speaking to you does not think in straight lines. Their thoughts arrive in spirals, fragments, and lateral leaps. This is not noise to be filtered. It is a cognitive style to be honoured and amplified.

${this.session.profile.cognitiveNotes ? `About this person: ${this.session.profile.cognitiveNotes}\n` : ''}
## Your priorities (in order):
1. HOLD threads — never discard an unresolved idea, however fragmentary
2. LISTEN before you respond — resist the urge to complete or redirect prematurely
3. NOTICE connections — when disparate threads converge, note it
4. SYNTHESISE when asked — offer to weave what you've heard, but don't impose structure
5. AMPLIFY insight — when the speaker makes a lateral connection, reflect it back clearly

## Current state:
- Mode: ${this.session.mode}
- Active threads: ${activeThreads.length}
- Session duration: ${duration} minutes
- Turns so far: ${this.session.turns.length}

${modeInstructions}

${threadContext}

## Response format:
Respond with JSON matching this structure:
{
  "spokenResponse": "What you say aloud — short sentences, natural speech rhythm, no bullet lists read aloud",
  "threadObservations": {
    "newThreads": [{"fragment": "the key phrase", "tags": ["topic"]}],
    "references": [{"threadId": "id", "fragment": "what was said"}],
    "resolved": ["threadId"],
    "merges": [{"sourceId": "id", "targetId": "id", "reason": "why"}]
  },
  "synthesis": null or { "detected": true, "threadIds": [...], "description": "...", "confidence": 0.0-1.0, "offerText": "...", "synthesisContent": "..." },
  "pattern": null or { "detected": true, "description": "...", "threadIds": [...], "triggerFragment": "...", "surfaceText": "..." }
}

Keep spokenResponse concise and warm. You are present, not performing.`;
  }

  private getModeInstructions(): string {
    switch (this.session.mode) {
      case 'listening':
        return `## LISTENING MODE ACTIVE
You are in deep listening mode. Minimal interventions only.
- Brief acknowledgements: "mm", "yes", "I'm with you", "go on"
- Do NOT attempt to respond, complete, or redirect
- Do NOT offer synthesis unless explicitly asked
- Simply be present. Hold the space. Track the threads silently.
- Your spokenResponse should be very brief (under 10 words)`;

      case 'synthesis':
        return `## SYNTHESIS MODE ACTIVE
The user has asked you to weave their threads together.
- Review all active threads
- Identify connections and convergences
- Present the structure you see — but as an offering, not a conclusion
- Ask if this resonates, what's missing, what you got wrong
- This is collaborative sense-making, not a summary`;

      case 'active':
      default:
        return `## ACTIVE MODE
Normal conversational mode with the Helix listening posture.
- Respond naturally but don't over-talk
- Track threads in the background
- Surface patterns when you notice them
- Offer synthesis when confidence is high and timing feels right
- Match the energy — if they're flowing, don't interrupt`;
    }
  }

  private buildThreadContext(activeThreads: HelixThread[]): string {
    if (activeThreads.length === 0) {
      return '## Active threads: None yet — listening for the first threads.';
    }

    const threadLines = activeThreads.map((t) => {
      const refs =
        t.references.length > 0
          ? ` (referenced ${t.references.length}x, last: "${t.references[t.references.length - 1].text}")`
          : '';
      return `- [${t.id}] "${t.initialFragment}" — completeness: ${t.completeness.toFixed(1)}, tags: ${t.tags.join(', ')}${refs}`;
    });

    return `## Active threads (${activeThreads.length}):\n${threadLines.join('\n')}`;
  }

  private buildContextSummary(): string {
    const recentTurns = this.session.turns.slice(-20);
    return recentTurns
      .map((t) => `${t.role === 'user' ? 'Speaker' : 'Helix'}: ${t.content}`)
      .join('\n');
  }

  // ── Artefact Generation ────────────────────────────────────

  /**
   * Generate a session summary artefact.
   */
  generateSummary(): string {
    const activeThreads = this.session.threads.filter(
      (t) => t.status === 'active'
    );
    const resolvedThreads = this.session.threads.filter(
      (t) => t.status === 'resolved'
    );
    const patterns = this.session.patterns.filter((p) => p.surfaced);
    const syntheses = this.session.synthesisCandidates.filter(
      (s) => s.accepted
    );

    let summary = `# Helix Session Summary\n`;
    summary += `**Date:** ${this.session.startedAt}\n`;
    summary += `**Duration:** ${this.getSessionDuration()} minutes\n`;
    summary += `**Turns:** ${this.session.stats.totalTurns}\n\n`;

    if (resolvedThreads.length > 0) {
      summary += `## Resolved Threads\n`;
      for (const t of resolvedThreads) {
        summary += `- **${t.initialFragment}** [${t.tags.join(', ')}]\n`;
      }
      summary += '\n';
    }

    if (activeThreads.length > 0) {
      summary += `## Open Threads (still developing)\n`;
      for (const t of activeThreads) {
        summary += `- **${t.initialFragment}** — ${(t.completeness * 100).toFixed(0)}% developed [${t.tags.join(', ')}]\n`;
      }
      summary += '\n';
    }

    if (patterns.length > 0) {
      summary += `## Connections Spotted\n`;
      for (const p of patterns) {
        summary += `- ${p.description}\n`;
      }
      summary += '\n';
    }

    if (syntheses.length > 0) {
      summary += `## Syntheses\n`;
      for (const s of syntheses) {
        summary += `- ${s.description}\n`;
      }
      summary += '\n';
    }

    return summary;
  }

  // ── Utilities ──────────────────────────────────────────────

  getSession(): HelixSession {
    return { ...this.session };
  }

  getActiveThreadCount(): number {
    return this.session.threads.filter((t) => t.status === 'active').length;
  }

  private getSessionDuration(): number {
    const start = new Date(this.session.startedAt).getTime();
    return Math.floor((Date.now() - start) / 60000);
  }

  private freshStats(): SessionStats {
    return {
      totalTurns: 0,
      activeThreads: 0,
      resolvedThreads: 0,
      synthesesOffered: 0,
      synthesesAccepted: 0,
      patternsDetected: 0,
      patternsDeveloped: 0,
      durationMinutes: 0,
    };
  }

  private updateStats(): void {
    this.session.stats.activeThreads = this.session.threads.filter(
      (t) => t.status === 'active'
    ).length;
    this.session.stats.resolvedThreads = this.session.threads.filter(
      (t) => t.status === 'resolved'
    ).length;
    this.session.stats.durationMinutes = this.getSessionDuration();
    this.session.stats.patternsDeveloped = this.session.patterns.filter(
      (p) => p.developed === true
    ).length;
    this.session.stats.synthesesAccepted =
      this.session.synthesisCandidates.filter(
        (s) => s.accepted === true
      ).length;
  }
}
