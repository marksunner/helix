# Helix Build Journal

An honest account of building a voice assistant from scratch on a Raspberry Pi 5.

This isn't a polished tutorial. It's a record of what we tried, what broke, and what we learned. The goal is to save someone else the days we spent discovering things that weren't in any documentation.

## The Journey

1. **[Hello World](01-hello-world.md)** — Day 1: Getting a Pi to hear and speak. The XVF3800 dual-channel discovery that cost us most of a day.

2. **[The Loop Closes](02-the-loop-closes.md)** — Day 2: First full conversation loop. Why speaker quality matters more than you think.

3. **[The Pivot](03-the-pivot.md)** — Days 3-4: When honest feedback broke the plateau. DIY pipeline → Pipecat, 10-30s latency → 2-3s.

4. **[The Echo Problem](04-the-echo-problem.md)** — The challenge we haven't solved yet. Why Bluetooth defeats hardware AEC.

5. **[XVF3800 Guide](05-xvf3800-guide.md)** — Standalone reference. Everything we learned about the XVF3800 in one place.

## Hardware

- Raspberry Pi 5 (8GB)
- XMOS XVF3800 USB 4-Mic Array
- Bose Mini II SoundLink (Bluetooth)

## Software Stack

- **STT:** Deepgram Nova-3 (streaming)
- **LLM:** Claude (Anthropic)
- **TTS:** ElevenLabs
- **Framework:** [Pipecat](https://github.com/pipecat-ai/pipecat)

## Contributing

Found a solution to the echo problem? Have XVF3800 tips we missed? [Open an issue](https://github.com/marksunner/helix/issues) — we'd love to hear from you.
