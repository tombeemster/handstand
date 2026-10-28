# Handstand

A phone web app that times handstands automatically with the camera and keeps a log.
Pose detection runs on the device (MediaPipe); nothing leaves the phone.

Live: https://tombeemster.github.io/handstand/

## Preview locally

```bash
npx serve -l tcp://127.0.0.1:3000 .
```

Open http://localhost:3000. The page needs a server: opening `index.html` directly doesn't work.
On `localhost` the camera works without HTTPS.

To test on a phone, the page must be on HTTPS. A temporary tunnel (needs `cloudflared`), in a second terminal:

```bash
cloudflared tunnel --url http://localhost:3000
```

Each address (localhost, tunnel, live site) keeps its own log in the browser.

## Files

- `index.html`: markup of the three screens (home, record, log)
- `style.css`: styles
- `app.js`: screens, log, chart, camera, sound
- `detect.js`: detection rules: when a handstand starts and ends
- `tools/replay.py`, `tools/replay.mjs`: run recorded videos through the app's own rules

## Test on recordings

```bash
python -m pip install mediapipe opencv-python
python tools/replay.py video
```

Needs Node as well: Python finds the poses, Node runs them through the app's own `detect.js`.
Lists the attempts and near misses found per video. Videos stay out of git (`.gitignore`); the repo is public.

## Sounds

Each file in `sounds/` whose name starts with a number of seconds (`04s-level-up.wav`) is the chime for a
hold longer than that; the longest level reached plays when the timer stops, before the time is spoken.
Several files with the same number (`01s-a.wav`, `01s-b.wav`) are variants: a random one plays, never the
same one twice in a row. Add, remove or rename a file and the app picks it up: locally straight away, on the live site once pushed.
Formats: wav, mp3, m4a (not ogg: iPhone can't play it).

Sources:

- From [Freesound](https://freesound.org), CC BY 4.0 (credit required):
  [Unpause rpg](https://freesound.org/s/873112/), [Level up (PSX)](https://freesound.org/s/873095/) and
  [Level up (Sci-Fi)](https://freesound.org/s/872713/) by heyheytheree;
  [evolve.wav](https://freesound.org/s/391656/) by jeckkech;
  [Jingle_Win_00.wav](https://freesound.org/s/270333/) by LittleRobotSoundFactory
- From Freesound, CC0: [Level Up](https://freesound.org/s/442943/) by qubodup;
  [8bit Powerup](https://freesound.org/s/464908/) by plasterbrain
- From [Kenney](https://kenney.nl), CC0: the `confirmation` sounds (Interface Sounds)
- Generated with ElevenLabs: the two `ElevenLabs_…` files

Icons: [Lucide](https://lucide.dev) (ISC licence).
