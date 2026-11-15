# Terminology

These words have specific meanings in Handstand; links point to the code or product notes that define the behavior.

| Term | Definition |
|------|--------------|
| **Attempt** | One try to kick up and hold a handstand. It can be timed automatically or manually; attempts under one second are not saved as timed attempts. See [`app.js`](app.js). |
| **Average best** | The mean of the daily highs over the latest five practice days, not the mean of every attempt. See [`stats.js`](stats.js) and [`DESIGN.md`](DESIGN.md#chart). |
| **Counted attempt** | An attempt included in records and other statistics. Automatic attempts count; manual attempts count only when **Manual timing** is enabled. See [`app.js`](app.js). |
| **Daily high** | The longest counted hold on one practice day. See [`stats.js`](stats.js). |
| **Detection** | Evaluating tracked poses over time to decide whether an automatic attempt starts or ends, or whether an event is a near miss. See [`detect.js`](detect.js). |
| **Flagged result** | In replay output, an attempt that ended after the athlete's pose was lost; inspect the video because the measured end may be early. This is a review cue, not a score. See [`detect.js`](detect.js) and [`tools/replay.py`](tools/replay.py). |
| **Hold** | The handstand being maintained and timed; its duration is the result shown in seconds. See [`detect.js`](detect.js) and [`app.js`](app.js). |
| **Kick-up** | The movement from standing into a handstand. The detector requires a recent standing pose before it starts a new automatic attempt. See [`detect.js`](detect.js). |
| **Manual timing** | Starting and stopping the timer by tapping it, rather than relying on automatic detection. See [`app.js`](app.js). |
| **Near miss** | An upside-down pose that the detector does not accept as an automatic attempt; it is logged with a reason. See [`detect.js`](detect.js) and [`app.js`](app.js). |
| **Not timed** | The separate log for near misses and automatically detected holds shorter than one second; these are not timed attempts in the statistics. See [`app.js`](app.js). |
| **Pose** | MediaPipe's estimated body landmarks and their visibility in one video frame; not a person's identity. See [MediaPipe Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker) and [`detect.js`](detect.js). |
| **Practice day** | A date with at least one counted attempt; days without one do not add a point to the chart. See [`app.js`](app.js). |
| **Record** | Usually the longest counted hold so far (the all-time best). A record-setting attempt is one that establishes a new best. **Record** can also name the screen where timing happens. See [`app.js`](app.js). |
| **Session** | One visit to the recording screen, which may contain several attempts. Its anonymous summary is made when the session ends. See [`app.js`](app.js) and [`summary.js`](summary.js). |
| **Tracking** | Handstand matches poses across frames to follow the same athlete, using location and body size. This is not identity recognition and does not save video. See [`detect.js`](detect.js). |
