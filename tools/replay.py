"""Replay recorded videos through the Handstand detection rules and list the attempts found.

Python finds the poses (the same lite model the app uses, on the CPU); the rules are the app's own
detect.js, run by Node (tools/replay.mjs). There is no second copy of the rules to keep in step.

Setup (once):  python -m pip install mediapipe opencv-python   (and Node)
Run:           python tools/replay.py <video or folder> [more ...]

The model is downloaded on first run, and the poses of each video (as filmed, and turned upside down
for the app's second opinion) are cached in tools/.cache, so a rerun after a rule change takes
seconds. Delete that folder to start fresh.
"""
import json, os, subprocess, sys, urllib.request
import cv2
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
MODEL = os.path.join(CACHE, 'pose_landmarker_lite.task')
VIDEO_EXT = ('.mov', '.mp4', '.m4v')


def poses_file(path, flipped=False):
    """The cache file with the poses per frame, made on first use: {w, h, frames: [[ms, [pose, ...]]]},
    each pose [[x, y, visibility] * 33], at ~640 px like the app. flipped: of each frame turned upside
    down, with the poses turned back."""
    cache = os.path.join(CACHE, f'{os.path.basename(path)}.{os.path.getsize(path)}.poses1{".flipped" if flipped else ""}.json')
    if os.path.exists(cache):
        return cache
    if not os.path.exists(MODEL):
        urllib.request.urlretrieve(MODEL_URL, MODEL)
    opts = vision.PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=MODEL), running_mode=vision.RunningMode.VIDEO, num_poses=1)
    turn = (lambda v: 1 - v) if flipped else (lambda v: v)
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
            if flipped:
                img = cv2.rotate(img, cv2.ROTATE_180)
            h, w = img.shape[:2]
            res = model.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), int(ts))
            frames.append([ts, [[[turn(p.x), turn(p.y), p.visibility] for p in pose] for pose in res.pose_landmarks]])
    json.dump({'w': w, 'h': h, 'frames': frames}, open(cache, 'w'))
    return cache


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
        normal, flipped = poses_file(path), poses_file(path, flipped=True)
        frames = json.load(open(normal))['frames']
        length = frames[-1][0] / 1000 if frames else 0
        found = sum(1 for _, p in frames if p) / max(len(frames), 1)
        print(f'\n{os.path.basename(path)}  ({length:.1f} s, {len(frames) / max(length, 0.001):.0f} fps, pose found in {found:.0%} of frames)')
        result = json.loads(subprocess.run(['node', os.path.join(HERE, 'replay.mjs'), normal, flipped],
                                           capture_output=True, text=True, check=True).stdout)
        for a in result['attempts']:
            if a['end'] is None:
                print(f"  {a['start'] / 1000:6.2f} s  still up when the video ends")
                continue
            total += 1; logged += a['logged']
            print(f"  {a['start'] / 1000:6.2f} -> {a['end'] / 1000:6.2f} s  {(a['end'] - a['start']) / 1000:5.2f} s  "
                  f"{'logged' if a['logged'] else 'discarded, under 1 s'}{'  (check: tracking lost)' if a['flagged'] else ''}")
        if not result['attempts']:
            print('  no attempts')
        for m in result['misses']:
            print(f"  near miss at {m['ts'] / 1000:6.2f} s: {m['why']}")
    print(f'\n{logged} logged of {total} attempts found')


if __name__ == '__main__':
    main(sys.argv[1:])
