# PULSE

A real-time party game for 2–8 players. Everyone joins a room with a four-letter code on their own
phone and plays the same 5–10 second micro-challenge at the same moment: trivia, reflexes and words.
Bots fill empty seats.

## Play

```bash
npm install
npm run build
npm start            # http://localhost:3000
```

Friends on the same Wi-Fi open the address shown under the room code in the lobby (the computer's network
address, e.g. `http://192.168.1.20:3000`). For play over the internet, deploy the folder to any Node host
(Render, Railway, Fly.io) and run `npm run build && npm start`; it serves the client and the game server
on one port (`PORT` env var).

Optional big-screen view for a TV: `/stage/CODE`.

## Develop

```bash
npm run dev          # game server on :3000 + Vite client on :5173 (hot reload)
npm test             # 24 engine + real-socket multiplayer tests
npm run e2e          # full browser game: 2 phones + late joiner + bots, reconnect, play again
npm run jury         # design gates (a11y, CLS, LCP, fps, overflow) over every screen at /gallery
```

## Layout

| Path | What |
|---|---|
| `shared/config.js` | rules, timings, scoring constants, challenge list, bot personas |
| `server/room.js` | the authoritative room: lobby, ready, game loop, scoring, presence, host controls |
| `server/challenges.js` | 12 challenge generators, scorers and answer validation |
| `server/content.js` | trivia facts, events, estimates, category words |
| `server/bots.js` | bot skill model (persona × difficulty × item difficulty, capped at human limits) |
| `server/index.js` | HTTP + Socket.IO, static client, flood guard |
| `src/screens/*` | Home, Lobby, Game (intro → play → reveal → standings), Results, Stage |
| `src/challenges.jsx` | the 12 challenge UIs |
| `src/components/PulseLine.jsx` | the signature waveform: heartbeat, round timer and lock-in spikes |
| `juried/` | art direction brief, dossier and jury log |

## Fairness and sync

The server owns all state and every answer key; clients only see a challenge when play starts. Clocks are
synced by ping; answer times are client-measured but clamped to what the server observed, and claims from the
future are refused. Bots answer through the same path and window as people, never faster than 220 ms and
never more than 90% accurate.
