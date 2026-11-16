# Terminology

The single source for names and definitions in Handstand. The other files use these terms and do not redefine them; links point to the code or notes that define the behavior. Screen and component names are fixed.

| Term | Definition |
|:--|:--|
| **Attempt** | One try to kick up and hold a handstand, timed automatically or manually. An automatic hold under one second is logged as **Not timed**, not as an attempt. See [`app.js`](../app.js). |
| **Average best** | The mean of the daily highs over the latest five practice days, not the mean of every attempt. Also the name of its home tile. See [`stats.js`](../stats.js) and [`DESIGN.md`](../DESIGN.md#chart). |
| **Best** | The All-time High. The longest counted hold so far; an ATH-setting attempt establishes a new one. Also the name of its home tile. See [`app.js`](../app.js). |
| **Clear** | A day's delete button. See [`DESIGN.md`](../DESIGN.md#components). |
| **Daily high** | The longest counted hold on one practice day. Use this term, not "best hold" or "daily record". See [`stats.js`](../stats.js). |
| **Detection** | Evaluating tracked poses over time to decide whether an automatic attempt starts or ends, or whether an event is a near miss. See [`detect.js`](../detect.js). |
| **Flagged result** | In replay output, an attempt that ended after the athlete's pose was lost; inspect the video because the measured end may be early. This is a review cue, not a score. See [`detect.js`](../detect.js) and [`tools/replay.py`](../tools/replay.py). |
| **Hold** | The handstand being maintained and timed; its duration is the result shown in seconds. See [`detect.js`](../detect.js) and [`app.js`](../app.js). |
| **Kick-up** | The movement from standing into a handstand. The detector requires a recent standing pose before it starts a new automatic attempt. See [`detect.js`](../detect.js). |
| **Manual timing** | Starting and stopping the timer by tapping it, rather than relying on automatic detection. A setting of the same name decides whether manual attempts count. See [`app.js`](../app.js). |
| **Near miss** | An upside-down pose that the detector does not accept as an automatic attempt; it is logged with a reason. See [`detect.js`](../detect.js) and [`app.js`](../app.js). |
| **Not timed** | The separate log for near misses and automatic holds shorter than one second; these are not attempts in the statistics. See [`app.js`](../app.js). |
| **Pose** | MediaPipe's estimated body landmarks and their visibility in one video frame; not a person's identity. See [MediaPipe Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker) and [`detect.js`](../detect.js). |
| **Practice day** | A date with at least one attempt logged; days without one do not add a point to the chart. See [`app.js`](../app.js). |
| **Session** | One visit to the recording screen, which may contain several attempts. Its anonymous summary is made when the session ends; what ends a session is in the Product Decisions of [`PRODUCT.md`](../PRODUCT.md). See [`app.js`](../app.js) and [`summary.js`](../summary.js). |
| **Tile** | The box everything on screen sits in, with an extra class for its kind (`stat`, `day`, `setting`). See [`DESIGN.md`](../DESIGN.md#layout). |
| **Tracking** | The app matches poses across frames to follow the same athlete, using location and body size. This is not identity recognition and does not save video. See [`detect.js`](../detect.js). |
| **Welcome tutorial** | The first-use intro and three slides, reopened from a tile in Settings. See [`DESIGN.md`](../DESIGN.md#welcome-tutorial). |