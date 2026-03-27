# XVF3800 USB 4-Mic Array: What Nobody Tells You
*A practical guide for voice assistant builders*

The XMOS XVF3800 is an excellent far-field microphone array for the price. Four MEMS microphones, hardware beamforming, acoustic echo cancellation, and noise suppression — all on-chip. It's designed for conference systems and smart speakers.

This guide covers the things we learned the hard way while building a voice assistant on a Raspberry Pi 5.

## The Dual-Channel Output

The XVF3800 presents as a stereo USB audio device. **These are not left and right channels.** They are two fundamentally different audio processing modes:

| Channel | Position | Mode | Best For |
|---------|----------|------|----------|
| Channel 0 | Left (FL) | Conference | Human listeners, playback |
| Channel 1 | Right (FR) | ASR | Speech recognition, STT engines |

**The ASR channel (FR/Right) is what you want for transcription.** It's louder, has a cleaner speech signal, and is optimised for machine consumption rather than human ears.

If you're feeding audio to Whisper, Deepgram, Google STT, or any other speech recognition engine, extract the right channel:

```bash
# Extract ASR channel from stereo recording
ffmpeg -i recording.wav -af "pan=mono|c0=FR" for_transcription.wav
```

If you skip this step and feed the full stereo (or the left channel) to your STT engine, you'll get inconsistent results — sometimes good, sometimes garbled, sometimes empty. This is not a bug in your STT engine. It's the wrong input.

## Gain Tuning

Default gain settings are conservative — designed for a quiet conference room. For a home environment (ambient noise, people at varying distances, background TV, dogs), you'll likely need to adjust:

### Key Parameters

| Parameter | Default | Recommended | What It Does |
|-----------|---------|-------------|--------------|
| `AEC_ASROUTGAIN` | 1.0 | 3.0–5.0 | ASR channel output gain. Higher = louder speech signal for STT |
| `PP_AGCMAXGAIN` | 64 | 80–100 | Maximum automatic gain. Higher = more boost for quiet speakers |
| `AEC_ASROUTONOFF` | 1 | 1 | Enables ASR channel output. Make sure this is on |

### How to Adjust

The XVF3800 includes a host control tool. On Raspberry Pi:

```bash
cd ~/reSpeaker_XVF3800_USB_4MIC_ARRAY/host_control/rpi_64bit

# Set ASR output gain
sudo ./xvf_host AEC_ASROUTGAIN 5.0

# Set max auto-gain
sudo ./xvf_host PP_AGCMAXGAIN 100

# CRITICAL: Save to flash memory (survives reboot)
sudo ./xvf_host SAVE_CONFIGURATION 1

# Verify all current settings
sudo ./xvf_host -d
```

⚠️ **Always run `SAVE_CONFIGURATION 1` after making changes.** Without this, your settings reset on every reboot. This is the most common gotcha with the XVF3800.

### Tuning Tips

- Start with `AEC_ASROUTGAIN` at 3.0 and increase if your STT engine is getting empty/quiet transcriptions
- If you're getting clipping (distorted audio), reduce the gain
- `PP_AGCMAXGAIN` at 100 works well for rooms where people speak at varying distances
- Test with your actual STT engine, not just by listening — what sounds fine to you may be too quiet for Whisper

## Acoustic Echo Cancellation (AEC)

The XVF3800 has built-in AEC. This is critical for voice assistants — without it, the microphone picks up the assistant's own voice from the speaker, creating a feedback loop.

### How AEC Works

The XVF3800's AEC compares the microphone input against a **reference signal** — audio that it knows was played through the speaker. By subtracting the reference from the mic input, it isolates the human voice from the echo.

### The Bluetooth Problem

**AEC requires the reference signal to come through the XVF3800's own audio path.**

If you play audio through a Bluetooth speaker (as we do), the sound goes directly from the Pi's Bluetooth adapter to the speaker, bypassing the XVF3800 entirely. The AEC has no reference signal. It doesn't know what was just played. It can't cancel the echo.

```
WITH AEC REFERENCE (line-out through XVF3800):
  Pi → XVF3800 speaker out → Speaker
  Speaker sound → XVF3800 mic → AEC subtracts reference → Clean audio ✅

WITHOUT AEC REFERENCE (Bluetooth):
  Pi → Bluetooth → Speaker
  Speaker sound → XVF3800 mic → AEC has no reference → Echo passes through ❌
```

### Workarounds

1. **Use the XVF3800's own line-out** instead of Bluetooth. You lose audio quality (16kHz vs 48kHz) but gain working echo cancellation.

2. **Software gating:** Mute the STT input while TTS is playing, with a buffer for tail audio. Crude but effective if you can tolerate the latency.

3. **Route a copy of the Bluetooth audio** through the XVF3800's line-in as a reference signal. We haven't tested this yet but it should theoretically restore AEC functionality.

This is currently an unsolved problem in our setup and the main open challenge.

## PipeWire / PulseAudio Integration

On modern Raspberry Pi OS (Bookworm+), PipeWire is the default audio server with PulseAudio compatibility.

### Common Gotchas

- **Default device confusion:** If you pair a Bluetooth speaker, PipeWire may set the Bluetooth device as the default *input* (mic) as well as output. Your STT suddenly gets silence because it's listening to the Bose's non-existent microphone instead of the XVF3800.

```bash
# Check current default source (input)
pactl info | grep "Default Source"

# Set XVF3800 as default input
pactl set-default-source <xvf3800-source-name>

# List all sources to find the right name
pactl list sources short
```

- **Sample rate mismatch:** The XVF3800 operates at 16kHz natively. PipeWire can resample, but if you're doing your own audio processing, be aware of what rate you're actually getting.

- **Channel count:** Some applications request mono input. PipeWire may downmix the XVF3800's stereo (Conference + ASR) to mono, losing the channel separation you need. If your STT results are inconsistent, check whether you're still getting the ASR channel or a Conference+ASR mix.

## Speaker Output Format

If you're using the XVF3800's built-in speaker output (line-out), it only accepts:
- **Sample rate:** 16kHz
- **Format:** S16_LE (signed 16-bit, little-endian)
- **Channels:** Stereo (2)

Any other format results in silence with no error message.

```bash
# Convert any audio to XVF3800 speaker format
ffmpeg -i input.mp3 -ar 16000 -ac 2 -sample_fmt s16 -f wav output.wav

# Optional: boost volume (built-in speakers are quiet)
ffmpeg -i input.mp3 -ar 16000 -ac 2 -filter:a 'volume=3.0' -sample_fmt s16 -f wav output.wav
```

## Quick Reference

```bash
# Record from XVF3800 (ALSA direct)
arecord -D hw:2,0 -f S16_LE -r 16000 -c 2 -d 10 recording.wav

# Extract ASR channel
ffmpeg -i recording.wav -af "pan=mono|c0=FR" asr_audio.wav

# Play through XVF3800 line-out
aplay -D hw:2,0 -f S16_LE -r 16000 -c 2 output.wav

# Dump all XVF3800 parameters
cd ~/reSpeaker_XVF3800_USB_4MIC_ARRAY/host_control/rpi_64bit
sudo ./xvf_host -d

# Key parameters to check
# AEC_ASROUTONOFF → should be 1
# AEC_ASROUTGAIN → your tuned value
# PP_AGCMAXGAIN → your tuned value
# VERSION → firmware version
```

## Further Reading

- [XMOS XVF3800 Product Page](https://www.xmos.com/xvf3800/)
- [Pipecat — Open Source Voice AI Framework](https://github.com/pipecat-ai/pipecat)
- [Deepgram — Streaming STT](https://deepgram.com/)

---

*This guide is part of the [Helix Voice Assistant](../README.md) project — an honest build log of creating a voice assistant from scratch on a Raspberry Pi 5.*
