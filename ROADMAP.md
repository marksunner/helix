# Helix Roadmap 🧬

A living document tracking where Helix is, where it's going, and what's next.

---

## Phase 1 — Foundation ✅

*Completed March 2026*

- [x] Core insight identified: voice AI assumes linear thought; 780M dyslexic thinkers need something different
- [x] Session manager architecture (490+ lines TypeScript)
- [x] Thread tracking with completeness scoring
- [x] Synthesis candidate detection with confidence thresholds
- [x] Pattern amplification system
- [x] Mode switching: Active / Listening / Synthesis
- [x] Full type system (`HelixThread`, `HelixSession`, `SynthesisCandidate`, `PatternDetection`)
- [x] LLM response contract — session manager owns state, LLM observes
- [x] System prompt: the "listening posture" documented
- [x] Vision document
- [x] Public repository

**Key architectural decision:** The session manager owns all state. The LLM describes what it observes; we parse and update. This prevents JSON drift across long sessions and is more robust than asking the LLM to maintain structured data directly.

---

## Phase 2 — Proof of Concept 🔨

*In progress — March 2026*

- [x] Unit tests for thread tracking, synthesis timing, and mode switching *(48 tests, all passing — branch `phase2/unit-tests`)*
- [x] Integration with existing voice pipeline (Whisper STT + ElevenLabs TTS) *(scaffold complete — STT, TTS, and orchestrator modules in `src/voice/`)*
- [x] Express server routes — HTTP API for voice and text turns *(POST /api/turn, /api/text-turn, GET /api/session)*
- [ ] First real Helix conversation — demonstrate thread holding and pattern amplification with a live user
- [ ] Demo recording showing the listening posture in action
- [ ] Artefact generation — session summary output after a conversation
- [ ] Refined system prompt from real usage data
- [ ] `cognitiveNotes` personalisation — calibrate for individual users
- [ ] Tagged release: `v0.1.0`

**Goal:** A working voice conversation where Helix holds threads, notices patterns, and generates a structured summary — proving the concept without custom hardware.

---

## Phase 3 — OpenHome Integration 🏠

*Target: Q2 2026 (pending dev kit)*

- [ ] Port session manager to OpenHome Ability format
- [ ] On-device voice pipeline configuration
- [ ] Wake word integration ("Helix, just listen")
- [ ] Session persistence across conversations
- [ ] Real-time thread state display (companion app or web dashboard)
- [ ] Optimise synthesis timing for natural conversation rhythm
- [ ] Multi-session memory — threads that persist across days

**Goal:** Helix running natively on OpenHome hardware as a standalone Ability, demonstrating what voice AI looks like when it's designed for non-linear minds.

---

## Phase 4 — Real-World Testing 🧪

*Target: Q3 2026*

- [ ] User testing with dyslexic participants
- [ ] Accessibility review — does the listening posture genuinely reduce cognitive load?
- [ ] Pattern amplification validation — are the connections it surfaces actually valuable?
- [ ] Synthesis timing calibration from real usage patterns
- [ ] Feedback loop: user experience → system prompt refinement → better experience
- [ ] Performance benchmarking across session lengths (30 min, 1 hour, 2+ hours)

**Goal:** Evidence that Helix works for real people, not just its creators. Quantitative and qualitative data on whether the non-linear cognition interface delivers genuine value.

---

## Phase 5 — Community & Open Source 🌍

*Target: Q3-Q4 2026*

- [ ] Contributing guidelines (`CONTRIBUTING.md`)
- [ ] Accessibility testing framework — how to evaluate voice AI for neurodivergent users
- [ ] Localisation considerations (Helix for non-English speakers)
- [ ] Community system prompt library — different listening postures for different cognitive styles
- [ ] Integration guides for other voice platforms
- [ ] Published research: "Designing Voice AI for Non-Linear Cognition"

**Goal:** Helix becomes a reference implementation for how voice AI should work for neurodivergent users — not just a product, but a pattern that others can adopt.

---

## Principles

Throughout all phases:

- **Voice-first, always.** Text is a delivery format, not the interface.
- **The non-linearity is the signal.** Never collapse, filter, or "fix" non-linear input.
- **Hold, don't claim.** Insights belong to the user. Helix reflects; it doesn't take credit.
- **Open by default.** Build in public. Share what we learn.
- **Designed by someone who needs it.** The creator is the first user. That feedback loop is the moat.

---

*Last updated: March 2026*
*Repository: [github.com/marksunner/helix](https://github.com/marksunner/helix)*
