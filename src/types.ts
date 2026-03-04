/**
 * Helix — Non-Linear Cognition Interface
 * Core type definitions
 *
 * Design principle: The session manager owns the data structure.
 * The LLM observes and describes; we maintain state.
 */

// ── Thread Management ──────────────────────────────────────────

export interface HelixThread {
  id: string;
  /** The first fragment that introduced this thread */
  initialFragment: string;
  /** Later references, additions, or returns to this thread */
  references: ThreadReference[];
  /** Semantic tags assigned by the LLM or user */
  tags: string[];
  /** 0.0 = bare fragment, 1.0 = fully resolved */
  completeness: number;
  /** Thread state */
  status: 'active' | 'dormant' | 'resolved' | 'merged';
  /** If merged, which thread absorbed this one */
  mergedInto?: string;
  createdAt: string;
  lastReferencedAt: string;
}

export interface ThreadReference {
  text: string;
  timestamp: string;
  /** Which turn in the conversation */
  turnIndex: number;
}

// ── Synthesis ──────────────────────────────────────────────────

export interface SynthesisCandidate {
  id: string;
  /** Which threads appear to be converging */
  threadIds: string[];
  /** What the connection appears to be */
  description: string;
  /** 0.0 to 1.0 — how confident the system is */
  confidence: number;
  /** Has this been offered to the user? */
  offered: boolean;
  /** User's response: true = accepted, false = dismissed, null = not yet offered */
  accepted: boolean | null;
  detectedAt: string;
}

// ── Pattern Amplification ──────────────────────────────────────

export interface PatternDetection {
  id: string;
  /** The connection that was spotted */
  description: string;
  /** The threads involved */
  threadIds: string[];
  /** The user's words that triggered detection */
  triggerFragment: string;
  /** Was this surfaced to the user? */
  surfaced: boolean;
  /** Did the user want to develop it? */
  developed: boolean | null;
  detectedAt: string;
}

// ── Session State ──────────────────────────────────────────────

export type HelixMode = 'active' | 'listening' | 'synthesis';

export interface HelixSession {
  sessionId: string;
  startedAt: string;
  mode: HelixMode;

  /** Active thought-threads */
  threads: HelixThread[];
  /** Potential convergences detected */
  synthesisCandidates: SynthesisCandidate[];
  /** Lateral connections spotted */
  patterns: PatternDetection[];

  /** Full conversation transcript */
  turns: ConversationTurn[];

  /** User preferences */
  profile: HelixUserProfile;

  /** Session statistics */
  stats: SessionStats;
}

export interface ConversationTurn {
  role: 'user' | 'helix';
  content: string;
  timestamp: string;
  turnIndex: number;
  /** LLM's observations about this turn (thread refs, patterns, etc.) */
  observations?: TurnObservations;
}

export interface TurnObservations {
  /** New threads introduced in this turn */
  newThreads?: string[];
  /** Existing threads referenced */
  threadReferences?: { threadId: string; fragment: string }[];
  /** Patterns detected */
  patternDetected?: boolean;
  /** Synthesis opportunity detected */
  synthesisOpportunity?: boolean;
}

// ── User Profile ───────────────────────────────────────────────

export interface HelixUserProfile {
  name: string;
  /** How frequently to offer synthesis (in minutes). 0 = only on request */
  synthesisFrequencyMinutes: number;
  /** Preferred artefact delivery */
  artefactChannel: 'email' | 'file' | 'clipboard' | 'agent';
  /** Custom wake phrase */
  wakePhrase: string;
  /** Personal notes about cognitive style */
  cognitiveNotes: string;
}

// ── Session Stats ──────────────────────────────────────────────

export interface SessionStats {
  totalTurns: number;
  activeThreads: number;
  resolvedThreads: number;
  synthesesOffered: number;
  synthesesAccepted: number;
  patternsDetected: number;
  patternsDeveloped: number;
  durationMinutes: number;
}

// ── LLM Response Contract ──────────────────────────────────────
// This is what we ask the LLM to return. The session manager
// parses this and updates its own state — the LLM does not
// directly modify the session state.

export interface HelixLLMResponse {
  /** What Helix says aloud — optimised for speech, not text */
  spokenResponse: string;

  /** Thread observations for this turn */
  threadObservations: {
    /** New threads the user introduced */
    newThreads: { fragment: string; tags: string[] }[];
    /** Existing threads the user referenced (by ID) */
    references: { threadId: string; fragment: string }[];
    /** Threads that appear resolved */
    resolved: string[];
    /** Threads that should be merged (and why) */
    merges: { sourceId: string; targetId: string; reason: string }[];
  };

  /** Synthesis opportunity, if detected */
  synthesis: {
    detected: boolean;
    threadIds: string[];
    description: string;
    confidence: number;
    /** The spoken offer if we should surface it */
    offerText?: string;
    /** The full synthesis content if user accepts */
    synthesisContent?: string;
  } | null;

  /** Pattern amplification, if detected */
  pattern: {
    detected: boolean;
    description: string;
    threadIds: string[];
    triggerFragment: string;
    /** What Helix says to surface the pattern */
    surfaceText: string;
  } | null;
}
