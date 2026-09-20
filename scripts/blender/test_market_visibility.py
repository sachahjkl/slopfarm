"""Vérifie que les contrôles refusent les obstacles de stock et de caméra."""

import json
import sys
import unittest
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from asset_common import OUTPUT, import_model  # noqa: E402
from market_visibility import blender_point, runtime_layout, validate_market  # noqa: E402


class MarketVisibilityTests(unittest.TestCase):
    def setUp(self):
        manifest = json.loads((OUTPUT / "manifest.json").read_text())
        self.entry = next(
            entry
            for entry in manifest["assets"]
            if entry["id"] == "industry-market-stall-tier-1"
        )
        import_model(OUTPUT / self.entry["file"])
        self.layout = runtime_layout()
        self.rotation = Matrix.Rotation(self.layout["yawRadians"], 4, "Z")

    def obstacle(self, position, dimensions):
        bpy.ops.mesh.primitive_cube_add(size=1)
        bpy.context.object.matrix_world = (
            self.rotation.inverted()
            @ Matrix.Translation(position)
            @ Matrix.Diagonal((*dimensions, 1))
        )
        bpy.context.view_layer.update()

    def test_roof_above_maximum_stack_is_rejected(self):
        center = blender_point(self.layout["wood"]["center"])
        center.z = 60
        self.obstacle(center, (3, 3, 0.1))
        with self.assertRaisesRegex(ValueError, "Volume réservé obstrué : stock"):
            validate_market(self.entry)

    def test_panel_outside_column_blocks_camera(self):
        base = blender_point(self.layout["wood"]["center"])
        base.z -= self.layout["wood"]["size"][1] / 2 - 0.004
        direction = blender_point(self.layout["cameraOffset"]).normalized()
        self.obstacle(base + direction * 0.6, (0.16, 0.16, 0.16))
        with self.assertRaisesRegex(ValueError, "Pile masquée depuis la caméra du jeu"):
            validate_market(self.entry)

    def test_customer_aisle_must_remain_open(self):
        position = self.rotation @ blender_point(self.entry["sockets"]["customer"])
        self.obstacle(position + Vector((0, 0, 0.5)), (0.3, 0.3, 1))
        with self.assertRaisesRegex(ValueError, "Volume réservé obstrué : customer"):
            validate_market(self.entry)


if __name__ == "__main__":
    result = unittest.main(argv=[sys.argv[0]], exit=False).result
    if not result.wasSuccessful():
        raise ValueError("Échec des tests de visibilité du marché.")
