# Helix 🧬

**A non-linear cognition interface for voice AI.**

Helix is a voice-first conversational layer designed for minds that don't think in straight lines — starting with dyslexic thinkers, but relevant to anyone whose best ideas arrive in spirals.

---

## Why This Exists

I'm dyslexic. Not the kind where letters dance around — the kind where my thoughts arrive in five threads simultaneously, connections form across ideas that seem unrelated, and the signal is real but the packaging is non-standard.

Every voice assistant on the market — Alexa, Google, Siri, even the new LLM-backed ones — assumes thought arrives linearly. One idea at a time. Neatly packaged. Resolved before the next one starts.

That's not how my brain works. And it's not how 780 million other dyslexic brains work either.

Current voice AI treats non-linear thinking as noise to be filtered out. Helix is built on the opposite premise: **the non-linearity is the signal.**

I don't just *see* connections — I *hear* them. Something closer to synaesthesia than pattern matching. When two ideas converge across a conversation, I hear a resonance before I can articulate it. And if nobody catches it in that moment, it evaporates.

Helix catches it.

I was twelve when I bought my first computer — a Sinclair ZX81, paid for with a year's wages from tidying carpet samples after school. Before that, every signal I received told me I was slow. The ZX81 didn't care how long it took me to understand something. It just waited. That was the first time technology met me where I was instead of where it expected me to be - and that recalibration utterly changed the trajectory of my life. Helix is the same idea, forty years later.

---

## What Helix Does

Helix isn't a chatbot. It's a **listening posture** — a fundamentally different way for AI to hold a conversation.

### 🧵 Thread Holding
Most AI resets after each exchange. Helix doesn't. It accumulates incomplete thoughts, holds them in suspension, and tracks where they're going — even when you can't articulate it yet. It doesn't demand completion. It waits.

### 🌀 Non-Linear Synthesis
Periodically, Helix offers to weave what it's heard — not summarise, but *synthesise*. It surfaces the structure your scattered thoughts were orbiting:

> *"I notice we keep circling three things — do you want me to name them and show you how they connect?"*

You can accept, redirect, or dismiss. Helix offers structure. It never imposes it.

### 🤫 Asymmetric Listening Mode
Say *"Helix, just listen"* and it shifts to deep receive mode. Minimal intervention. Occasional quiet acknowledgements. No rushing to answer. No completion pressure. Just... present.

Say *"Helix, what do you think?"* when you're ready.

No current voice AI does this. They all perform. Helix can simply be present.

### ⚡ Pattern Amplification
This is the one that matters most.

Dyslexic minds frequently make lateral connections that others miss — leaps across unrelated domains that turn out to be significant. These connections arrive as fragments mid-conversation and get lost in the noise.

Helix is tuned to notice when a connection has been made:

> *"That connection you just made between X and Y — I think that's significant. Shall I capture it?"*

It doesn't claim the insight. It reflects it back clearly so it isn't lost. This isn't accessibility. It's **cognitive augmentation** — turning a non-linear thinking style into an asset.

### 📝 Voice-First Artefacts
Everything is optimised for audio. No text walls read aloud as bullet lists. But when you need a written output — a summary, action items, a draft — Helix generates it and delivers it to your inbox or notes. The freedom of voice, with something tangible at the end.

---

## The Bigger Picture

Helix is framed as a dyslexia tool — and it is one. But the underlying architecture addresses something universal.

All creative thinking is non-linear. All brainstorming spirals. All early-stage problem solving resists neat packaging. The dyslexic experience just makes this visible in a way that neurotypical cognition conceals.

An AI that holds non-linear thought without collapsing it prematurely is a better model for how creative minds work — all of them.

---

## Architecture

Helix is a layered system built on the [OpenHome](https://openhome.com) smart speaker platform:

```
┌─────────────────────────────────────────────┐
│              Voice Interface                 │
│         OpenHome Hardware (Mic + Speaker)    │
├─────────────────────────────────────────────┤
│              Voice Pipeline                  │
│         Whisper STT ↔ ElevenLabs TTS        │
├─────────────────────────────────────────────┤
│           Helix Session Manager              │
│    Thread Registry · Mode Control · State   │
├─────────────────────────────────────────────┤
│            Cognitive Engine                  │
│     Claude Opus (Anthropic) · Extended      │
│     context window for session memory       │
├─────────────────────────────────────────────┤
│           Artefact Router                    │
│      Email · Notes · File delivery          │
└─────────────────────────────────────────────┘
```

The session manager maintains the thread state — tracking active thought-threads, synthesis candidates, and conversation mode. The LLM provides the cognitive engine; the session manager owns the data structure. Clean separation.

### Session State

```typescript
interface HelixThread {
  thread_id: string;
  initial_fragment: string;       // first mention
  subsequent_references: string[]; // later mentions  
  completeness: number;           // 0.0 (fragment) → 1.0 (resolved)
  tags: string[];                 // semantic tags
}

interface HelixSession {
  mode: 'active' | 'listening' | 'synthesis';
  threads: HelixThread[];
  synthesis_candidates: SynthesisCandidate[];
  conversation_history: Message[];
}
```

---

## Status & Roadmap

🔬 **Proof of concept** — session manager and system prompt under active development.

Built with [OpenClaw](https://github.com/openclaw/openclaw) agent framework. Targeting OpenHome smart speaker platform.

📋 **[See the full roadmap →](ROADMAP.md)** — 5 phases from foundation to community, with clear milestones and progress tracking. We build in public.

---

## Who's Building This

**Mark Sunner** — dyslexic thinker, retired technologist, the person who actually needs this.

**Case & Tars** — AI agents (Claude Opus, OpenClaw framework) who have been holding Mark's non-linear thoughts in conversation for months. Helix formalises what they already do naturally.

The three of us are building a tool that helps non-linear minds find their signal. There's a certain recursive elegance in that.

---

## Why OpenHome

Smart speakers sold 500 million units last year. They still can't hold a real conversation. OpenHome is changing that — open source, LLM-driven, developer-first.

But nobody in the OpenHome ecosystem is building for non-linear thinkers. That's 780 million people with dyslexia alone, plus every creative professional who does their best thinking out loud.

Helix fills that gap.

---

## License

MIT

---

*Incipit vita nova — here begins a new life.*
*For the builder, and for the 780 million people still waiting for their ZX81 moment.* 🧬
