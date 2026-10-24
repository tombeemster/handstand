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
- `tools/replay.py`: runs recorded videos through the same rules (a copy of `detect.js`: change both)

## Test on recordings

```bash
python -m pip install mediapipe opencv-python
python tools/replay.py video
```

Lists the attempts found per video. Videos stay out of git (`.gitignore`); the repo is public.
