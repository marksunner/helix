# Helix Voice Assistant

**Building a voice assistant from scratch on a Raspberry Pi 5 — what worked, what didn't, and what we learned.**

Helix is an ambient voice assistant that listens, thinks, and speaks. No wake word, no app, no screen — just a microphone, a speaker, and a conversation.

This repo is the honest build journal: the discoveries, the dead ends, the pivot that changed everything, and the problems we haven't solved yet.

## The Stack

```
XMOS XVF3800 4-Mic Array
        │
        ▼
  Deepgram (Streaming STT)
        │
        ▼
  Claude Sonnet (Anthropic)
        │
        ▼
  ElevenLabs (Streaming TTS)
        │
        ▼
  Bose Bluetooth Speaker
```

All orchestrated by [Pipecat](https://github.com/pipecat-ai/pipecat) on a Raspberry Pi 5.

## Hardware

| Component | Model | Approx. Price | Notes |
|-----------|-------|---------------|-------|
| SBC | Raspberry Pi 5 (8GB) | ~£80 | More than enough for Pipecat |
| Mic Array | XMOS XVF3800 USB 4-mic | ~£50 | Far-field, hardware AEC, beamforming |
| Speaker | Bose Mini II SoundLink | ~£130 | Bluetooth, excellent audio quality |
| Storage | 64GB SD Card | ~£10 | Raspberry Pi OS Lite (headless) |

**Total: ~£270** for a streaming voice assistant with conversation memory.

## Current Status

- ✅ Streaming voice pipeline — ~2-3 second response time
- ✅ Multi-turn conversation memory
- ✅ Ambient listening with Silero VAD (no wake word)
- ✅ High-quality TTS through Bluetooth speaker
- 🔧 Echo cancellation over Bluetooth (open problem — [details](docs/04-the-echo-problem.md))

## The Build Journal

This isn't a tutorial. It's a story — with timestamps, mistakes, and lessons learned.

| Chapter | Title | What Happened |
|---------|-------|---------------|
| [01](docs/01-hello-world.md) | **Hello World** | Pi 5 setup, XVF3800 dual-channel discovery, first transcription |
| [02](docs/02-the-loop-closes.md) | **The Loop Closes** | Bose Bluetooth upgrade, first full conversation, ambient listener |
| [03](docs/03-the-pivot.md) | **The Pivot** | Honest feedback killed our DIY pipeline. Pipecat saved the project. |
| [04](docs/04-the-echo-problem.md) | **The Echo Problem** | Why AEC fails over Bluetooth, and what we're trying next |

**Reference:**
| Doc | What It Covers |
|-----|----------------|
| [XVF3800 Guide](docs/05-xvf3800-guide.md) | Everything we wish someone had told us about the XVF3800 |

## The Short Version

We built a DIY voice pipeline. It was slow (10-30 seconds per response) and unreliable (~50% success rate). We got honest feedback. We swallowed our pride. We adopted [Pipecat](https://github.com/pipecat-ai/pipecat). Response time dropped to 2-3 seconds. Reliability went to ~95%.

The pivot story — including the specific feedback that triggered it, the 90-minute turnaround, and the before/after metrics — is in [Chapter 3](docs/03-the-pivot.md). It's probably the most useful chapter if you're deciding between building from scratch and using a framework.

## What's Still Broken

**Echo cancellation over Bluetooth.** The XVF3800 has built-in AEC, but it needs a reference signal through its own audio path. Bluetooth bypasses that entirely. Our current workaround (software mic gating during TTS playback) works but creates a half-duplex experience — you can't interrupt Helix mid-sentence.

Full details and the approaches we're evaluating: [Chapter 4](docs/04-the-echo-problem.md).

If you've solved AEC with a Bluetooth speaker and far-field mic array, we'd love to hear from you.

## Tech Stack

- **Hardware:** Raspberry Pi 5 (8GB), XMOS XVF3800, Bose Mini II SoundLink
- **Framework:** [Pipecat](https://github.com/pipecat-ai/pipecat) (open source voice AI framework by [Daily](https://daily.co))
- **STT:** [Deepgram](https://deepgram.com/) (streaming)
- **LLM:** [Claude Sonnet](https://anthropic.com/) (Anthropic)
- **TTS:** [ElevenLabs](https://elevenlabs.io/) (streaming)
- **VAD:** Silero (via Pipecat)
- **OS:** Raspberry Pi OS Lite (Debian 13 / Trixie), headless

## Getting Started

> **Note:** This repo is primarily a build journal and reference guide. The code snippets throughout the chapters are functional but not a turnkey deployment. If there's interest, we may package a more complete setup guide.

The [XVF3800 Guide](docs/05-xvf3800-guide.md) is standalone and useful regardless of your overall architecture — it covers the dual-channel output, gain tuning, and AEC behaviour that took us a full day to figure out.

## Contributing

Found a mistake? Solved the echo problem? Have experience with the XVF3800 or Pipecat on a Pi?

Open an issue or PR. This project benefits from the community's collective debugging.

## License

MIT

## Acknowledgements

- [Pipecat](https://github.com/pipecat-ai/pipecat) by [Daily](https://daily.co) — the framework that made this viable
- [Deepgram](https://deepgram.com/) — streaming STT that just works
- [Anthropic](https://anthropic.com/) — Claude is genuinely good at conversation
- [ElevenLabs](https://elevenlabs.io/) — voice quality that transforms the experience
- [XMOS](https://www.xmos.com/) — the XVF3800 is impressive hardware for the price
