"""Replay recorded videos through the Handstand detection rules and list the attempts found.

The rules are a copy of detect.js (the app has no other detection code): change them together.
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

VIS, ANKLE_VIS, CONFIRM, LOST_MS, MIN_MS, HISTORY_MS, MERGE_MS = 0.5, 0.3, 3, 500, 1000, 2000, 600
SPEED, LOCK_MS, NUM_POSES = 1.5, 2000, 1   # 2 was tried: one body reported twice, worse

CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.cache')
MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
MODEL = os.path.join(CACHE, 'pose_landmarker_lite.task')
VIDEO_EXT = ('.mov', '.mp4', '.m4v')


def landmarks(path):
    """Poses per frame as [ms, [pose, ...]], each pose [[x, y, visibility] * 33], at ~640 px like the app."""
    cache = os.path.join(CACHE, f'{os.path.basename(path)}.{os.path.getsize(path)}.poses{NUM_POSES}.json')
    if os.path.exists(cache):
        return json.load(open(cache))
    if not os.path.exists(MODEL):
        urllib.request.urlretrieve(MODEL_URL, MODEL)
    opts = vision.PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=MODEL), running_mode=vision.RunningMode.VIDEO, num_poses=NUM_POSES)
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
            frames.append([ts, [[[p.x, p.y, p.visibility] for p in pose] for pose in res.pose_landmarks]])
    data = {'w': w, 'h': h, 'frames': frames}
    json.dump(data, open(cache, 'w'))
    return data


def detect(data):
    """Attempts, and the times (s) the lock was released."""
    W, H = data['w'], data['h']
    attempts, hist, releases = [], [], []
    start = None; inv_run = down_run = 0; down_ts = seen_ts = 0
    athlete = None   # [x, y, ts]: hip centre in pixels when last seen
    size = 0.5       # her height, fraction of the frame

    def extent(lm):
        ys = [p[1] for p in lm if p[2] > VIS]
        return max(0.1, max(ys) - min(ys)) if ys else 0.3

    def hip_centre(lm):
        return (lm[23][0] + lm[24][0]) / 2 * W, (lm[23][1] + lm[24][1]) / 2 * H

    def pick_athlete(poses, ts):
        nonlocal athlete, size
        if athlete and start is None and ts - athlete[2] > LOCK_MS:
            athlete = None
            releases.append(ts / 1000)
        if athlete is None:   # the first person seen is the athlete
            if not poses:
                return None
            athlete = [*hip_centre(poses[0]), ts]
            size = extent(poses[0])
            return poses[0]
        pick, reach = None, (0.3 + SPEED * (ts - athlete[2]) / 1000) * size * H
        for p in poses:
            x, y = hip_centre(p)
            d = ((x - athlete[0]) ** 2 + (y - athlete[1]) ** 2) ** 0.5
            if d <= reach:
                pick, reach = p, d
        if pick:
            athlete = [*hip_centre(pick), ts]
            size = 0.8 * size + 0.2 * extent(pick)
        return pick

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

    for ts, poses in data['frames']:
        lm = pick_athlete(poses, ts)
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
                tol = (wrist - hip) * 0.2
                t = ts
                for f in reversed(hist):
                    if f['wrist'] is None:
                        continue
                    if abs(f['wrist'] - wrist) > tol:
                        break
                    t = f['ts']
                if attempts and attempts[-1]['end'] is not None and t - attempts[-1]['end'] < MERGE_MS:
                    t = attempts.pop()['start']   # same attempt, continued
                start = t; seen_ts = ts; down_run = 0
            continue
        # head above hips mid-attempt: the model fitted her the wrong way up, its "wrists" are her feet
        flipped = bool(lm) and lm[0][2] > VIS and lm[0][1] < hip
        feet = [lm[15][1], lm[16][1]] if flipped else ankles
        if not hips or not feet:
            if ts - seen_ts > LOST_MS:
                finish(seen_ts, True)
        else:
            seen_ts = ts
            if any(y > hip for y in feet):
                if down_run == 0:
                    down_ts = ts
                down_run += 1
                if down_run >= CONFIRM:
                    finish(down_ts)
            else:
                down_run = 0
    if start is not None:
        attempts.append({'start': start, 'end': None, 'flagged': False})
    return attempts, releases


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
        attempts, releases = detect(data)
        if releases:
            print('  lock released (athlete unseen > 2 s) at ' + ', '.join(f'{t:.2f} s' for t in releases))
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
