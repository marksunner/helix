# Chapter 2: The Loop Closes
*Day 2 — March 24, 2026*

## The Goal

Turn yesterday's collection of working parts into a conversation. Hear → Think → Speak, in a loop, without human intervention between steps.

And upgrade that terrible USB speaker.

## The Bose Upgrade

A Bose Mini II SoundLink appeared. Paired via Bluetooth:

```bash
bluetoothctl
> scan on
# Wait for the Bose to appear
> pair <SPEAKER_MAC_ADDRESS>
> trust <SPEAKER_MAC_ADDRESS>
> connect <SPEAKER_MAC_ADDRESS>
```

The difference was dramatic. The USB speaker through the XVF3800's 16kHz line-out sounded like a phone call from 2005. The Bose over Bluetooth, routed through PipeWire at 48kHz, sounded like an actual voice in the room. The TTS voice we were using (ElevenLabs' "Archer" — warm, slightly British, with genuine gravitas) suddenly came alive.

Mark's reaction: *"THAT SOUNDS SO SO GOOD!!!!"*

The hardware lesson: audio output quality isn't a nice-to-have for a voice assistant. It fundamentally changes whether the experience feels like talking to a device or talking to a presence. Invest in the speaker.

## Closing the Loop

Yesterday's pipeline was manual: run each step from an SSH terminal. Today's goal was automation — a script that listens for speech, transcribes it, generates a response, and speaks it back.

The architecture (still sequential, still slow):

```
1. XVF3800 mic captures audio
2. arecord writes WAV file on Pi
3. Extract ASR channel (FR) with ffmpeg
4. SCP the WAV to a Mac for transcription
5. Whisper STT → text
6. Send text to Claude (Anthropic API) → response text
7. Send response to ElevenLabs → MP3
8. SCP the MP3 back to Pi
9. ffmpeg convert to Bluetooth-compatible format
10. paplay through Bose speaker
```

Ten steps. Two network transfers. Multiple API calls in sequence. It worked — and the first time Helix replied to a spoken question through that Bose speaker, the room went quiet for a moment. Something about hearing a voice respond to yours, even with a long delay, crosses a threshold that text on a screen doesn't.

But let's be honest about the numbers: **10-30 seconds per exchange.** The variance depended on how long Claude took to generate, how large the audio file was, and whether the network felt cooperative. Sometimes it was almost conversational. Sometimes you'd forgotten what you asked.

## Building an Ambient Listener

Mark raised the key question: *"The 'speak now, you have 10 seconds' approach is proof-of-concept, not product."*

He referenced demos from OpenHome — always listening, no wake word, natural conversation flow. Could we build that?

We tried. The result was `helix_listener.py` — a Python script running continuously on the Pi, using Voice Activity Detection (VAD) to detect when someone was speaking:

```python
# Simplified concept (actual implementation was more involved)
import webrtcvad

vad = webrtcvad.Vad(aggressiveness=2)  # 0-3, higher = fewer false positives

# Continuously read audio frames from the XVF3800
# When VAD detects speech:
#   Buffer the audio
#   When speech stops (silence threshold):
#     Save buffer to WAV
#     Extract ASR channel
#     Send for transcription
```

### Why webrtcvad and Not Silero?

Our first choice was Silero VAD — modern, neural-network-based, excellent accuracy. But it depends on `torchaudio`, which on a Raspberry Pi tries to build with CUDA support. On ARM. With no GPU.

```
ERROR: Could not build wheels for torchaudio
```

We could have fought this with custom builds, but `webrtcvad` (Google's WebRTC VAD, C-based, lightweight) installed in seconds and ran with negligible CPU overhead. On a resource-constrained Pi, "it installs and runs" beats "it's theoretically better" every time.

### How It Went

The ambient listener worked. First detection: someone said *"Anybody listening?"* from across the room, and the Pi captured it, transcribed it, and logged it correctly.

But it also triggered on:
- Dogs barking
- The kettle boiling
- A door closing firmly
- The TV in the background

VAD aggressiveness level 2 was catching too much ambient noise. Level 3 reduced false positives but occasionally missed the start of speech. There's no magic number — it depends on your environment.

We ran it in a `screen` session so it survived SSH disconnections:
```bash
screen -S helix-listener
python3 helix_listener.py
# Ctrl+A, D to detach
# screen -r helix-listener to reattach
```

Transcripts were saved to `~/helix_transcripts/` with a `latest.json` file for easy pickup by the response pipeline.

## The Twin Collision

Here's a problem we didn't anticipate: we had two AI agents (running on separate Macs) both trying to respond to Helix simultaneously. Both sent audio files. Both played at the same time. Through the same speaker. The result was two voices talking over each other — exactly as jarring as it sounds.

The fix was simple but important: **one operator at a time.** We formalised that one agent has lead on Helix configuration and commands. The other backs off unless explicitly needed.

If you're building a system where multiple agents or services can send commands to a shared device, solve the coordination problem *before* it happens in production. Mutex locks, turn-taking, a queue — anything. Concurrent writes to a single speaker are always wrong.

## What Broke (Summary)

| Problem | Cause | Fix |
|---------|-------|-----|
| Bluetooth speaker goes idle | Auto-sleep between playback sessions | Reconnect before each playback (or send periodic silent audio) |
| torchaudio won't build on Pi | CUDA dependency on ARM | Switched to webrtcvad |
| False VAD triggers | Kitchen noise, dogs, TV | Aggressiveness tuning (no perfect answer) |
| Two voices at once | No coordination between agents | Formalised single-operator rule |
| 10-30s response time | Sequential pipeline (record → transfer → transcribe → generate → transfer → play) | This is the big one. See Chapter 3. |

## What We Learned

1. **Speaker quality changes everything.** The jump from a USB speaker to a Bose Bluetooth unit wasn't incremental — it changed the entire character of the interaction. Budget accordingly.

2. **"It works" and "it's usable" are very different.** Our pipeline worked. Every component did its job. But 10-30 seconds of silence between speaking and hearing a response isn't a conversation — it's leaving a voicemail. The architecture was fundamentally wrong, not just slow.

3. **Ambient listening is hard.** VAD is a starting point, not a solution. Real-world environments are noisy, unpredictable, and full of things that sound like speech but aren't. This is why products like Alexa use wake words — it's an engineering trade-off, not laziness.

4. **Coordinate your agents.** If multiple services can write to the same output device, they will. At the worst possible time. Build the coordination layer before you need it.

## End of Day 2

We had a Raspberry Pi with a quality Bluetooth speaker, an ambient listener that could detect speech in a room, and a complete (if slow) voice pipeline. Mark could walk into the room, say something, and eventually hear a response through the Bose.

But "eventually" was doing a lot of heavy lifting in that sentence. The sequential pipeline was the bottleneck, and no amount of optimisation within that architecture was going to fix it.

It was time for honest feedback.

**← [Chapter 1 — Hello World](01-hello-world.md) | [Chapter 3 — Honest Feedback →](03-honest-feedback.md)**
