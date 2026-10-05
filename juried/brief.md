Media: none (SVG avatars, typography, motion and real-time canvas only)

# Brief: PULSE

**Big idea:** The room has a heartbeat. PULSE is a live signal: every round is a beat, every player is a
trace on the monitor, and every answer is a spike. The UI is an instrument panel for a party: a calm warm-black
field, one vermilion signal line, and eight player traces in their own colours.

**Signature moment:** *The Pulse Line.* A single glowing waveform runs along the bottom of every screen. It
idles as a slow heartbeat in the lobby. During a round, it is the timer, flattening as time runs out, and it
spikes in a player's colour the instant they lock in, so you *see* the room answering. On the results screen it
redraws as every player's score trace across the whole game (the game's ECG), ending at the winner's peak.

**Audience and promise:** friends in the same room (or on a call), 2–8 phones, no install. In 10 seconds they
should believe: "I get it, it's fast, it looks expensive, and it's on."

**Palette (60/30/10):**
- `--ink #0E0D0B` warm black (field), `--ink-2 #17150F` raised surface, `--ink-3 #221F18` hairline fills
- `--paper #F4EFE6` warm ivory (text, light cards), `--mute #A39C8E` secondary text (AA on ink)
- `--signal #FF5A36` vermilion: the pulse line, primary actions, live numbers only
- `--hit #3EE0A0` mint: correct. A miss is a *flatline*: desaturated paper at 40% with a shake, never red.
- Player traces (8): `#FF5A36 #FFC145 #3EE0A0 #4CC9F0 #9D8CFF #FF7AB6 #E8E1D4 #FF9A3D`

**Type:** display *Bricolage Grotesque Variable* (opsz/wdth axes; 640–800 for the wordmark and challenge
titles, tight −0.035em, condensed width for big numbers), text *Manrope Variable* 500/700 (tabular numerals for
scores and timers). Two families, no more.

**Grid:** mobile-first single column, 16px gutters, thumb zone (bottom 40%) reserved for answers. Desktop and
tablet center a 480px "device" column for play, with the lobby and results spreading to two columns. Stage
view uses a 12-column 16:9 layout.

**Motion principles:**
- One orchestrated motion per screen: the challenge card *drops in on the beat*; reveals *pop points upward*;
  the leaderboard *re-orders with FLIP*. No fade-up on everything.
- `cubic-bezier(.2,.8,.2,1)` (expo-out) 180–600ms; springs only on points and rank changes.
- Every action answers within 1 frame: press-scale, haptic tick, a synthesized blip. Reduced motion keeps all
  information, drops travel.

**Imagery:** none. Avatars are hand-drawn SVG characters (geometric creatures with expressive eyes) in the
player's trace colour. Bots wear a visor face and a dashed ring, so they are identifiable without reading.

**Section map (screens):** Home (create / join) → Join (name + avatar) → Lobby (seats, bots, settings,
ready) → Intro card → Countdown → Play (12 challenge UIs) → Reveal → Ticker → Set break → Results
(podium + ECG) → Stage view (TV).

**Keep:** every action reachable in ≤ 2 taps; host controls behind one sheet; room code always visible in lobby.

**Concept notice:** no (original game).

## Anti-template commitments
No purple/blue gradient hero, no icon-card rows, no glass blobs (blur only on the one sheet that overlays
play), no buzzwords, no default Inter, no red/green-only feedback (shape + motion + colour), AA contrast.
