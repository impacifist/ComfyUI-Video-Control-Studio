import importlib.util
import json
from fractions import Fraction
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('settings', Path(__file__).parents[1] / 'settings.py')
settings = importlib.util.module_from_spec(spec)
spec.loader.exec_module(settings)


class SettingsTests(unittest.TestCase):
    def test_fractional_rate_preserved(self):
        indices, fps = settings.frame_plan(60, Fraction(30000, 1001), 0)
        self.assertEqual(indices, list(range(60)))
        self.assertEqual(fps, Fraction(30000, 1001))

    def test_downsample_and_repeat_without_out_of_range(self):
        self.assertEqual(settings.frame_plan(5, 10, 4)[0], [0, 2])
        self.assertEqual(settings.frame_plan(2, 2, 4)[0], [0, 0, 1, 1])

    def test_empty_source_rejected(self):
        with self.assertRaises(ValueError):
            settings.frame_plan(0, 24, 24)

    def test_output_must_be_selected(self):
        with self.assertRaises(ValueError):
            settings.parse_settings('{"modes":["pose"],"output":"canny"}')

    def test_invalid_settings(self):
        for data in [{"fps": float('nan')}, {"fps": True}, {"max_side": 64.5}, {"low": .8, "high": .2}, {"test": 1}, {"modes": []}, {"unknown": 1}]:
            with self.subTest(data=data), self.assertRaises(ValueError):
                settings.parse_settings(json.dumps(data))

    def test_aspect_and_even_dimensions(self):
        self.assertEqual(settings.output_size(1920, 1080, 768), (768, 432))
        self.assertEqual(settings.output_size(1080, 1920, 768), (432, 768))
        self.assertEqual(settings.output_size(65, 65, 768), (64, 64))

if __name__ == '__main__':
    unittest.main()
