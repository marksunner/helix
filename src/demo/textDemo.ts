/**
 * Helix Text Demo — First Real Conversation
 *
 * Demonstrates thread holding, pattern amplification, and synthesis
 * by running a simulated conversation through the session manager.
 *
 * This uses a mock LLM that returns plausible responses while letting
 * the session manager do its actual work: tracking threads, detecting
 * patterns, managing modes, and timing synthesis offers.
 *
 * Run: npx tsx src/demo/textDemo.ts
 *
 * Phase 2, Step 4: First real Helix conversation demo.
 */

import { HelixSessionManager } from '../sessionManager.js';
import type { HelixLLMResponse, HelixThread, HelixMode } from '../types.js';

// ── Mock LLM ─────────────────────────────────────────────────

/**
 * A mock LLM that returns structured responses the session manager
 * can process. In production, this would be a real LLM call.
 *
 * The mock demonstrates the contract: the LLM observes threads,
 * patterns, and synthesis candidates — it doesn't own them.
 */
function createMockLLM(sessionManager: HelixSessionManager) {
  let turnCount = 0;

  return async (_systemPrompt: string, _context: string): Promise<HelixLLMResponse> => {
    turnCount++;
    const session = sessionManager.getSession();
    const existingThreads = session.threads;

    // Generate contextual responses based on conversation state
    const response: HelixLLMResponse = {
      spokenResponse: '',
      threadObservations: {
        newThreads: [],
        references: [],
        resolved: [],
        merges: [],
      },
      synthesis: { detected: false },
      pattern: { detected: false },
    };

    // Strategy: first few turns create threads, later turns reference them
    if (turnCount <= 3) {
      // Early turns: acknowledge and create threads
      response.spokenResponse = getEarlyResponse(turnCount);
      response.threadObservations.newThreads.push({
        fragment: `Thread from turn ${turnCount}`,
        tags: [`turn-${turnCount}`],
      });
    } else if (turnCount <= 5 && existingThreads.length > 0) {
      // Middle turns: reference existing threads
      response.spokenResponse = getMiddleResponse(turnCount, existingThreads);
      const threadToRef = existingThreads[0];
      response.threadObservations.references.push({
        threadId: threadToRef.id,
        fragment: `Return to: ${threadToRef.initialFragment}`,
      });
    } else if (existingThreads.length >= 2) {
      // Later turns: detect patterns between threads
      response.spokenResponse = getLateResponse(turnCount, existingThreads);
      response.pattern = {
        detected: true,
        description: `Connection between "${existingThreads[0].initialFragment}" and "${existingThreads[1].initialFragment}"`,
        threadIds: [existingThreads[0].id, existingThreads[1].id],
        surfaceText: `I notice something — the thread about "${existingThreads[0].tags[0]}" and the one about "${existingThreads[1].tags[0]}" seem connected. Would you like to explore that?`,
      };
    }

    // After enough turns with multiple threads, offer synthesis
    if (turnCount >= 6 && existingThreads.length >= 2) {
      response.synthesis = {
        detected: true,
        threadIds: existingThreads.map(t => t.id).slice(0, 3),
        description: 'Multiple threads converging',
        confidence: 0.7 + (turnCount * 0.03),
        offerText: 'Several of your threads seem to be circling the same idea. Want me to try weaving them together?',
      };
    }

    return response;
  };
}

function getEarlyResponse(turn: number): string {
  const responses = [
    "I hear you. There's something about that thought — I'm holding it. Keep going.",
    "That's an interesting thread. I notice it connects to something, but I'll wait. What else is on your mind?",
    "I'm tracking that. You've got a few threads running now. Take your time with them.",
  ];
  return responses[turn - 1] || responses[0];
}

function getMiddleResponse(turn: number, threads: HelixThread[]): string {
  return `You came back to something from earlier — "${threads[0].tags[0]}". That thread is getting richer. I'm still listening.`;
}

function getLateResponse(turn: number, threads: HelixThread[]): string {
  return `You've been building something across these threads. The "${threads[0].tags[0]}" idea and the "${threads[1].tags[0]}" idea — I think they're talking to each other.`;
}

// ── Demo Conversations ──────────────────────────────────────

interface DemoTurn {
  speaker: string;
  text: string;
  /** Optional: switch mode before this turn */
  modeSwitch?: string;
}

const DYSLEXIC_THINKER_CONVERSATION: DemoTurn[] = [
  {
    speaker: 'User',
    text: "I've been thinking about... you know how buildings have foundations? Not literally, but the way an idea needs one. My startup idea keeps shifting because the foundation isn't—I don't know. It's like sand.",
  },
  {
    speaker: 'User',
    text: "Oh, completely different thing. My daughter's teacher said she's not reading at grade level. And I keep thinking about how school measures everything wrong. They measure speed, not understanding.",
  },
  {
    speaker: 'User',
    text: "Wait, back to the startup. The problem is everyone wants me to write a business plan. But my brain doesn't work in business plans. It works in... constellations? Like I can see all the points but drawing lines between them in order is the hard part.",
  },
  {
    speaker: 'User',
    text: "Helix, just listen",
  },
  {
    speaker: 'User',
    text: "The school thing and the startup thing. They're the same thing, aren't they? Both are systems that measure the wrong thing. School measures reading speed. Investors measure business plans. Neither measures the actual thinking.",
  },
  {
    speaker: 'User',
    text: "That's it. That's the startup. A tool that captures the constellation, not the linear version. Because 780 million dyslexic people are having this exact conversation with themselves every day, and nobody built the tool that thinks the way they do.",
  },
  {
    speaker: 'User',
    text: "Helix, weave this together",
  },
];

// ── Runner ───────────────────────────────────────────────────

function formatMode(mode: HelixMode): string {
  const icons: Record<HelixMode, string> = {
    active: '🟢 Active',
    listening: '🔵 Listening',
    synthesis: '🟣 Synthesis',
  };
  return icons[mode] || mode;
}

function formatThreads(threads: HelixThread[]): string {
  if (threads.length === 0) return '  (none yet)';
  return threads
    .map(t => {
      const bar = '█'.repeat(Math.round(t.completeness * 10)).padEnd(10, '░');
      return `  [${t.status}] ${bar} ${(t.completeness * 100).toFixed(0)}% — "${t.initialFragment}" (${t.tags.join(', ')})`;
    })
    .join('\n');
}

async function runDemo() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🧬 HELIX — Non-Linear Cognition Interface');
  console.log('  First Conversation Demo');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();
  console.log('  Scenario: A dyslexic entrepreneur thinking through a startup');
  console.log('  idea while processing their daughter\'s school feedback.');
  console.log('  Watch how Helix holds threads, detects connections, and');
  console.log('  offers synthesis at the right moment.');
  console.log();
  console.log('───────────────────────────────────────────────────────────────');

  const manager = new HelixSessionManager({
    name: 'Demo User',
    cognitiveNotes: 'Non-linear thinker, dyslexic, visual/spatial processing',
    synthesisFrequencyMinutes: 0, // Allow immediate synthesis for demo
  });

  const mockLLM = createMockLLM(manager);

  for (const turn of DYSLEXIC_THINKER_CONVERSATION) {
    console.log();
    console.log(`  💬 ${turn.speaker}: "${turn.text}"`);
    console.log();

    // Process through session manager
    const { systemPrompt, contextSummary } = manager.addUserTurn(turn.text);
    const mode = manager.getMode();

    console.log(`  Mode: ${formatMode(mode)}`);

    // Get LLM response
    const llmResponse = await mockLLM(systemPrompt, contextSummary);

    // Process response
    const result = manager.processLLMResponse(llmResponse);

    console.log(`  🧬 Helix: "${llmResponse.spokenResponse}"`);

    if (llmResponse.pattern?.detected) {
      console.log();
      console.log(`  ✨ Pattern detected: ${llmResponse.pattern.surfaceText}`);
    }

    if (llmResponse.synthesis?.detected) {
      console.log();
      console.log(`  🔮 Synthesis offered: ${llmResponse.synthesis.offerText}`);
      console.log(`     Confidence: ${((llmResponse.synthesis.confidence || 0) * 100).toFixed(0)}%`);
      console.log(`     Threads involved: ${llmResponse.synthesis.threadIds?.length || 0}`);
    }

    // Show thread state
    const session = manager.getSession();
    console.log();
    console.log(`  📋 Threads (${session.threads.length}):`);
    console.log(formatThreads(session.threads));

    console.log();
    console.log('───────────────────────────────────────────────────────────────');
  }

  // Final session summary
  const finalSession = manager.getSession();
  console.log();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Session Summary');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();
  console.log(`  Session ID: ${finalSession.sessionId}`);
  console.log(`  Total turns: ${finalSession.stats.totalTurns}`);
  console.log(`  Final mode: ${formatMode(finalSession.mode)}`);
  console.log(`  Threads tracked: ${finalSession.threads.length}`);
  console.log(`  Synthesis candidates: ${finalSession.synthesisCandidates.length}`);
  console.log(`  Patterns detected: ${finalSession.patterns.length}`);
  console.log();

  // Thread detail
  for (const thread of finalSession.threads) {
    console.log(`  Thread: "${thread.initialFragment}"`);
    console.log(`    Status: ${thread.status} | Completeness: ${(thread.completeness * 100).toFixed(0)}%`);
    console.log(`    Tags: ${thread.tags.join(', ')}`);
    console.log(`    References: ${thread.references.length}`);
    console.log();
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  This is what voice AI looks like when it\'s designed');
  console.log('  for non-linear minds. Not a chatbot. A thinking partner.');
  console.log('═══════════════════════════════════════════════════════════════');
}

runDemo().catch(console.error);
