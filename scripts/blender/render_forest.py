"""Produit une planche de contrôle depuis les GLB réimportés."""

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from asset_common import OUTPUT, import_model, mesh_bounds  # noqa: E402


def surface(name, color, emission=False):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = 1
    if emission:
        shader.inputs["Emission Color"].default_value = (*color, 1)
        shader.inputs["Emission Strength"].default_value = 1
    return material


def area_light(name, position, energy, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (
        (Vector((0, 0, 0.8)) - obj.location).to_track_quat("-Z", "Y").to_euler()
    )


def render_model(directory, entry, size):
    import_model(directory / entry["file"])
    root = bpy.data.objects[entry["id"]]
    root.scale = (2.3 / max(entry["dimensionsMeters"]),) * 3
    bpy.context.view_layer.update()
    low, high = mesh_bounds()
    root.location.x -= (low[0] + high[0]) / 2
    root.location.y -= (low[1] + high[1]) / 2
    height = high[2]

    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.012))
    bpy.context.object.data.materials.append(
        surface("preview-ground", (0.72, 0.78, 0.71))
    )
    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new("preview-world")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (
        0.72,
        0.81,
        0.85,
        1,
    )
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55
    area_light("key", (-3, -4, 6), 450, 4)
    area_light("fill", (4, -1, 3), 150, 3)
    area_light("rim", (0, 4, 5), 250, 3)
    data = bpy.data.cameras.new("preview-camera")
    camera = bpy.data.objects.new("preview-camera", data)
    bpy.context.collection.objects.link(camera)
    target = Vector((0, 0, height * 0.48))
    camera.location = target + Vector((4.5, -7.5, 5.0))
    camera.rotation_euler = (
        (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    )
    data.type = "ORTHO"
    data.ortho_scale = 3.55
    scene.camera = camera

    font = bpy.data.curves.new("preview-caption", "FONT")
    font.body = entry["id"]
    font.align_x = "CENTER"
    font.align_y = "CENTER"
    font.size = 0.13
    caption = bpy.data.objects.new("preview-caption", font)
    bpy.context.collection.objects.link(caption)
    caption.rotation_euler = camera.rotation_euler
    caption.location = camera.location + camera.rotation_euler.to_quaternion() @ Vector(
        (0, -1.52, -5)
    )
    caption.data.materials.append(surface("caption-ink", (0.015, 0.035, 0.028), True))

    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.cycles.seed = 73421
    scene.render.threads = 4
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "AgX"
    preview = directory / "previews" / f"{entry['id']}.png"
    scene.render.filepath = str(preview)
    bpy.ops.render.render(write_still=True)
    # La lecture du PNG conserve les couleurs de sortie dans la planche.
    image = bpy.data.images.load(str(preview), check_existing=False)
    pixels = np.empty(size * size * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    return pixels.reshape((size, size, 4))


def render(directory, size):
    entries = json.loads((directory / "manifest.json").read_text())["assets"]
    (directory / "previews").mkdir(exist_ok=True)
    columns = 5
    rows = math.ceil(len(entries) / columns)
    sheet = np.ones((rows * size, columns * size, 4), dtype=np.float32)
    for index, entry in enumerate(entries):
        pixels = render_model(directory, entry, size)
        row, column = divmod(index, columns)
        start = (rows - row - 1) * size
        sheet[start : start + size, column * size : (column + 1) * size] = pixels
    image = bpy.data.images.new(
        "forest-contact-sheet", columns * size, rows * size, alpha=True
    )
    image.pixels.foreach_set(sheet.ravel())
    image.filepath_raw = str(directory / "contact-sheet.png")
    image.file_format = "PNG"
    image.save()
    print(f"Planche de contrôle : {image.filepath_raw}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=OUTPUT)
    parser.add_argument("--size", type=int, default=320)
    args = parser.parse_args(
        sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    )
    render(args.input.resolve(), args.size)
