import json
import math
from fractions import Fraction

DEFAULTS = {
    "modes": ["canny"], "output": "canny", "start": 0.0, "duration": 5.0,
    "fps": 24.0, "max_side": 768, "test": False, "test_time": 0.0,
    "hands": True, "face": False, "feet": False, "threshold": 0.3,
    "low": 0.2, "high": 0.5, "depth_invert": False, "batch_size": 1,
}


def parse_settings(raw):
    value = json.loads(raw)
    if not isinstance(value, dict) or set(value) - set(DEFAULTS):
        raise ValueError("Invalid Video Control Studio settings.")
    result = {**DEFAULTS, **value}
    if not isinstance(result["modes"], list) or not result["modes"] or any(m not in ("pose", "depth", "canny") for m in result["modes"]):
        raise ValueError("Select Pose, Depth, or Canny.")
    result["modes"] = list(dict.fromkeys(result["modes"]))
    if result["output"] not in result["modes"]:
        raise ValueError("The output must be one of the selected extraction modes.")
    for key in ("test", "hands", "face", "feet", "depth_invert"):
        if type(result[key]) is not bool:
            raise ValueError(f"{key} must be a boolean.")
    limits = {"start": (0, 86400), "duration": (0, 86400), "fps": (0, 120), "max_side": (64, 4096),
              "test_time": (0, 86400), "threshold": (0, 1), "low": (0.01, 0.99), "high": (0.01, 0.99), "batch_size": (1, 16)}
    for key, (lo, hi) in limits.items():
        val = result[key]
        if type(val) not in (int, float) or not math.isfinite(val) or not lo <= val <= hi:
            raise ValueError(f"{key} must be between {lo} and {hi}.")
    for key in ("max_side", "batch_size"):
        if int(result[key]) != result[key]:
            raise ValueError(f"{key} must be an integer.")
        result[key] = int(result[key])
    if result["low"] >= result["high"]:
        raise ValueError("Canny low threshold must be smaller than high threshold.")
    return result


def frame_plan(count, source_fps, target_fps):
    source = Fraction(source_fps)
    if count < 1 or source <= 0:
        raise ValueError("The selected video segment has no frames or an invalid FPS.")
    fps = Fraction(str(target_fps)) if target_fps else source
    indices = [min(count - 1, int(i * source / fps)) for i in range(math.ceil(count * fps / source))]
    return indices, fps


def output_size(width, height, max_side):
    ratio = min(1.0, max_side / max(width, height))
    return max(2, round(width * ratio / 2) * 2), max(2, round(height * ratio / 2) * 2)
