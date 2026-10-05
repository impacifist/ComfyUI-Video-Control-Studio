# Workflow guide

[한국어](WORKFLOWS.ko.md)

Download a JSON with GitHub's **Raw / Download raw file** button and drag it onto ComfyUI. Upload your own media in Load Video. No media is bundled.

## Extract, compare and export

[English workflow](../examples/video-control-studio-en.json) · [Korean workflow](../examples/video-control-studio-ko.json)

**Load Video → Video Control Studio → Save Video**

Start with Canny, which needs no model. Select a two-second segment, click **Test one frame**, adjust thresholds if needed, then **Extract segment**. Choose Original and Canny in A/B and drag the divider.

Use the main **Run** button to execute Save Video too; local buttons stop at extraction. Choose MP4/H.264 for a widely supported export. Control videos are silent.

For Pose/Depth, install the appropriate model and select it under Advanced settings after refreshing the model list/restarting. Change Control output and extract again to update the exported map.

## H3 Pose ControlNet generation

[English workflow](../examples/h3-pose-controlnet-en.json) · [Korean workflow](../examples/h3-pose-controlnet-ko.json)

This connects **control_frames directly to MiniMax H3 Fun ControlNet** and generates a video. It uses core ComfyUI nodes plus Video Control Studio.

| Loader | Model / folder |
| --- | --- |
| Load Diffusion Model | H3 FL2VA / `models/diffusion_models` |
| Load CLIP | H3 Qwen3-VL, type `minimax` / `models/text_encoders` |
| Load VAE | H3 video VAE / `models/vae` |
| Load Model Patch | H3 Fun ControlNet Union 2.0 / `models/model_patches` |
| Load LoRA (Model Only) | Compatible FL2V 8-step Turbo LoRA / `models/loras` |
| Video Control Studio | SDPose Wholebody / `models/checkpoints` |

Sources: [Comfy-Org MiniMax H3](https://huggingface.co/Comfy-Org/MiniMax-H3), [SDPose](https://huggingface.co/Comfy-Org/SDPose), [official ControlNet template](https://github.com/Comfy-Org/workflow_templates/blob/main/templates/video_minimax_h3_fun_controlnet_union.json). Model licenses and hardware requirements are separate from this package.

1. Upload a clip with a clearly visible main subject and no shot changes for an initial test.
2. Extract approximately **5.17 seconds at 24 FPS** for **124 frames**. Shorter sequences hold their last frame inside native H3 ControlNet.
3. Use **Test one frame**, then **Extract segment** before running the whole graph.
4. Edit the prompt in H3 Reference to Video. This example uses text conditioning without an identity reference. Pose transfers geometry, not appearance.
5. Run the whole graph: defaults are 512 × 288, 124 frames and 8 steps with the matching Turbo LoRA. Without that LoRA, use the base model's recommended sampling settings.

Reference to Video is used without reference images, as in the tested FL2VA setup. This example exports video only and omits audio decode. Photo-reference conditioning, masks and subject replacement belong in the downstream H3 workflow with a compatible model; Video Control Studio supplies the control maps.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Missing node | Check the custom_nodes directory, restart ComfyUI and refresh the browser. Confirm native preprocessors are installed. |
| Model selection error | Choose installed filenames in each loader; subfolders may differ from the example. |
| Only one frame | Click Extract segment after Test one frame. |
| Old preview/output | Extract again after processing settings or Control output changes. |
| Preview missing after restart | Temporary files may have been cleared; extract again. |
| Save Video does not run | Use the main Run button. |
| Wrong pose/person | Trim to a clear subject; this version estimates one person from the full frame. |
| High RAM | Reduce clip length, resolution and enabled modes. Batch size does not limit decoded clip memory. |
| Subgraph local-run error | Use the main Run button inside subgraphs. |
