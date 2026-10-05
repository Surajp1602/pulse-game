# Jury log: PULSE

The game UI is judged through `/gallery`: every key screen rendered from mock state with a frozen clock,
one viewport-height frame each, captured by `tools/jury/capture.mjs` (adapted to run the real game server).

## Calibration (2026-10-05)
Blind sheets A–F, one fresh juror each. Caught 4/5 mutants:
template-palette (gap 6.9), lorem-content (gap 2.4), generic-type (gap 1.2), no-signature (gap 0.54, creativity 1.3) caught;
cramped-broken missed (gap 0.28). That mutant attacks section padding, which this UI does not rely on, so it barely
degraded the screens. Not formally calibrated; vision scores treated as advisory, with a stricter
spacing instruction added to the juror prompt. Deterministic gates remained the hard bar.

## Round 0 (gates only)
Gates: 18/23. Fixed: ARIA labels on role-less elements (wordmark, round pips), dimmed answer contrast 3.2 → AA,
blank PulseLine canvas under reduced motion, desktop fps 48 → 60 (canvases pause offscreen).

## Round 1
Gates: 23/23
Scores: design 7.2 · usability 6.3 · creativity 7.4 · content 6.8 → 6.93 (revise)
Fixed: lobby wait label ("Waiting on Tomás"); Play again moved under the winner (never covers content);
results trace redrawn as an ECG with spikes on rounds won, ending on the winner's avatar; desktop play centred,
countdown scaled; Memory Flash cue in paper with numbered 56px slots; system emoji replaced by custom SVG
reaction glyphs; reveal deltas on one scrolling strip; "Join at localhost" replaced by the machine's LAN
address (a real usability bug: phones cannot reach localhost); bots now react after reveals.

## Round 2
Gates: 23/23
Scores: design 7.6 · usability 6.9 · creativity 7.8 · content 7.6 → 7.4 (pass)
Fixed after pass: secondary labels ≥ 14px in the dock and slider scale; snapped words outlined in the
player's colour instead of a vermilion fill; Word toggle copy shortened so cards match.
Deferred: desktop play layout varies little between challenge families; the side panel footnote could show
live context instead of a static rule reminder.
