/**
 * Helix Session Manager — Unit Tests
 *
 * Phase 2 roadmap item: "Unit tests for thread tracking,
 * synthesis timing, and mode switching"
 *
 * Uses Node's built-in test runner (node --test).
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { HelixSessionManager } from './sessionManager';
import type { HelixLLMResponse, HelixMode } from './types';

// ── Helpers ─────────────────────────────────────────────────

/** Build a minimal valid LLM response */
function makeLLMResponse(overrides?: Partial<HelixLLMResponse>): HelixLLMResponse {
  return {
    spokenResponse: overrides?.spokenResponse ?? 'I hear you.',
    threadObservations: overrides?.threadObservations ?? {
      newThreads: [],
      references: [],
      resolved: [],
      merges: [],
    },
    synthesis: overrides?.synthesis ?? null,
    pattern: overrides?.pattern ?? null,
  };
}

/** Build a response that introduces new threads */
function responseWithNewThreads(
  threads: { fragment: string; tags: string[] }[],
  spoken = 'Noted.',
): HelixLLMResponse {
  return makeLLMResponse({
    spokenResponse: spoken,
    threadObservations: {
      newThreads: threads,
      references: [],
      resolved: [],
      merges: [],
    },
  });
}

// ── Tests ───────────────────────────────────────────────────

describe('HelixSessionManager', () => {
  let sm: HelixSessionManager;

  beforeEach(() => {
    sm = new HelixSessionManager({ name: 'Test User' });
  });

  // ── Initialisation ──────────────────────────────────────

  describe('initialisation', () => {
    it('starts in active mode', () => {
      assert.equal(sm.getMode(), 'active');
    });

    it('starts with zero active threads', () => {
      assert.equal(sm.getActiveThreadCount(), 0);
    });

    it('creates a session with the provided profile name', () => {
      const session = sm.getSession();
      assert.equal(session.profile.name, 'Test User');
    });

    it('uses default profile values when none provided', () => {
      const defaults = new HelixSessionManager();
      const session = defaults.getSession();
      assert.equal(session.profile.name, 'User');
      assert.equal(session.profile.synthesisFrequencyMinutes, 10);
      assert.equal(session.profile.wakePhrase, 'Helix');
      assert.equal(session.profile.artefactChannel, 'agent');
    });

    it('merges partial profile with defaults', () => {
      const custom = new HelixSessionManager({
        name: 'Mark',
        cognitiveNotes: 'Non-linear thinker, dyslexic',
      });
      const session = custom.getSession();
      assert.equal(session.profile.name, 'Mark');
      assert.equal(session.profile.cognitiveNotes, 'Non-linear thinker, dyslexic');
      assert.equal(session.profile.wakePhrase, 'Helix'); // default preserved
    });

    it('has a unique session ID', () => {
      const other = new HelixSessionManager();
      assert.notEqual(sm.getSession().sessionId, other.getSession().sessionId);
    });
  });

  // ── Mode Switching ──────────────────────────────────────

  describe('mode switching', () => {
    it('switches to listening mode via "Helix, just listen"', () => {
      const result = sm.detectModeSwitch('Helix, just listen');
      assert.equal(result, 'listening');
    });

    it('switches to listening mode without comma', () => {
      const result = sm.detectModeSwitch('helix just listen');
      assert.equal(result, 'listening');
    });

    it('switches to listening with "just listen" alone', () => {
      const result = sm.detectModeSwitch('just listen');
      assert.equal(result, 'listening');
    });

    it('switches to active via "what do you think"', () => {
      sm.setMode('listening');
      const result = sm.detectModeSwitch('what do you think');
      assert.equal(result, 'active');
    });

    it('switches to active via "Helix, go ahead"', () => {
      const result = sm.detectModeSwitch('Helix, go ahead');
      assert.equal(result, 'active');
    });

    it('switches to active via "your turn"', () => {
      const result = sm.detectModeSwitch('your turn');
      assert.equal(result, 'active');
    });

    it('switches to synthesis via "weave this together"', () => {
      const result = sm.detectModeSwitch('weave this together');
      assert.equal(result, 'synthesis');
    });

    it('switches to synthesis via "Helix, weave"', () => {
      const result = sm.detectModeSwitch('Helix, weave');
      assert.equal(result, 'synthesis');
    });

    it('switches to synthesis via "what threads do we have"', () => {
      const result = sm.detectModeSwitch('what threads do we have');
      assert.equal(result, 'synthesis');
    });

    it('switches to synthesis via "connect the dots"', () => {
      const result = sm.detectModeSwitch('connect the dots');
      assert.equal(result, 'synthesis');
    });

    it('switches to synthesis via "what patterns"', () => {
      const result = sm.detectModeSwitch('what patterns');
      assert.equal(result, 'synthesis');
    });

    it('returns null for normal conversation', () => {
      const result = sm.detectModeSwitch('I was thinking about shoes');
      assert.equal(result, null);
    });

    it('is case-insensitive', () => {
      assert.equal(sm.detectModeSwitch('HELIX, JUST LISTEN'), 'listening');
      assert.equal(sm.detectModeSwitch('HELIX, WEAVE'), 'synthesis');
    });

    it('auto-switches mode when addUserTurn detects a command', () => {
      sm.addUserTurn('Helix, just listen');
      assert.equal(sm.getMode(), 'listening');

      sm.addUserTurn('your turn');
      assert.equal(sm.getMode(), 'active');

      sm.addUserTurn('weave this together');
      assert.equal(sm.getMode(), 'synthesis');
    });

    it('setMode works directly', () => {
      sm.setMode('listening');
      assert.equal(sm.getMode(), 'listening');
      sm.setMode('synthesis');
      assert.equal(sm.getMode(), 'synthesis');
      sm.setMode('active');
      assert.equal(sm.getMode(), 'active');
    });

    it('respects custom wake phrase', () => {
      const custom = new HelixSessionManager({ wakePhrase: 'Spiral' });
      assert.equal(custom.detectModeSwitch('Spiral, just listen'), 'listening');
      assert.equal(custom.detectModeSwitch('Spiral, weave'), 'synthesis');
      // Default wake phrase shouldn't work
      assert.equal(custom.detectModeSwitch('Helix, just listen'), null);
    });
  });

  // ── Turn Processing ─────────────────────────────────────

  describe('turn processing', () => {
    it('records a user turn and increments turn count', () => {
      sm.addUserTurn('My first thought');
      const session = sm.getSession();
      assert.equal(session.turns.length, 1);
      assert.equal(session.turns[0].role, 'user');
      assert.equal(session.turns[0].content, 'My first thought');
      assert.equal(session.turns[0].turnIndex, 0);
      assert.equal(session.stats.totalTurns, 1);
    });

    it('returns system prompt and context summary', () => {
      const result = sm.addUserTurn('Hello');
      assert.ok(result.systemPrompt.includes('Helix'));
      assert.ok(result.systemPrompt.includes('non-linear'));
      assert.ok(result.contextSummary.includes('Hello'));
    });

    it('assigns sequential turn indices', () => {
      sm.addUserTurn('First');
      sm.addUserTurn('Second');
      sm.addUserTurn('Third');
      const session = sm.getSession();
      assert.equal(session.turns[0].turnIndex, 0);
      assert.equal(session.turns[1].turnIndex, 1);
      assert.equal(session.turns[2].turnIndex, 2);
    });

    it('system prompt reflects current mode', () => {
      sm.setMode('listening');
      const { systemPrompt } = sm.addUserTurn('test');
      assert.ok(systemPrompt.includes('LISTENING MODE ACTIVE'));
    });
  });

  // ── Thread Tracking ─────────────────────────────────────

  describe('thread tracking', () => {
    it('creates new threads from LLM response', () => {
      sm.addUserTurn('I keep thinking about carpets and computers');
      const response = responseWithNewThreads([
        { fragment: 'carpets', tags: ['childhood', 'work'] },
        { fragment: 'computers', tags: ['technology', 'passion'] },
      ]);
      sm.processLLMResponse(response);

      assert.equal(sm.getActiveThreadCount(), 2);
      const session = sm.getSession();
      assert.equal(session.threads[0].initialFragment, 'carpets');
      assert.deepEqual(session.threads[0].tags, ['childhood', 'work']);
      assert.equal(session.threads[0].status, 'active');
      assert.equal(session.threads[0].completeness, 0.1);
    });

    it('tracks thread references and increases completeness', () => {
      sm.addUserTurn('Something about carpets');
      const response = responseWithNewThreads([
        { fragment: 'carpets', tags: ['childhood'] },
      ]);
      sm.processLLMResponse(response);

      const threadId = sm.getSession().threads[0].id;

      // Second turn references the same thread
      sm.addUserTurn('The carpet factory was where I learned persistence');
      const ref = makeLLMResponse({
        threadObservations: {
          newThreads: [],
          references: [{ threadId, fragment: 'carpet factory — persistence' }],
          resolved: [],
          merges: [],
        },
      });
      sm.processLLMResponse(ref);

      const thread = sm.getSession().threads[0];
      assert.equal(thread.references.length, 1);
      assert.equal(thread.references[0].text, 'carpet factory — persistence');
      assert.equal(thread.completeness, 0.2); // 0.1 + 0.1
    });

    it('caps completeness at 1.0', () => {
      sm.addUserTurn('test');
      const response = responseWithNewThreads([
        { fragment: 'test', tags: ['test'] },
      ]);
      sm.processLLMResponse(response);

      const threadId = sm.getSession().threads[0].id;

      // Reference the thread 15 times
      for (let i = 0; i < 15; i++) {
        sm.addUserTurn(`mention ${i}`);
        sm.processLLMResponse(makeLLMResponse({
          threadObservations: {
            newThreads: [],
            references: [{ threadId, fragment: `ref ${i}` }],
            resolved: [],
            merges: [],
          },
        }));
      }

      const thread = sm.getSession().threads[0];
      assert.equal(thread.completeness, 1.0);
    });

    it('resolves threads', () => {
      sm.addUserTurn('test');
      sm.processLLMResponse(responseWithNewThreads([
        { fragment: 'unresolved idea', tags: ['idea'] },
      ]));

      const threadId = sm.getSession().threads[0].id;
      sm.addUserTurn('yes, that resolves it');
      sm.processLLMResponse(makeLLMResponse({
        threadObservations: {
          newThreads: [],
          references: [],
          resolved: [threadId],
          merges: [],
        },
      }));

      const thread = sm.getSession().threads[0];
      assert.equal(thread.status, 'resolved');
      assert.equal(thread.completeness, 1.0);
    });

    it('merges threads', () => {
      sm.addUserTurn('two ideas');
      sm.processLLMResponse(responseWithNewThreads([
        { fragment: 'thread A', tags: ['a'] },
        { fragment: 'thread B', tags: ['b'] },
      ]));

      const threads = sm.getSession().threads;
      const sourceId = threads[0].id;
      const targetId = threads[1].id;

      sm.addUserTurn('actually those are the same thing');
      sm.processLLMResponse(makeLLMResponse({
        threadObservations: {
          newThreads: [],
          references: [],
          resolved: [],
          merges: [{ sourceId, targetId, reason: 'user recognised convergence' }],
        },
      }));

      const merged = sm.getSession().threads[0];
      assert.equal(merged.status, 'merged');
      assert.equal(merged.mergedInto, targetId);
    });

    it('ignores references to non-existent thread IDs', () => {
      sm.addUserTurn('test');
      const response = makeLLMResponse({
        threadObservations: {
          newThreads: [],
          references: [{ threadId: 'non-existent', fragment: 'ghost' }],
          resolved: [],
          merges: [],
        },
      });
      // Should not throw
      sm.processLLMResponse(response);
      assert.equal(sm.getActiveThreadCount(), 0);
    });

    it('updates stats after processing', () => {
      sm.addUserTurn('test');
      sm.processLLMResponse(responseWithNewThreads([
        { fragment: 'idea 1', tags: ['a'] },
        { fragment: 'idea 2', tags: ['b'] },
      ]));

      const stats = sm.getSession().stats;
      assert.equal(stats.activeThreads, 2);
      assert.equal(stats.resolvedThreads, 0);
    });
  });

  // ── Synthesis ───────────────────────────────────────────

  describe('synthesis', () => {
    it('records synthesis candidates', () => {
      sm.addUserTurn('test');
      sm.processLLMResponse(responseWithNewThreads([
        { fragment: 'thread A', tags: ['a'] },
        { fragment: 'thread B', tags: ['b'] },
      ]));

      const threadIds = sm.getSession().threads.map((t) => t.id);

      sm.addUserTurn('another thought');
      const result = sm.processLLMResponse(makeLLMResponse({
        synthesis: {
          detected: true,
          threadIds,
          description: 'A and B converge on identity',
          confidence: 0.8,
          offerText: 'I notice these two threads are connected...',
          synthesisContent: 'Full synthesis here',
        },
      }));

      const candidates = sm.getSession().synthesisCandidates;
      assert.equal(candidates.length, 1);
      assert.equal(candidates[0].description, 'A and B converge on identity');
      assert.equal(candidates[0].confidence, 0.8);
    });

    it('offers synthesis in synthesis mode regardless of timing', () => {
      sm.setMode('synthesis');
      sm.addUserTurn('weave this together');

      const result = sm.processLLMResponse(makeLLMResponse({
        synthesis: {
          detected: true,
          threadIds: [],
          description: 'test synthesis',
          confidence: 0.3, // low confidence, but we're in synthesis mode
          offerText: 'Here is what I see...',
        },
      }));

      assert.equal(result.shouldOfferSynthesis, true);
      assert.equal(result.synthesisOffer, 'Here is what I see...');
    });

    it('does NOT offer synthesis when confidence is too low in active mode', () => {
      // Need to wait past the synthesis frequency or use 0
      const sm2 = new HelixSessionManager({
        synthesisFrequencyMinutes: 0,
      });
      sm2.addUserTurn('test');

      const result = sm2.processLLMResponse(makeLLMResponse({
        synthesis: {
          detected: true,
          threadIds: [],
          description: 'weak signal',
          confidence: 0.3,
        },
      }));

      // synthesisFrequencyMinutes = 0 means only on request
      assert.equal(result.shouldOfferSynthesis, false);
    });

    it('tracks syntheses offered in stats', () => {
      sm.setMode('synthesis');
      sm.addUserTurn('weave');
      sm.processLLMResponse(makeLLMResponse({
        synthesis: {
          detected: true,
          threadIds: [],
          description: 'test',
          confidence: 0.9,
          offerText: 'offer',
        },
      }));

      assert.equal(sm.getSession().stats.synthesesOffered, 1);
    });
  });

  // ── Pattern Amplification ───────────────────────────────

  describe('pattern amplification', () => {
    it('records and surfaces patterns in active mode', () => {
      sm.addUserTurn('The carpet thing reminds me of the computer thing');
      const result = sm.processLLMResponse(makeLLMResponse({
        pattern: {
          detected: true,
          description: 'Manual labour and technology share a persistence theme',
          threadIds: [],
          triggerFragment: 'reminds me',
          surfaceText: 'I notice a connection between the carpets and the computing...',
        },
      }));

      assert.ok(result.patternToSurface);
      assert.equal(
        result.patternToSurface,
        'I notice a connection between the carpets and the computing...',
      );

      const patterns = sm.getSession().patterns;
      assert.equal(patterns.length, 1);
      assert.equal(patterns[0].surfaced, true);
      assert.equal(sm.getSession().stats.patternsDetected, 1);
    });

    it('does NOT surface patterns in listening mode', () => {
      sm.setMode('listening');
      sm.addUserTurn('something connecting');
      const result = sm.processLLMResponse(makeLLMResponse({
        pattern: {
          detected: true,
          description: 'A connection',
          threadIds: [],
          triggerFragment: 'connecting',
          surfaceText: 'I see a pattern...',
        },
      }));

      assert.equal(result.patternToSurface, undefined);
      // Pattern is still recorded, just not surfaced
      const patterns = sm.getSession().patterns;
      assert.equal(patterns.length, 1);
      assert.equal(patterns[0].surfaced, false);
    });
  });

  // ── Session Summary ─────────────────────────────────────

  describe('summary generation', () => {
    it('generates a summary with session info', () => {
      const summary = sm.generateSummary();
      assert.ok(summary.includes('Helix Session Summary'));
      assert.ok(summary.includes('Turns:'));
    });

    it('includes active and resolved threads', () => {
      sm.addUserTurn('ideas');
      sm.processLLMResponse(responseWithNewThreads([
        { fragment: 'open idea', tags: ['open'] },
        { fragment: 'done idea', tags: ['done'] },
      ]));

      const doneId = sm.getSession().threads[1].id;
      sm.addUserTurn('that second one is resolved');
      sm.processLLMResponse(makeLLMResponse({
        threadObservations: {
          newThreads: [],
          references: [],
          resolved: [doneId],
          merges: [],
        },
      }));

      const summary = sm.generateSummary();
      assert.ok(summary.includes('Open Threads'));
      assert.ok(summary.includes('open idea'));
      assert.ok(summary.includes('Resolved Threads'));
      assert.ok(summary.includes('done idea'));
    });

    it('includes surfaced patterns', () => {
      sm.addUserTurn('test');
      sm.processLLMResponse(makeLLMResponse({
        pattern: {
          detected: true,
          description: 'Persistence runs through everything',
          threadIds: [],
          triggerFragment: 'test',
          surfaceText: 'I see persistence...',
        },
      }));

      const summary = sm.generateSummary();
      assert.ok(summary.includes('Connections Spotted'));
      assert.ok(summary.includes('Persistence runs through everything'));
    });
  });

  // ── LLM Response Processing ─────────────────────────────

  describe('LLM response processing', () => {
    it('records helix turn in conversation', () => {
      sm.addUserTurn('hello');
      sm.processLLMResponse(makeLLMResponse({ spokenResponse: 'I am here.' }));

      const session = sm.getSession();
      assert.equal(session.turns.length, 2);
      assert.equal(session.turns[1].role, 'helix');
      assert.equal(session.turns[1].content, 'I am here.');
    });

    it('returns the spoken response', () => {
      sm.addUserTurn('hello');
      const result = sm.processLLMResponse(
        makeLLMResponse({ spokenResponse: 'I hear you, go on.' }),
      );
      assert.equal(result.spokenResponse, 'I hear you, go on.');
    });
  });

  // ── Context Window ──────────────────────────────────────

  describe('context management', () => {
    it('context summary includes recent turns only (last 20)', () => {
      // Add 25 turns
      for (let i = 0; i < 25; i++) {
        sm.addUserTurn(`Turn ${i}`);
        sm.processLLMResponse(makeLLMResponse({ spokenResponse: `Response ${i}` }));
      }

      const { contextSummary } = sm.addUserTurn('Final turn');
      // Should not include very early turns
      assert.ok(!contextSummary.includes('Turn 0'));
      // Should include recent ones
      assert.ok(contextSummary.includes('Final turn'));
    });
  });

  // ── Edge Cases ──────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty LLM response gracefully', () => {
      sm.addUserTurn('test');
      const result = sm.processLLMResponse(makeLLMResponse());
      assert.equal(result.spokenResponse, 'I hear you.');
      assert.equal(result.shouldOfferSynthesis, false);
      assert.equal(result.patternToSurface, undefined);
    });

    it('handles rapid mode switches', () => {
      sm.addUserTurn('Helix, just listen');
      assert.equal(sm.getMode(), 'listening');
      sm.addUserTurn('actually, weave this together');
      assert.equal(sm.getMode(), 'synthesis');
      sm.addUserTurn('your turn');
      assert.equal(sm.getMode(), 'active');
    });

    it('getSession returns a shallow copy (top-level fields are new, arrays are shared)', () => {
      // NOTE: getSession() uses object spread — shallow copy.
      // The turns array is shared. This is a known limitation.
      // A future improvement could deep-clone, but for read-only
      // inspection the shallow copy is acceptable.
      const session1 = sm.getSession();
      const session2 = sm.getSession();
      // Top-level object is a different reference
      assert.notEqual(session1, session2);
      // But arrays are shared (shallow copy)
      assert.equal(session1.turns, session2.turns);
    });
  });
});
