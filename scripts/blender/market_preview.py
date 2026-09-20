"""Ajoute un vendeur et les piles de contrôle sans les exporter en GLB."""

import bpy
from mathutils import Matrix, Vector

from asset_common import Model, model_meshes
from market_visibility import blender_point, item_offset, runtime_layout


def add_market_scene(directory, entry, wood_count, coin_count):
    layout = runtime_layout()
    root = bpy.data.objects[entry["id"]]
    root.rotation_mode = "XYZ"
    root.rotation_euler.z = layout["yawRadians"]
    bpy.context.view_layer.update()
    for name, expected in (
        (
            "stock",
            Vector(
                (
                    layout["wood"]["center"][0],
                    -layout["wood"]["center"][2],
                    layout["wood"]["center"][1] - layout["wood"]["size"][1] / 2,
                )
            ),
        ),
        ("coins", blender_point(layout["coins"]["center"])),
    ):
        if (bpy.data.objects[name].matrix_world.translation - expected).length > 0.0002:
            raise ValueError(f"Le rendu désaligne le point {name} et la pile du jeu.")
    material = model_meshes()[0].data.materials[0]
    stock = Model("preview-stock", material)
    wood = layout["wood"]
    for index in range(wood_count):
        dx, dz, angle = item_offset(layout, index)
        position = blender_point(wood["center"]) + Vector(
            (dx, -dz, index * wood["step"])
        )
        stock.box(
            "stock-block",
            position,
            (wood["size"][0], wood["size"][2], wood["size"][1]),
            "leather",
            0.045,
            rotation=(0, 0, angle),
        )
        stock.cylinder(
            "end-grain",
            position + Vector((0, 0, 0.15)),
            position + Vector((0, 0, 0.168)),
            0.105,
            "cut",
            vertices=12,
        )
    if coin_count:
        before = set(bpy.context.scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(directory / "coin.glb"))
        imported = set(bpy.context.scene.objects) - before
        bpy.context.view_layer.update()
        source = next(obj for obj in imported if obj.type == "MESH")
        for index in range(coin_count):
            dx, dz, angle = item_offset(layout, index)
            position = blender_point(layout["coins"]["center"]) + Vector(
                (dx, -dz, index * layout["coins"]["step"])
            )
            copy = source.copy()
            bpy.context.collection.objects.link(copy)
            copy.parent = None
            copy.matrix_world = (
                Matrix.Translation(position)
                @ Matrix.Rotation(angle, 4, "Z")
                @ Matrix.Scale(layout["coins"]["scale"], 4)
                @ source.matrix_world
            )
        for obj in imported:
            bpy.data.objects.remove(obj, do_unlink=True)
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(directory / "worker.glb"))
    seller = bpy.data.objects.new("preview-seller", None)
    bpy.context.collection.objects.link(seller)
    for obj in set(bpy.context.scene.objects) - before - {seller}:
        if obj.parent is None:
            obj.parent = seller
        if obj.animation_data:
            obj.animation_data.action = None
            for track in obj.animation_data.nla_tracks:
                track.mute = True
        if obj.type == "ARMATURE":
            obj.data.pose_position = "REST"
    seller.scale = (0.8,) * 3
    seller.location = Matrix.Rotation(layout["yawRadians"], 4, "Z") @ blender_point(
        entry["sockets"]["worker"]
    )
    group = bpy.data.objects.new("preview-assembly", None)
    bpy.context.collection.objects.link(group)
    for obj in list(bpy.context.scene.objects):
        if obj != group and obj.parent is None:
            obj.parent = group
    bpy.context.scene.frame_set(0)
    bpy.context.view_layer.update()
    return group, blender_point(layout["cameraOffset"])
