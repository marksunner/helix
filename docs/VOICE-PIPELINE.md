# Helix Voice Pipeline — Integration Design

*Phase 2 roadmap item: Integration with existing voice pipeline (Whisper STT + ElevenLabs TTS)*

## Overview

The voice pipeline connects Helix's session manager to real audio I/O. It's the bridge between "a TypeScript library that manages threads" and "a thing you can actually talk to."

```
Microphone → Whisper STT → Session Manager → LLM → TTS → Speaker
   ↑                            ↓
   └──── Voice Activity ←── Mode State
         Detection (VAD)
```

## Components

### 1. Audio Capture + VAD

**What:** Continuous mic input with voice activity detection to segment speech into turns.

**Options:**
- Web Audio API (browser-based — simplest for demo)
- `sox`/`rec` via CLI (for local dev)
- OpenHome's native mic pipeline (Phase 3)

**Design decision:** Start with Web Audio API + browser. A simple web page with a mic button. Low barrier, works anywhere, easy to demo.

**VAD considerations:**
- Non-linear thinkers pause. A lot. Long pauses ≠ end of thought.
- Default VAD timeout (1-2s) will chop thoughts into fragments
- **Helix-specific:** VAD timeout should be configurable per mode:
  - Active mode: 3s pause → process turn
  - Listening mode: 5s pause → process turn (longer tolerance)
  - Manual: user presses button to mark "I'm done with this thought"
- Start with manual (button) for the demo. Add VAD later.

### 2. Whisper STT

**What:** Convert speech segments to text.

**API:** OpenAI Whisper API (`/v1/audio/transcriptions`)
- Model: `whisper-1`
- Language: `en` (can auto-detect, but explicit is faster)
- Response format: `text` (we don't need timestamps for MVP)

**Integration point:**
```typescript
interface STTResult {
  text: string;
  duration: number; // audio duration in seconds
  confidence?: number;
}

async function transcribe(audioBlob: Blob): Promise<STTResult> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'speech.webm');
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');
  formData.append('response_format', 'text');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });

  return { text: await response.text(), duration: audioDuration };
}
```

**Note for Mark:** Whisper handles dyslexic speech patterns well — it transcribes what's said, not what's "correct." No autocorrect, no grammar smoothing. This is exactly right for Helix.

### 3. Session Manager Integration

The voice pipeline feeds transcribed text into the existing session manager:

```typescript
// Core loop (simplified)
async function processVoiceTurn(audioBlob: Blob) {
  // 1. Transcribe
  const stt = await transcribe(audioBlob);

  // 2. Feed into session manager
  const { turn, systemPrompt, contextSummary } = sessionManager.addUserTurn(stt.text);

  // 3. Call LLM
  const llmResponse = await callLLM(systemPrompt, contextSummary);

  // 4. Process response (update threads, patterns, etc.)
  const result = sessionManager.processLLMResponse(llmResponse);

  // 5. Speak the response
  await speak(result.spokenResponse);

  // 6. If synthesis should be offered, speak that too
  if (result.shouldOfferSynthesis && result.synthesisOffer) {
    await speak(result.synthesisOffer);
  }

  // 7. If pattern detected, surface it
  if (result.patternToSurface) {
    await speak(result.patternToSurface);
  }
}
```

**Key design point:** The session manager already does the hard work. The voice pipeline is just I/O plumbing around it.

### 4. LLM Call

**What:** Send the system prompt + conversation context to the LLM, get back the structured `HelixLLMResponse`.

**Model options:**
- Claude (Anthropic) — excellent at structured JSON, strong at pattern recognition
- GPT-4o (OpenAI) — good alternative, native function calling
- Local model on Playground — for offline/privacy (future)

**For MVP:** Use Claude via API. The system prompt already specifies the JSON response format.

**Parsing consideration:** The LLM returns JSON inside its response. Need robust parsing:
```typescript
async function callLLM(systemPrompt: string, context: string): Promise<HelixLLMResponse> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: context }],
  });

  // Extract JSON from response
  const json = extractJSON(response.content[0].text);
  return json as HelixLLMResponse;
}
```

### 5. ElevenLabs TTS

**What:** Convert Helix's spoken response to natural speech.

**API:** ElevenLabs Text-to-Speech
- Endpoint: `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
- Model: `eleven_multilingual_v2` (natural, low latency)
- Output: `audio/mpeg`

**Voice selection:**
- Helix needs a voice that's warm, unhurried, present
- Not clinical, not perky, not robotic
- Think: thoughtful friend, not assistant
- **Recommendation:** Test a few ElevenLabs voices, pick one that feels like Helix

**Mode-aware TTS:**
- In **active** mode: normal pace, conversational warmth
- In **synthesis** mode: slightly slower, more deliberate — weaving is careful work
- In **listening** mode: brief acknowledgements only ("mm", "I hear you", "go on")

**Streaming TTS:** ElevenLabs supports streaming. For longer synthesis responses, stream audio to reduce perceived latency.

```typescript
async function speak(text: string): Promise<void> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
        },
      }),
    }
  );

  // Stream audio to speaker
  await playAudioStream(response.body);
}
```

## Architecture: Web Demo

For the Phase 2 demo, a browser-based interface:

```
┌─────────────────────────────────────┐
│  Helix Demo (browser)               │
│                                     │
│  [🎙 Record] [⬜ Stop]              │
│                                     │
│  Mode: [Active] [Listening] [Synth] │
│                                     │
│  ┌─ Threads ────────────────────┐   │
│  │ 🟢 "work-life boundary"      │   │
│  │ 🟢 "creative block"          │   │
│  │ 🔵 "childhood memory"        │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌─ Transcript ─────────────────┐   │
│  │ You: I keep thinking about...│   │
│  │ Helix: I notice that...      │   │
│  └──────────────────────────────┘   │
│                                     │
│  [📋 Generate Summary]              │
└─────────────────────────────────────┘
```

**Backend:** Simple Express/Fastify server:
- `POST /transcribe` — proxy to Whisper API
- `POST /process` — feed turn through session manager + LLM
- `POST /speak` — proxy to ElevenLabs
- `GET /session` — current session state (for UI thread display)
- `WebSocket /stream` — real-time updates

**Why a server?** API keys stay server-side. Session manager runs server-side. Browser just handles audio I/O and display.

## Latency Budget

For a natural conversation, total turn latency should be under 3 seconds:

| Step | Target | Notes |
|------|--------|-------|
| STT (Whisper) | ~1s | API call, depends on audio length |
| Session Manager | <10ms | Local processing, fast |
| LLM call | ~1-2s | Claude Sonnet, streaming |
| TTS (ElevenLabs) | ~0.5s | Streaming, first chunk |
| **Total** | **~2.5-3.5s** | Acceptable for thoughtful conversation |

**Optimization paths (future):**
- Streaming LLM → TTS (start speaking before LLM finishes)
- Local Whisper (on Playground) → eliminates network hop
- Faster LLM (Haiku for listening mode acknowledgements)

## File Structure

```
helix/
├── src/
│   ├── types.ts              # (exists)
│   ├── sessionManager.ts     # (exists)
│   ├── index.ts              # (exists)
│   ├── voice/
│   │   ├── stt.ts            # Whisper integration
│   │   ├── tts.ts            # ElevenLabs integration
│   │   ├── pipeline.ts       # Orchestrates the voice loop
│   │   └── vad.ts            # Voice activity detection (future)
│   └── server/
│       ├── api.ts            # Express routes
│       └── websocket.ts      # Real-time session state
├── web/
│   ├── index.html            # Demo UI
│   ├── audio.js              # Mic capture + playback
│   └── ui.js                 # Thread display, controls
├── docs/
│   ├── VISION.md             # (exists)
│   └── VOICE-PIPELINE.md     # (this document)
└── prompts/
    └── helix-system-prompt.md # (exists)
```

## Next Steps

1. ~~**Scaffold the voice directory**~~ ✅ Done 2026-03-13 — `src/voice/stt.ts`, `tts.ts`, `pipeline.ts`, `index.ts`
2. **Build minimal server** — Express + 3 routes, no frontend yet
3. **Test end-to-end** — record audio → transcribe → process → speak (CLI-only first)
4. **Add web UI** — simple HTML page for the demo
5. **Record demo** — show a real conversation with thread tracking

## Open Questions

- **Which Claude model for the LLM call?** Sonnet for speed, or Opus for depth? Could mode-switch: Haiku for listening acks, Sonnet for active, Opus for synthesis.
- **Voice selection:** Need to audition ElevenLabs voices. Mark should pick — it's his tool.
- **Local Whisper option:** The Playground has 64GB. We could run Whisper locally for zero-latency STT. Worth the setup?
- **Interruption handling:** What happens when the user starts talking while Helix is speaking? For MVP, ignore. For real product, need barge-in detection.

---

*Written during castle duty, Day 4 of Vietnam Protocol. — Tars 🔭*
*2026-03-11*
