# Chapter 1: Hello World
*Day 1 — March 23, 2026*

## The Goal

Get a Raspberry Pi to hear us and talk back.

That's it. No streaming, no ambient listening, no fancy pipeline. Just: speak into a microphone, get words out of a speaker. Everything else comes later.

## The Hardware

- **Raspberry Pi 5** (8GB) — Raspberry Pi OS Lite 64-bit, headless via SSH
- **XMOS XVF3800 USB 4-Mic Array** — far-field microphone with built-in echo cancellation
- **A cheap USB speaker** — temporary, just to prove the concept

The XVF3800 is a serious piece of kit for the price. Four MEMS microphones in a square array, hardware-based beamforming, acoustic echo cancellation (AEC), and noise suppression — all processed on-chip. It was designed for conference systems and smart speakers, which made it an obvious choice for a voice assistant.

What wasn't obvious was how its output channels actually work.

## The XVF3800 Dual-Channel Discovery

The XVF3800 presents itself as a stereo USB audio device. Two channels of output. The documentation doesn't make it particularly clear what those channels are, so we assumed it was just... stereo audio. Left and right. Same content.

It's not.

**Channel 0 (Left / FL):** Conference mode — processed audio optimised for human listeners. Lower volume, more aggressive noise cancellation. Good for playback, bad for transcription.

**Channel 1 (Right / FR):** ASR mode — specifically optimised for Automatic Speech Recognition. Louder, cleaner speech signal, less aggressive processing. This is what you want to feed to your STT engine.

We discovered this the hard way. Our first Whisper transcriptions were inconsistent — sometimes good, sometimes garbled, sometimes just silence. Turns out we were using the Conference channel. Switching to the ASR channel fixed everything:

```bash
# Extract the ASR channel (right/FR) from the stereo recording
ffmpeg -i recording.wav -af "pan=mono|c0=FR" transcribe_this.wav
```

**If you're using an XVF3800 for voice recognition: use the FR channel.** This one detail cost us most of Day 1.

## Gain Tuning

Out of the box, the ASR channel gain is conservative. Fine for a quiet conference room, too quiet for a living room with dogs and a treadmill in the next room.

The XVF3800 has a host control tool that lets you adjust parameters and save them to flash memory. The two that made the biggest difference:

```bash
# Navigate to the host control binary
cd ~/reSpeaker_XVF3800_USB_4MIC_ARRAY/host_control/rpi_64bit

# Boost ASR output gain (default: 1.0, we use 5.0)
sudo ./xvf_host AEC_ASROUTGAIN 5.0

# Increase auto-gain ceiling (default: 64, we use 100)
sudo ./xvf_host PP_AGCMAXGAIN 100

# IMPORTANT: Save to flash so settings survive reboot
sudo ./xvf_host SAVE_CONFIGURATION 1
```

Without `SAVE_CONFIGURATION`, your carefully tuned gains reset every time the Pi reboots. We learned this one the annoying way.

To dump all current parameters and verify your settings:
```bash
sudo ./xvf_host -d
```

## First Transcription

With the right channel selected and gains adjusted, we needed an STT engine. We started with OpenAI's Whisper running locally on a separate Mac (the Pi can run it, but it's slow):

1. Record audio on the Pi using `arecord`
2. Extract the ASR channel with `ffmpeg`
3. Transfer to the Mac via `scp`
4. Run Whisper
5. Get text back

Clunky? Absolutely. But it worked. First successful transcription from across the room — clean, accurate, no retries. The ASR channel + gain tuning combination was doing its job.

## First Speech

For the output side, we went straight to ElevenLabs' API. Generate an MP3, convert it to the format the speaker accepts, play it back.

This is where the USB speaker taught us a lesson about audio format assumptions.

The speaker we had connected through the XVF3800's line-out only accepted one format: **16kHz, signed 16-bit little-endian, stereo**. Anything else — different sample rate, different bit depth, mono — resulted in silence. No error. Just... nothing.

```bash
# Convert any audio to the format the speaker actually accepts
ffmpeg -i response.mp3 -ar 16000 -ac 2 -sample_fmt s16 -f wav playback.wav

# Play it (ALSA)
aplay -D hw:2,0 playback.wav
```

The speakers were also quiet. Very quiet. A volume boost in ffmpeg helped:
```bash
ffmpeg -i response.mp3 -ar 16000 -ac 2 -filter:a 'volume=3.0' playback.wav
```

## What Broke (Summary)

| Problem | Cause | Fix |
|---------|-------|-----|
| Inconsistent STT results | Using Conference channel instead of ASR | Extract FR channel with ffmpeg |
| Transcription too quiet | Default ASR gain too conservative | `AEC_ASROUTGAIN` 1.0 → 5.0 |
| Settings lost on reboot | Didn't save to flash | `SAVE_CONFIGURATION 1` |
| Speaker plays silence | Wrong audio format (expected 16kHz S16_LE stereo) | ffmpeg conversion |
| Silero VAD won't install | torchaudio has CUDA dependency, even on ARM | Abandoned — switched to webrtcvad later |

## What We Learned

1. **Read the datasheet, but verify the channels yourself.** The XVF3800 dual-channel output isn't a bug, it's a feature — but it's easy to miss and costs you a full day of debugging bad transcriptions.

2. **Never assume audio "just plays."** Check sample rate, bit depth, channel count, and encoding before debugging anything else. The silence-with-no-error failure mode is particularly cruel.

3. **Save your configuration.** Any hardware that has tuneable parameters and a "save to persistent storage" command — use it immediately. Future-you will thank present-you after the next power cut.

4. **Start with the simplest possible pipeline.** Our Day 1 pipeline was absurdly sequential: record → transfer → transcribe → generate → transfer → play. It took 30+ seconds per exchange. But it proved every component worked independently, which made debugging the integrated pipeline much easier later.

## End of Day 1

We had a Raspberry Pi that could hear a human voice from across a room, transcribe it accurately, generate a spoken response, and play it back through a speaker. The round trip took about 30 seconds and involved manually running commands over SSH.

Not exactly Jarvis. But the building blocks were all there.

**Next: [Chapter 2 — The Loop Closes →](02-the-loop-closes.md)**
