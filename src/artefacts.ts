/**
 * Helix Artefact Generator
 *
 * Produces structured session summaries after a conversation.
 * Artefacts capture: threads (open + resolved), patterns found,
 * syntheses accepted, and a thread timeline showing the non-linear
 * flow of the conversation.
 *
 * Design principle: Artefacts belong to the user. They're written
 * in their voice, reflecting their threads — not Helix's analysis.
 *
 * Phase 2, Step 5: Artefact generation.
 */

import type {
  HelixSession,
  HelixThread,
  SynthesisCandidate,
  PatternDetection,
  ConversationTurn,
} from './types.js';

// ── Types ────────────────────────────────────────────────────

export interface ArtefactOptions {
  /** Include full conversation transcript */
  includeTranscript?: boolean;
  /** Include thread timeline visualization */
  includeTimeline?: boolean;
  /** Include raw stats */
  includeStats?: boolean;
  /** Title override (default: auto-generated from threads) */
  title?: string;
  /** Output format */
  format?: 'markdown' | 'json';
}

export interface ArtefactJSON {
  title: string;
  date: string;
  duration: string;
  threads: {
    id: string;
    summary: string;
    status: string;
    completeness: number;
    tags: string[];
    referenceCount: number;
  }[];
  patterns: {
    description: string;
    threadIds: string[];
    developed: boolean;
  }[];
  syntheses: {
    description: string;
    threadIds: string[];
    accepted: boolean;
  }[];
  stats: {
    turns: number;
    threads: number;
    patterns: number;
    syntheses: number;
    duration: string;
  };
  openQuestions: string[];
}

const DEFAULT_OPTIONS: ArtefactOptions = {
  includeTranscript: false,
  includeTimeline: true,
  includeStats: true,
  format: 'markdown',
};

// ── Generator ────────────────────────────────────────────────

export function generateArtefact(
  session: HelixSession,
  options: ArtefactOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (opts.format === 'json') {
    return JSON.stringify(generateArtefactJSON(session, opts), null, 2);
  }

  return generateArtefactMarkdown(session, opts);
}

// ── JSON format ──────────────────────────────────────────────

function generateArtefactJSON(
  session: HelixSession,
  opts: ArtefactOptions
): ArtefactJSON {
  const title = opts.title || inferTitle(session);
  const duration = formatDuration(session.stats.durationMinutes);

  return {
    title,
    date: session.startedAt,
    duration,
    threads: session.threads.map((t) => ({
      id: t.id,
      summary: t.initialFragment,
      status: t.status,
      completeness: t.completeness,
      tags: t.tags,
      referenceCount: t.references.length,
    })),
    patterns: session.patterns
      .filter((p) => p.surfaced)
      .map((p) => ({
        description: p.description,
        threadIds: p.threadIds,
        developed: p.developed === true,
      })),
    syntheses: session.synthesisCandidates
      .filter((s) => s.offered)
      .map((s) => ({
        description: s.description,
        threadIds: s.threadIds,
        accepted: s.accepted === true,
      })),
    stats: {
      turns: session.stats.totalTurns,
      threads: session.threads.length,
      patterns: session.stats.patternsDetected,
      syntheses: session.stats.synthesesOffered,
      duration,
    },
    openQuestions: extractOpenQuestions(session),
  };
}

// ── Markdown format ──────────────────────────────────────────

function generateArtefactMarkdown(
  session: HelixSession,
  opts: ArtefactOptions
): string {
  const title = opts.title || inferTitle(session);
  const duration = formatDuration(session.stats.durationMinutes);
  const sections: string[] = [];

  // Header
  sections.push(`# ${title}`);
  sections.push('');
  sections.push(`**Date:** ${formatDate(session.startedAt)}`);
  sections.push(`**Duration:** ${duration}`);
  sections.push(`**Turns:** ${session.stats.totalTurns}`);
  sections.push('');

  // Thread summary — the heart of the artefact
  const activeThreads = session.threads.filter(
    (t) => t.status === 'active' || t.status === 'dormant'
  );
  const resolvedThreads = session.threads.filter(
    (t) => t.status === 'resolved'
  );

  if (activeThreads.length > 0) {
    sections.push('## Open Threads');
    sections.push('');
    sections.push('*These ideas are still developing. Come back to them.*');
    sections.push('');
    for (const t of activeThreads) {
      const bar = progressBar(t.completeness);
      const tagStr = t.tags.length > 0 ? ` \`${t.tags.join('` `')}\`` : '';
      sections.push(`### ${t.initialFragment}`);
      sections.push(`${bar} ${(t.completeness * 100).toFixed(0)}% developed${tagStr}`);
      if (t.references.length > 0) {
        sections.push('');
        sections.push(
          `Returned to ${t.references.length} time${t.references.length !== 1 ? 's' : ''} during the conversation.`
        );
      }
      sections.push('');
    }
  }

  if (resolvedThreads.length > 0) {
    sections.push('## Resolved Threads');
    sections.push('');
    for (const t of resolvedThreads) {
      const tagStr = t.tags.length > 0 ? ` \`${t.tags.join('` `')}\`` : '';
      sections.push(`- ~~${t.initialFragment}~~${tagStr}`);
    }
    sections.push('');
  }

  // Patterns — connections the user (or Helix) spotted
  const surfacedPatterns = session.patterns.filter((p) => p.surfaced);
  if (surfacedPatterns.length > 0) {
    sections.push('## Connections');
    sections.push('');
    sections.push('*Patterns that emerged during the conversation.*');
    sections.push('');
    for (const p of surfacedPatterns) {
      const icon = p.developed ? '🔗' : '💡';
      const devLabel = p.developed ? ' *(explored)*' : ' *(noted, not yet explored)*';
      sections.push(`${icon} ${p.description}${devLabel}`);
      sections.push('');
    }
  }

  // Syntheses — moments of convergence
  const offeredSyntheses = session.synthesisCandidates.filter((s) => s.offered);
  if (offeredSyntheses.length > 0) {
    sections.push('## Syntheses');
    sections.push('');
    for (const s of offeredSyntheses) {
      const icon = s.accepted ? '✅' : '⏸️';
      const label = s.accepted ? 'Accepted' : 'Deferred';
      sections.push(`${icon} **${label}:** ${s.description}`);
      const involvedThreads = session.threads.filter((t) =>
        s.threadIds.includes(t.id)
      );
      if (involvedThreads.length > 0) {
        sections.push(
          `  Threads: ${involvedThreads.map((t) => `"${t.initialFragment}"`).join(', ')}`
        );
      }
      sections.push('');
    }
  }

  // Open questions — what to think about next
  const openQs = extractOpenQuestions(session);
  if (openQs.length > 0) {
    sections.push('## What to Think About Next');
    sections.push('');
    for (const q of openQs) {
      sections.push(`- ${q}`);
    }
    sections.push('');
  }

  // Thread timeline
  if (opts.includeTimeline && session.turns.length > 0) {
    const timeline = generateTimeline(session);
    if (timeline) {
      sections.push('## Thread Timeline');
      sections.push('');
      sections.push(
        '*How your thinking moved across threads during the conversation.*'
      );
      sections.push('');
      sections.push(timeline);
      sections.push('');
    }
  }

  // Stats
  if (opts.includeStats) {
    sections.push('---');
    sections.push('');
    sections.push(
      `*${session.stats.totalTurns} turns · ` +
        `${session.threads.length} threads tracked · ` +
        `${session.stats.patternsDetected} patterns detected · ` +
        `${session.stats.synthesesOffered} syntheses offered · ` +
        `${duration}*`
    );
  }

  // Transcript
  if (opts.includeTranscript && session.turns.length > 0) {
    sections.push('');
    sections.push('---');
    sections.push('');
    sections.push('<details>');
    sections.push('<summary>Full Transcript</summary>');
    sections.push('');
    for (const turn of session.turns) {
      const speaker = turn.role === 'user' ? session.profile.name : 'Helix';
      sections.push(`**${speaker}:** ${turn.content}`);
      sections.push('');
    }
    sections.push('</details>');
  }

  return sections.join('\n');
}

// ── Timeline visualization ───────────────────────────────────

function generateTimeline(session: HelixSession): string | null {
  if (session.threads.length === 0) return null;

  const lines: string[] = [];
  const threadMap = new Map<string, HelixThread>();
  for (const t of session.threads) {
    threadMap.set(t.id, t);
  }

  // Build turn-by-turn thread activity
  // Each row: turn number, which threads were active
  const threadIds = session.threads.map((t) => t.id);
  const maxLabelLen = Math.min(
    20,
    Math.max(...session.threads.map((t) => t.initialFragment.length))
  );

  // Header: thread labels
  lines.push('```');
  lines.push(
    'Turn  ' +
      session.threads
        .map((t) => truncate(t.initialFragment, 12).padEnd(13))
        .join('')
  );
  lines.push(
    '────  ' + session.threads.map(() => '─────────────').join('')
  );

  // For each turn, check which threads were referenced
  for (const turn of session.turns) {
    if (turn.role !== 'user') continue;

    const obs = turn.observations;
    const activeIds = new Set<string>();

    // Threads created this turn
    if (obs?.newThreads) {
      for (const nt of obs.newThreads) {
        // Find the thread that was created from this observation
        // Match by checking if any thread was created around this turn
        for (const t of session.threads) {
          if (t.references.length === 0 && !activeIds.has(t.id)) {
            // Heuristic: first unreferenced thread
          }
        }
      }
    }

    // Threads referenced this turn
    if (obs?.threadReferences) {
      for (const ref of obs.threadReferences) {
        activeIds.add(ref.threadId);
      }
    }

    const turnLabel = String(turn.turnIndex + 1).padStart(4);
    const cells = threadIds.map((id) => {
      if (activeIds.has(id)) return '    ●        ';
      // Check if thread existed at this point
      const thread = threadMap.get(id);
      if (thread) {
        const createdTurn = session.turns.findIndex(
          (t) =>
            t.timestamp === thread.createdAt ||
            new Date(t.timestamp).getTime() <=
              new Date(thread.createdAt).getTime()
        );
        if (createdTurn >= 0 && turn.turnIndex >= createdTurn) {
          return '    ·        ';
        }
      }
      return '             ';
    });

    lines.push(`${turnLabel}  ${cells.join('')}`);
  }

  lines.push('```');

  return lines.join('\n');
}

// ── Helpers ──────────────────────────────────────────────────

function inferTitle(session: HelixSession): string {
  // Try to build a title from the most prominent thread tags
  const topThreads = [...session.threads]
    .sort((a, b) => b.references.length - a.references.length)
    .slice(0, 2);

  if (topThreads.length === 0) {
    return 'Helix Session';
  }

  if (topThreads.length === 1) {
    return `Session: ${topThreads[0].initialFragment}`;
  }

  return `Session: ${topThreads[0].tags[0] || 'Thread 1'} × ${topThreads[1].tags[0] || 'Thread 2'}`;
}

function extractOpenQuestions(session: HelixSession): string[] {
  const questions: string[] = [];

  // Active threads with low completeness = open questions
  for (const t of session.threads) {
    if (t.status === 'active' && t.completeness < 0.5) {
      questions.push(
        `"${truncate(t.initialFragment, 60)}" — barely started. What's underneath this?`
      );
    } else if (t.status === 'dormant') {
      questions.push(
        `"${truncate(t.initialFragment, 60)}" — went quiet. Worth revisiting?`
      );
    }
  }

  // Patterns noted but not explored
  for (const p of session.patterns) {
    if (p.surfaced && !p.developed) {
      questions.push(`Connection spotted but not explored: ${p.description}`);
    }
  }

  // Syntheses deferred
  for (const s of session.synthesisCandidates) {
    if (s.offered && s.accepted === false) {
      questions.push(`Deferred synthesis: ${s.description}`);
    }
  }

  return questions;
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function progressBar(value: number): string {
  const filled = Math.round(value * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}
