# Validation

Tested on Windows with ComfyUI 0.37.1, frontend 1.52.7, Python 3.13.12, PyTorch 2.11.0+cu130 and an RTX 3090. Other platforms have not been tested.

| Area | Verified behavior |
| --- | --- |
| Settings | Six unit tests cover fractional FPS, resampling, invalid settings, empty sources and even dimensions. |
| Extraction | Pose, DA3 Small and Canny each produced 60 frames over five seconds at 12 FPS. All three modes also ran together. |
| Export | MP4s decoded with the expected dimensions, FPS and frame count, without audio or blank frames. |
| Optional models | Canny ran with missing Pose/Depth selections. Missing models for enabled modes were rejected before execution. |
| Comparison | Divider, frame stepping, seeking and playback worked. A 124-frame, 24 FPS preview played without new inference requests or JavaScript errors. |
| Run buttons | Only the extraction node and its ancestors were submitted; downstream nodes were excluded. |
| Full graph | Both local buttons ran in a connected 17-node H3 generation workflow. Only LoadVideo and VideoControlStudio were submitted. A test did not persist one-frame mode into the next full run. |
| Playback regression | Tested with delayed frame requests and animation timestamps preceding the start event. Playback continued without invalid frame requests. |
| Layout | Resizing and language changes preserved all controls without internal scrolling. Control output stayed English in Korean mode. |
| Grouped settings | Enabled modes revealed their own groups; hidden options retained values. All groups fit at the enforced minimum size in English and Korean. Playback and clean node screenshots were checked again. |
| README comparison | All three extractors processed the same three-second segment into 72 frames at 24 FPS. The silent comparison MP4 decodes to 72 frames; the inline GIF has 36 frames totaling exactly three seconds. |
| Persistence | Language, settings and presets survived workflow reload. |
| H3 integration | Exported Pose frames drove a 124-frame generation. A separate run connected control_frames directly to H3 Fun ControlNet with image-reference conditioning and generated 73 frames at 704 × 384. |

## Example timings

Single runs of a five-second clip at 12 FPS, 512 × 292. Time includes extraction, preview writing and video export. These are examples, not comparative benchmarks.

| Mode | Device | Elapsed |
| --- | --- | --- |
| Canny | CPU | 21.71 s |
| DA3 Small | CPU | 27.10 s |
| SDPose Wholebody | RTX 3090 | 34.16 s |

The 124-frame H3 check used 512 × 288, an 8-step Turbo LoRA and Fun ControlNet Union 2.0; generation completed in 70.54 seconds. Successful execution establishes connectivity, not guaranteed identity retention or motion fidelity.

## Observed limits

- Pose can lose occluded joints and switch subjects across cuts. This package has no person detector, selector or tracker.
- Depth contrast can change between frames despite shared segment normalization. There is no temporal smoothing.
- Canny includes background edges as well as the subject.
- Tests cover short clips. Long-clip memory use and broader hardware/extension compatibility remain unverified.

Initial motion tests used the public [ComfyUI dancer sample](https://github.com/Comfy-Org/workflow_templates/blob/main/input/dancer_field_pose.mp4), which is not bundled. Node screenshots use an original geometric test animation. The README comparison GIF/MP4 contains extracted maps from a user-provided clip. Source footage, audio, other test media and model weights are not included.
