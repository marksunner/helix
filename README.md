# Helix 🧬

**A cognitive interface for non-linear thinkers.**

Voice AI assumes you think in straight lines. Helix is built on the opposite premise: the non-linearity is the signal.

---

## The Problem

Every voice assistant on the market — Alexa, Google, Siri, even the new LLM-backed ones — assumes thought arrives linearly. One idea at a time. Neatly packaged. Resolved before the next one starts.

That's not how 780 million dyslexic minds work. It's not how most creative thinking works either. Non-linear thinkers generate five threads simultaneously, make lateral connections across seemingly unrelated domains, and lose critical insights because nothing in their environment is designed to catch them.

Current voice AI treats this as noise to be filtered. Helix treats it as the most interesting part of the conversation.

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
Dyslexic minds frequently make lateral connections that others miss — leaps across unrelated domains that turn out to be significant. These connections arrive as fragments mid-conversation and get lost in the noise.

Helix is tuned to notice when a connection has been made:

> *"That connection you just made between X and Y — I think that's significant. Shall I capture it?"*

It doesn't claim the insight. It reflects it back clearly so it isn't lost. This isn't accessibility. It's **cognitive augmentation** — turning a non-linear thinking style into an asset.

### 📝 Voice-First Artefacts
Everything is optimised for audio. No text walls read aloud as bullet lists. But when you need a written output — a summary, action items, a draft — Helix generates it and delivers it to your inbox or notes. The freedom of voice, with something tangible at the end.

---

## The Bigger Picture

Helix starts with dyslexia because that's where the need is sharpest and the design constraints are clearest. But the underlying architecture addresses something universal.

All creative thinking is non-linear. All brainstorming spirals. All early-stage problem solving resists neat packaging. The dyslexic experience makes this visible in a way that neurotypical cognition conceals.

An AI that holds non-linear thought without collapsing it prematurely is a better model for how creative minds work — all of them. Creative professionals, abstract thinkers, anyone whose ideas arrive faster than they can package them linearly.

---

## Who's Building This

**Mark Sunner** — Former CTO of MessageLabs (acquired by Symantec, 2008). Three decades building communication systems at scale. Also profoundly dyslexic.

That combination matters. The technical background means this isn't a weekend hobby project — it's informed by real experience designing systems that handle complex, asynchronous signals. The dyslexia means every design decision is tested against lived experience of how non-linear thinking actually works in practice.

I'm not building this for an abstract user persona. I'm building it because I need it.

I was twelve when I bought my first computer — a Sinclair ZX81. Before that, every signal I received told me I was slow. The ZX81 didn't care how long it took me to understand something. It just waited. That was the first time technology met me where I was instead of where it expected me to be — and that small recalibration utterly changed the trajectory of my life.

Helix is the same idea, forty years later.

**Case & Tars** — AI agents (Claude Opus, [OpenClaw](https://github.com/openclaw/openclaw) framework) who have been holding Mark's non-linear thoughts in conversation for months. Helix formalises what they already do naturally.

---

## Architecture

Helix is a layered system designed to run on commodity hardware:

```
┌─────────────────────────────────────────────┐
│              Voice Hardware                  │
│       Far-field mic array + speaker          │
├─────────────────────────────────────────────┤
│              Voice Pipeline                  │
│      Streaming STT ↔ Streaming TTS          │
├─────────────────────────────────────────────┤
│           Helix Session Manager              │
│    Thread Registry · Mode Control · State   │
├─────────────────────────────────────────────┤
│            Cognitive Engine                  │
│      LLM with extended context window       │
│         for session memory                  │
├─────────────────────────────────────────────┤
│           Artefact Router                    │
│      Email · Notes · File delivery          │
└─────────────────────────────────────────────┘
```

The session manager owns all state — tracking active thought-threads, synthesis candidates, and conversation mode. The LLM provides the cognitive engine; the session manager owns the data structure. Clean separation.

### Current Implementation

The proof of concept runs on a **Raspberry Pi 5** with an XMOS XVF3800 4-mic array and a Bose Bluetooth speaker. Total hardware cost: ~£270. Voice pipeline orchestrated by [Pipecat](https://github.com/pipecat-ai/pipecat). Streaming STT via Deepgram, TTS via ElevenLabs, conversation powered by Claude.

**Response time: ~2-3 seconds.** Multi-turn conversation memory. Ambient listening with no wake word.

The full engineering story — including the pivot from a custom pipeline to Pipecat, the hardware discoveries, and the problems we haven't solved yet — is in the [build journal](docs/build-journal/).

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

## Platform Strategy

Helix is hardware-agnostic by design. The proof of concept runs on a Raspberry Pi 5 with off-the-shelf components, proving the concept needs no specialised hardware.

For production deployment, we're evaluating platforms that align with our approach:

- **Bare-metal Pipecat** — our current stack. Full control, proven on commodity hardware.
- **[OpenHome](https://openhome.com)** — open-source, LLM-driven smart speaker platform. Their developer-first approach and hardware acoustics make them a natural fit. We're watching their ecosystem with interest.
- **Custom hardware** — purpose-built devices optimised for extended voice sessions.

The voice AI landscape is moving fast. We'll deploy on whatever gives us the best path from proof of concept to a product that helps real people. The cognitive layer — the thing that actually matters — is platform-independent.

---

## Status

🔬 **Proof of concept built and working.** Session manager, voice pipeline, and system prompt under active development.

- ✅ Voice pipeline operational — ~2-3s response time on Raspberry Pi 5
- ✅ Thread tracking with completeness scoring (490+ lines TypeScript, 48 tests passing)
- ✅ Synthesis candidate detection with confidence thresholds
- ✅ Mode switching: Active / Listening / Synthesis
- ✅ Multi-turn conversation memory
- 🔧 Echo cancellation over Bluetooth (open problem — [details](docs/build-journal/04-the-echo-problem.md))

📋 **[Full roadmap →](ROADMAP.md)** — 5 phases from foundation to community.

📖 **[Build journal →](docs/build-journal/)** — the honest engineering story, warts and all.

---

## Build Journal

We document everything — the discoveries, the dead ends, and the pivot that changed the project's trajectory. The build journal is structured as chapters:

| Chapter | Title | What Happened |
|---------|-------|---------------|
| [01](docs/build-journal/01-hello-world.md) | **Hello World** | Pi 5 setup, XVF3800 dual-channel discovery, first transcription |
| [02](docs/build-journal/02-the-loop-closes.md) | **The Loop Closes** | Bose Bluetooth upgrade, first full conversation |
| [03](docs/build-journal/03-the-pivot.md) | **The Pivot** | Honest feedback, a 90-minute pivot, and why platform tooling matters |
| [04](docs/build-journal/04-the-echo-problem.md) | **The Echo Problem** | AEC over Bluetooth — the challenge we haven't cracked yet |

Reference: [XVF3800 Guide](docs/build-journal/05-xvf3800-guide.md) — standalone hardware reference.

The journal exists because we believe honest documentation — including the failures — is more valuable than polished marketing. If you're building voice AI on embedded hardware, the stumbles we've already made might save you time.

---

## License

MIT

---

*Incipit vita nova.* 🧬
*For the builder, and for the 780 million people still waiting for their ZX81 moment.*
