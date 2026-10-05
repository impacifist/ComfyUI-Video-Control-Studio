"""Local control-video extraction and synchronized comparison."""
import json
from pathlib import Path
import uuid

import numpy as np
from PIL import Image
import torch
import folder_paths
import comfy.sd
import comfy.utils
import comfy.model_management as mm
from comfy_api.latest import InputImpl, Types
from comfy_extras.nodes_video import apply_video_trim
from comfy_extras.nodes_canny import Canny
from comfy_extras.nodes_sdpose import SDPoseKeypointExtractor, SDPoseDrawKeypoints
from comfy_extras.nodes_depth_anything_3 import LoadDA3Model, DA3Inference
from .settings import DEFAULTS, parse_settings, frame_plan, output_size

WEB_DIRECTORY = "./web"


def model_path(folder, name):
    if name not in folder_paths.get_filename_list(folder):
        raise ValueError(f"Install and select a model in models/{folder}: {name}")
    return folder_paths.get_full_path_or_raise(folder, name)


def normalize_depth(depth, invert=False):
    if not torch.isfinite(depth).all():
        raise ValueError("Depth model produced non-finite values.")
    # One inverse-depth range for the entire selected segment, not per-frame contrast.
    inverse = depth.clamp_min(1e-6).reciprocal()
    low, high = inverse.amin(), inverse.amax()
    grey = (inverse - low) / (high - low).clamp_min(1e-6)
    if invert:
        grey = 1 - grey
    return grey.unsqueeze(-1).repeat(1, 1, 1, 3).float()


def preview_manifest(streams, fps, settings):
    subfolder = "vcs_" + uuid.uuid4().hex
    directory = Path(folder_paths.get_temp_directory()) / subfolder
    directory.mkdir(parents=True, exist_ok=False)
    source = streams["original"]
    manifest = {"fps": float(fps), "count": len(source), "width": source.shape[2], "height": source.shape[1],
                "start": settings["start"], "test": settings["test"], "streams": {}, "output": settings["output"]}
    for name, frames in streams.items():
        manifest["streams"][name] = []
        for i, frame in enumerate(frames):
            mm.throw_exception_if_processing_interrupted()
            image = Image.fromarray(np.clip(frame.cpu().numpy() * 255, 0, 255).astype(np.uint8))
            image.thumbnail((640, 640), Image.Resampling.LANCZOS)
            filename = f"{name}_{i:06}.webp"
            image.save(directory / filename, format="WEBP", quality=85, method=2)
            manifest["streams"][name].append({"filename": filename, "subfolder": subfolder, "type": "temp"})
    return manifest


class VideoControlStudio:
    @classmethod
    def INPUT_TYPES(cls):
        pose = [p for p in folder_paths.get_filename_list("checkpoints") if "sdpose" in p.lower()]
        depth = [p for p in folder_paths.get_filename_list("geometry_estimation") if "depth_anything_3" in p.lower() or "da3" in p.lower()]
        return {"required": {
            "video": ("VIDEO",),
            "settings_json": ("STRING", {"default": json.dumps(DEFAULTS)}),
            "pose_checkpoint": (pose or ["Not installed"],),
            "depth_checkpoint": (depth or ["Not installed"],),
        }}

    RETURN_TYPES = ("IMAGE", "VIDEO", "FLOAT", "INT")
    RETURN_NAMES = ("control_frames", "control_video", "fps", "frame_count")
    FUNCTION = "extract"
    CATEGORY = "video/control"
    OUTPUT_NODE = True
    DESCRIPTION = "Extract Pose, Depth and Canny control videos. Compare aligned frames with an A/B wipe. VIDEO input from Load Video; control_frames connects to MiniMax H3 ControlNet."

    @classmethod
    def VALIDATE_INPUTS(cls, settings_json, pose_checkpoint, depth_checkpoint):
        # Saved workflows may reference models absent on another machine.
        # Only enabled extractors need valid model selections.
        try:
            cfg = parse_settings(settings_json)
            if "pose" in cfg["modes"]:
                model_path("checkpoints", pose_checkpoint)
            if "depth" in cfg["modes"]:
                model_path("geometry_estimation", depth_checkpoint)
        except (ValueError, TypeError) as error:
            return str(error)
        return True

    def extract(self, video, settings_json, pose_checkpoint, depth_checkpoint):
        cfg = parse_settings(settings_json)
        # Validate selected models before decoding the video or doing any inference.
        if "pose" in cfg["modes"]:
            model_path("checkpoints", pose_checkpoint)
        if "depth" in cfg["modes"]:
            model_path("geometry_estimation", depth_checkpoint)
        clip = apply_video_trim(video, {"start_time": cfg["start"], "duration": cfg["duration"]})
        components = clip.get_components()
        frames = components.images[..., :3]
        indices, fps = frame_plan(len(frames), components.frame_rate, cfg["fps"])
        if cfg["test"]:
            test_index = int(cfg["test_time"] * float(components.frame_rate))
            if test_index >= len(frames):
                raise ValueError("Test time is outside the selected video segment.")
            indices = [test_index]
        width, height = output_size(frames.shape[2], frames.shape[1], cfg["max_side"])
        original_batches = []
        for start in range(0, len(indices), 8):
            batch = frames[indices[start:start + 8]].movedim(-1, 1)
            original_batches.append(comfy.utils.common_upscale(batch, width, height, "area", "disabled").movedim(1, -1).cpu())
        original = torch.cat(original_batches)
        del frames, components, original_batches
        streams = {"original": original}
        batch_size = cfg["batch_size"]
        progress = comfy.utils.ProgressBar(len(original) * len(cfg["modes"]))
        for mode in cfg["modes"]:
            results = []
            if mode == "pose":
                model, _, vae, _ = comfy.sd.load_checkpoint_guess_config(model_path("checkpoints", pose_checkpoint), output_vae=True, output_clip=False)
            elif mode == "depth":
                model = LoadDA3Model.execute(depth_checkpoint, "default").result[0]
            for start in range(0, len(original), batch_size):
                mm.throw_exception_if_processing_interrupted()
                batch = original[start:start + batch_size]
                if mode == "canny":
                    result = Canny.execute(batch, cfg["low"], cfg["high"]).result[0]
                elif mode == "pose":
                    keypoints = SDPoseKeypointExtractor.execute(model, vae, batch, batch_size).result[0]
                    result = SDPoseDrawKeypoints.execute(keypoints, True, cfg["hands"], cfg["face"], cfg["feet"], 4, 3, cfg["threshold"], True).result[0]
                else:
                    geometry = DA3Inference.execute(model, batch, 504, "upper_bound_resize", {"mode": "mono"}).result[0]
                    result = geometry["depth"]
                results.append(result.cpu())
                progress.update(len(batch))
            stream = torch.cat(results)
            streams[mode] = normalize_depth(stream, cfg["depth_invert"]) if mode == "depth" else stream
            if mode == "pose":
                del vae, model
            elif mode == "depth":
                del model
        selected = streams[cfg["output"]]
        output_video = InputImpl.VideoFromComponents(Types.VideoComponents(images=selected, audio=None, frame_rate=fps))
        manifest = preview_manifest(streams, fps, cfg)
        return {"ui": {"vcs": [manifest]}, "result": (selected, output_video, float(fps), len(selected))}


NODE_CLASS_MAPPINGS = {"VideoControlStudio": VideoControlStudio}
NODE_DISPLAY_NAME_MAPPINGS = {"VideoControlStudio": "Video Control Studio"}
