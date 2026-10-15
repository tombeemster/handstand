"""Replay recorded videos through the Handstand detection rules and list the attempts found.

The rules are a copy of step() and upright() in index.html: change them together.
The pose model is the same lite model the app uses, run here on the CPU.

Setup (once):  python -m pip install mediapipe opencv-python
Run:           python tools/replay.py <video or folder> [more ...]

The model is downloaded on first run, and the pose landmarks of each video are cached in
tools/.cache, so a rerun after a rule change takes seconds. Delete that folder to start fresh.
"""
import json, os, sys, urllib.request
import cv2
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision

VIS, ANKLE_VIS, CONFIRM, LOST_MS, MIN_MS, HISTORY_MS = 0.5, 0.3, 3, 500, 1000, 2000

CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.cache')
MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
MODEL = os.path.join(CACHE, 'pose_landmarker_lite.task')
VIDEO_EXT = ('.mov', '.mp4', '.m4v')


def landmarks(path):
    """Pose landmarks per frame as [ms, [[x, y, visibility] * 33] or None], at ~640 px like the app."""
    cache = os.path.join(CACHE, f'{os.path.basename(path)}.{os.path.getsize(path)}.json')
    if os.path.exists(cache):
        return json.load(open(cache))
    if not os.path.exists(MODEL):
        urllib.request.urlretrieve(MODEL_URL, MODEL)
    opts = vision.PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=MODEL), running_mode=vision.RunningMode.VIDEO)
    cap = cv2.VideoCapture(path)
    frames, w, h = [], 0, 0
    with vision.PoseLandmarker.create_from_options(opts) as model:
        while True:
            ok, img = cap.read()
            if not ok:
                break
            ts = cap.get(cv2.CAP_PROP_POS_MSEC)
            scale = 640 / max(img.shape[:2])
            img = cv2.resize(img, None, fx=scale, fy=scale)
            h, w = img.shape[:2]
            res = model.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), int(ts))
            frames.append([ts, [[p.x, p.y, p.visibility] for p in res.pose_landmarks[0]] if res.pose_landmarks else None])
    data = {'w': w, 'h': h, 'frames': frames}
    json.dump(data, open(cache, 'w'))
    return data


def detect(data):
    W, H = data['w'], data['h']
    attempts, hist = [], []
    start = None; inv_run = down_run = 0; down_ts = seen_ts = 0

    def finish(end, flagged=False):
        nonlocal start, inv_run
        attempts.append({'start': start, 'end': end, 'flagged': flagged})
        start = None; inv_run = 0

    def upright(lm):
        def centre(ids, vis):
            ps = [lm[i] for i in ids if lm[i][2] > vis]
            return sum(p[0] for p in ps) / len(ps) * W, sum(p[1] for p in ps) / len(ps) * H
        (wx, wy), (ax, ay) = centre([15, 16], VIS), centre([27, 28], ANKLE_VIS)
        return abs(wy - ay) > abs(wx - ax)

    for ts, lm in data['frames']:
        ys = lambda ids, vis=VIS: [lm[i][1] for i in ids if lm[i][2] > vis] if lm else []
        wrists, hips, ankles = ys([15, 16]), ys([23, 24]), ys([27, 28], ANKLE_VIS)
        tracked = bool(hips and ankles)
        hip = sum(hips) / len(hips) if hips else 0
        wrist = max(wrists) if wrists else None
        hist.append({'ts': ts, 'wrist': wrist, 'feetDown': tracked and any(y > hip for y in ankles)})
        while hist[0]['ts'] < ts - HISTORY_MS:
            hist.pop(0)

        if start is None:
            inverted = (tracked and wrist is not None and all(y < hip for y in ankles) and hip < wrist
                        and upright(lm) and any(f['feetDown'] for f in hist))
            inv_run = inv_run + 1 if inverted else 0
            if inv_run >= CONFIRM:
                tol = (wrist - hip) * 0.12
                t = ts
                for f in reversed(hist):
                    if f['wrist'] is None:
                        continue
                    if abs(f['wrist'] - wrist) > tol:
                        break
                    t = f['ts']
                start = t; seen_ts = ts; down_run = 0
        elif not tracked:
            if ts - seen_ts > LOST_MS:
                finish(seen_ts, True)
        else:
            seen_ts = ts
            if any(y > hip for y in ankles):
                if down_run == 0:
                    down_ts = ts
                down_run += 1
                if down_run >= CONFIRM:
                    finish(down_ts)
            else:
                down_run = 0
    if start is not None:
        attempts.append({'start': start, 'end': None, 'flagged': False})
    return attempts


def videos(args):
    for arg in args:
        if os.path.isdir(arg):
            yield from sorted(os.path.join(arg, f) for f in os.listdir(arg) if f.lower().endswith(VIDEO_EXT))
        else:
            yield arg


def main(args):
    if not args:
        sys.exit(__doc__)
    os.makedirs(CACHE, exist_ok=True)
    total = logged = 0
    for path in videos(args):
        data = landmarks(path)
        frames = data['frames']
        length = frames[-1][0] / 1000 if frames else 0
        found = sum(1 for _, lm in frames if lm) / max(len(frames), 1)
        print(f'\n{os.path.basename(path)}  ({length:.1f} s, {len(frames) / max(length, 0.001):.0f} fps, pose found in {found:.0%} of frames)')
        attempts = detect(data)
        for a in attempts:
            if a['end'] is None:
                print(f"  {a['start'] / 1000:6.2f} s  still up when the video ends")
                continue
            ms = a['end'] - a['start']
            status = 'logged' if ms >= MIN_MS else 'discarded, under 1 s'
            total += 1; logged += ms >= MIN_MS
            print(f"  {a['start'] / 1000:6.2f} -> {a['end'] / 1000:6.2f} s  {ms / 1000:5.2f} s  {status}{'  (check: tracking lost)' if a['flagged'] else ''}")
        if not attempts:
            print('  no attempts')
    print(f'\n{logged} logged of {total} attempts found')


if __name__ == '__main__':
    main(sys.argv[1:])
