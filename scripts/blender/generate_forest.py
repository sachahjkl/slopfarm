"""Génère les modèles cartoon définitifs du jalon forêt."""

import argparse
import math
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from asset_common import (  # noqa: E402
    ATLAS_SIZE,
    OUTPUT,
    PALETTE,
    SEED,
    Model,
    add_clip,
    atlas_material,
    canonicalize_triangles,
    gltf_bounds,
    read_glb,
    reset_scene,
    sha256,
    triangles,
    write_json,
)
from camp_props import camp_catalog  # noqa: E402
from industry_props import industry_catalog  # noqa: E402


def build_character(model, worker=False, color="teal"):
    m = model
    for side, x in (("left", -0.23), ("right", 0.23)):
        m.box(
            f"{side}-boot",
            (x, -0.09, 0.13),
            (0.33, 0.52, 0.26),
            "leather",
            0.1,
            side + "-leg",
        )
        m.box(
            f"{side}-sole",
            (x, -0.10, 0.045),
            (0.35, 0.53, 0.09),
            "navy",
            0.04,
            side + "-leg",
        )
        m.blob(
            f"{side}-trousers", (x, 0, 0.49), (0.19, 0.22, 0.35), "navy", side + "-leg"
        )
        m.blob(
            f"{side}-sleeve",
            (x * 2.27, 0, 1.18),
            (0.23, 0.24, 0.30),
            color,
            side + "-arm",
        )
        m.blob(
            f"{side}-hand",
            (x * 2.44, -0.05, 0.91),
            (0.155, 0.17, 0.20),
            "skin",
            side + "-arm",
        )
        m.box(
            f"{side}-strap", (x * 0.8, -0.26, 1.2), (0.105, 0.08, 0.57), "canvas", 0.03
        )
    m.blob("shirt", (0, 0, 1.10), (0.47, 0.29, 0.43), color)
    m.box("belt", (0, -0.005, 0.86), (0.82, 0.51, 0.12), "leather", 0.045)
    m.box("belt-buckle", (0, -0.275, 0.86), (0.18, 0.045, 0.13), "gold", 0.025)
    m.blob("head", (0, -0.015, 1.65), (0.36, 0.31, 0.36), "skin", "head", segments=16)
    for side in (-1, 1):
        m.blob(
            "ear",
            (side * 0.34, -0.005, 1.66),
            (0.075, 0.08, 0.11),
            "skin",
            "head",
            segments=8,
        )
        m.blob(
            "eye",
            (side * 0.125, -0.301, 1.70),
            (0.041, 0.028, 0.056),
            "navy",
            "head",
            segments=8,
        )
        m.box(
            "eyebrow",
            (side * 0.125, -0.307, 1.79),
            (0.105, 0.03, 0.028),
            "bark",
            0.01,
            "head",
        )
    m.blob("nose", (0, -0.34, 1.61), (0.085, 0.095, 0.075), "skin", "head", segments=10)
    m.box("smile", (0, -0.305, 1.50), (0.13, 0.028, 0.035), "cream", 0.01, "head")
    m.blob("hair", (0, 0.04, 1.81), (0.355, 0.3, 0.22), "bark", "head")
    m.blob(
        "hat-crown",
        (0, 0.0, 1.97),
        (0.40, 0.35, 0.23),
        "gold" if worker else "canvas",
        "head",
    )
    m.blob(
        "hat-brim",
        (0, -0.055, 1.88),
        (0.49, 0.43, 0.075),
        "gold" if worker else "canvas",
        "head",
    )
    if worker:
        m.box(
            "helmet-ridge", (0, -0.005, 2.12), (0.10, 0.53, 0.10), "cream", 0.04, "head"
        )
    else:
        m.box(
            "hat-band", (0, -0.32, 1.96), (0.54, 0.07, 0.105), "leather", 0.03, "head"
        )
        m.blob(
            "hat-leaf",
            (0.30, 0.02, 2.18),
            (0.08, 0.07, 0.19),
            "leaf-light",
            "head",
            segments=8,
            bend=0.5,
        )
    scale = 0.76 if worker else 1.0
    m.blob(
        "large-backpack", (0, 0.40, 1.14), (0.47 * scale, 0.32, 0.54 * scale), "canvas"
    )
    m.box("backpack-flap", (0, 0.63, 1.42), (0.78 * scale, 0.16, 0.34), "leather", 0.1)
    for side in (-1, 1):
        m.box(
            "pack-buckle", (side * 0.20, 0.73, 1.30), (0.11, 0.045, 0.14), "gold", 0.025
        )
        m.blob(
            "pack-pocket",
            (side * 0.43 * scale, 0.41, 1.05),
            (0.14, 0.23, 0.25),
            "leather",
        )
    m.cylinder(
        "bedroll", (-0.45 * scale, 0.45, 1.73), (0.45 * scale, 0.45, 1.73), 0.14, color
    )
    m.socket("cargo-wood", (-0.25, 0.42, 1.87))
    m.socket("cargo-plank", (0.25, 0.42, 1.87))
    m.socket("tool-orbit", (0, 0, 0.9))
    m.socket("label", (0, 0, 2.55))
    rig_character(m)


def rig_character(model):
    m = model
    armature = bpy.data.armatures.new("human-skeleton")
    rig = bpy.data.objects.new("human-rig", armature)
    bpy.context.collection.objects.link(rig)
    rig.parent = m.root
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    points = {
        "root": ((0, 0, 0), (0, 0, 0.35), None),
        "body": ((0, 0, 0.85), (0, 0, 1.40), "root"),
        "head": ((0, 0, 1.45), (0, 0, 2.02), "body"),
        "left-arm": ((-0.46, 0, 1.34), (-0.57, 0, 0.88), "body"),
        "right-arm": ((0.46, 0, 1.34), (0.57, 0, 0.88), "body"),
        "left-leg": ((-0.23, 0, 0.78), (-0.23, 0, 0.13), "root"),
        "right-leg": ((0.23, 0, 0.78), (0.23, 0, 0.13), "root"),
    }
    for name, (head, tail, parent) in points.items():
        bone = armature.edit_bones.new(name)
        bone.head, bone.tail = head, tail
        if parent:
            bone.parent = armature.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    for group, parts in m.groups.items():
        for part in parts:
            weights = part.vertex_groups.new(name=group)
            weights.add(list(range(len(part.data.vertices))), 1.0, "REPLACE")
    mesh = m.join(m.parts, m.name + "-mesh")
    modifier = mesh.modifiers.new("human-skeleton", "ARMATURE")
    modifier.object = rig
    mesh.parent = rig
    for name in ("cargo-wood", "cargo-plank"):
        socket = m.sockets[name]
        matrix = socket.matrix_world.copy()
        socket.parent = rig
        socket.parent_type = "BONE"
        socket.parent_bone = "body"
        bpy.context.view_layer.update()
        socket.matrix_world = matrix

    def pose(clip, frame):
        phase = (frame - 1) / 24
        wave = math.sin(phase * math.tau)
        for bone in rig.pose.bones:
            bone.rotation_mode = "XYZ"
            bone.rotation_euler = (0, 0, 0)
            bone.location = (0, 0, 0)
        if clip == "idle":
            rig.pose.bones["body"].scale = (1, 1 + wave * 0.018, 1)
            rig.pose.bones["head"].rotation_euler.z = wave * 0.025
        elif clip == "walk":
            for side, sign in (("left", 1), ("right", -1)):
                rig.pose.bones[side + "-leg"].rotation_euler.x = wave * 0.48 * sign
                rig.pose.bones[side + "-arm"].rotation_euler.x = -wave * 0.38 * sign
            rig.pose.bones["root"].location.y = abs(wave) * 0.035
        elif clip == "attack":
            swing = math.sin(math.pi * phase) ** 2
            rig.pose.bones["body"].rotation_euler.y = swing * 0.28
            rig.pose.bones["right-arm"].rotation_euler.x = -swing * 1.25
            rig.pose.bones["left-arm"].rotation_euler.x = -swing * 0.55
        elif clip == "hit":
            rig.pose.bones["body"].rotation_euler.x = math.sin(phase * math.pi) * 0.20
            rig.pose.bones["head"].rotation_euler.x = -math.sin(phase * math.pi) * 0.15
        elif clip == "death":
            # La chute sert au Model Lab. Le jeu ne retire pas le personnage.
            rig.pose.bones["root"].rotation_euler.x = min(phase * 2, 1) * 1.2
        for bone in rig.pose.bones:
            bone.keyframe_insert("rotation_euler", frame=frame, group=bone.name)
            bone.keyframe_insert("location", frame=frame, group=bone.name)
            bone.keyframe_insert("scale", frame=frame, group=bone.name)

    for clip in ("idle", "walk", "attack", "hit", "death"):
        for bone in rig.pose.bones:
            bone.scale = (1, 1, 1)
        add_clip(rig, clip, range(1, 26, 2), lambda frame, clip=clip: pose(clip, frame))
    for bone in rig.pose.bones:
        bone.location = (0, 0, 0)
        bone.rotation_euler = (0, 0, 0)
        bone.scale = (1, 1, 1)
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()


def build_axe(m, reinforced=False):
    m.cylinder("handle", (0, 0, 0.09), (-0.06, 0, 1.10), 0.055, "wood", radius_end=0.07)
    for z in (0.14, 0.23, 0.32, 0.41):
        m.cylinder(
            "grip-wrap", (-0.008, 0, z), (-0.014, 0, z + 0.055), 0.067, "leather"
        )
    m.box("axe-socket", (-0.06, 0, 0.93), (0.20, 0.19, 0.26), "iron", 0.045)
    outline = [
        (-0.08, 1.07),
        (0.18, 1.10),
        (0.46, 1.21),
        (0.52, 1.02),
        (0.49, 0.77),
        (0.20, 0.86),
        (-0.08, 0.84),
    ]
    m.prism("broad-blade", outline, 0.12, "steel")
    m.prism(
        "cutting-edge",
        [
            (0.43, 1.20),
            (0.49, 1.22),
            (0.55, 1.02),
            (0.52, 0.76),
            (0.45, 0.79),
            (0.47, 1.02),
        ],
        0.135,
        "cream",
    )
    if reinforced:
        m.prism(
            "second-blade",
            [(-x - 0.12, z) for x, z in reversed(outline)],
            0.14,
            "steel",
        )
        m.prism(
            "second-edge",
            [
                (-0.55, 1.2),
                (-0.61, 1.22),
                (-0.67, 1.02),
                (-0.64, 0.76),
                (-0.57, 0.79),
                (-0.59, 1.02),
            ],
            0.15,
            "cream",
        )
        m.box("reinforced-collar", (-0.06, 0, 0.80), (0.19, 0.20, 0.11), "gold", 0.025)
        m.box("reinforced-cap", (-0.06, 0, 1.13), (0.19, 0.20, 0.09), "gold", 0.025)
    m.socket("grip", (0, 0, 0.28))
    m.socket("impact", (0.52, 0, 1.0))
    m.static_mesh()


def tree_base(m, height=1.8):
    m.cylinder(
        "trunk-base",
        (0, 0, 0.04),
        (0.07, 0.01, height * 0.52),
        0.28,
        "bark",
        radius_end=0.21,
        vertices=9,
    )
    m.cylinder(
        "curved-trunk",
        (0.07, 0.01, height * 0.48),
        (-0.04, 0, height),
        0.22,
        "wood",
        radius_end=0.13,
        vertices=9,
    )
    for index in range(5):
        angle = index * math.tau / 5
        m.cylinder(
            "root",
            (0, 0, 0.22),
            (math.cos(angle) * 0.51, math.sin(angle) * 0.45, 0.06),
            0.13,
            "bark",
            radius_end=0.05,
            vertices=7,
        )


def build_tree(m, variant=1):
    height = [1.9, 2.1, 1.7, 2.3, 1.95][variant - 1]
    tree_base(m, height)
    silhouettes = [
        [
            (-0.52, 0.04, 2.05, 0.83, 0.75),
            (0.54, 0.10, 2.24, 0.88, 0.84),
            (0, -0.12, 2.75, 0.87, 0.89),
        ],
        [
            (-0.42, 0.05, 2.05, 0.68, 0.86),
            (0.34, 0.06, 2.68, 0.74, 0.91),
            (-0.15, -0.12, 3.16, 0.62, 0.73),
        ],
        [
            (-0.72, 0.05, 1.90, 0.92, 0.66),
            (0.70, 0.05, 1.93, 0.93, 0.70),
            (0, -0.08, 2.41, 1.04, 0.70),
        ],
        [
            (-0.58, 0.10, 2.26, 0.78, 0.92),
            (0.48, 0.05, 2.42, 0.74, 0.99),
            (0.02, -0.12, 3.03, 0.82, 0.91),
        ],
        [
            (-0.66, 0.03, 2.25, 0.82, 0.87),
            (0.57, 0.10, 2.04, 0.88, 0.70),
            (-0.28, -0.09, 2.86, 0.77, 0.85),
        ],
    ]
    for index, (x, y, z, width, height) in enumerate(silhouettes[variant - 1]):
        m.cylinder(
            "branch",
            (0, 0, 1.25),
            (x, y, z - 0.2),
            0.12,
            "wood",
            radius_end=0.065,
            vertices=7,
        )
        m.blob(
            "rounded-canopy",
            (x, y, z),
            (width, width * 0.88, height),
            ["leaf", "leaf-dark", "leaf-light"][index],
            segments=10,
            rings=7,
            bend=0.10,
        )
        m.blob(
            "leaf-lobe",
            (x + 0.19, y - width * 0.60, z + 0.23),
            (width * 0.55, width * 0.49, height * 0.49),
            "leaf-light" if index == 2 else "leaf",
            segments=8,
            rings=5,
        )
    m.socket("harvest", (0, 0, 0.8))
    m.socket("regrowth", (0, 0, 0))
    m.static_mesh()


def build_stump(m, sapling=False):
    m.cylinder(
        "stump-bark",
        (0, 0, 0),
        (0, 0, 0.30),
        0.29,
        "bark",
        radius_end=0.24,
        vertices=10,
    )
    m.cylinder("cut-face", (0, 0, 0.30), (0, 0, 0.313), 0.215, "cut", vertices=10)
    for radius in (0.10, 0.17):
        m.torus("growth-ring", (0, 0, 0.315), radius, 0.009, "wood", segments=10)
    for index in range(4):
        angle = index * math.pi / 2
        m.cylinder(
            "root",
            (0, 0, 0.16),
            (math.cos(angle) * 0.43, math.sin(angle) * 0.38, 0.05),
            0.10,
            "bark",
            radius_end=0.035,
            vertices=6,
        )
    if sapling:
        m.cylinder(
            "new-stem",
            (0.05, 0, 0.31),
            (0.0, 0, 1.04),
            0.04,
            "wood",
            radius_end=0.018,
            vertices=7,
        )
        for x, z in ((-0.19, 0.66), (0.20, 0.83), (-0.12, 1.05)):
            m.blob(
                "new-leaf",
                (x, 0, z),
                (0.25, 0.11, 0.17),
                "leaf-light",
                segments=8,
                rings=5,
                bend=0.24,
            )
    m.socket("regrowth", (0, 0, 0))
    m.static_mesh()


def log_parts(m, center=(0, 0, 0.17), length=0.76, radius=0.16, group="body"):
    x, y, z = center
    m.cylinder(
        "log-bark",
        (x - length / 2, y, z),
        (x + length / 2, y, z),
        radius,
        "bark",
        vertices=10,
        group=group,
    )
    for side in (-1, 1):
        end = x + side * length / 2
        m.cylinder(
            "log-cut",
            (end, y, z),
            (end + side * 0.008, y, z),
            radius * 0.87,
            "cut",
            vertices=10,
            group=group,
        )
        m.cylinder(
            "log-heart",
            (end + side * 0.009, y, z),
            (end + side * 0.011, y, z),
            radius * 0.27,
            "wood",
            vertices=8,
            group=group,
        )


def build_log(m):
    log_parts(m)
    m.static_mesh()


def build_plank(m):
    m.box("plank", (0, 0, 0.055), (0.88, 0.22, 0.11), "cut", 0.025)
    m.box("wood-grain", (0.02, -0.045, 0.111), (0.62, 0.014, 0.004), "wood", 0)
    m.static_mesh()


def build_coin(m):
    m.cylinder("coin", (0, 0, 0), (0, 0, 0.05), 0.14, "gold", vertices=12)
    m.cylinder("coin-stamp", (0, 0, 0.05), (0, 0, 0.058), 0.105, "cut", vertices=12)
    m.box("coin-mark", (0, 0, 0.062), (0.04, 0.12, 0.009), "gold", 0)
    m.static_mesh()


def build_sale_bench(m):
    for x in (-0.83, 0.83):
        for y in (-0.33, 0.33):
            m.box("bench-leg", (x, y, 0.48), (0.22, 0.22, 0.96), "wood", 0.065)
    m.box("bench-brace", (0, 0.30, 0.35), (1.85, 0.14, 0.20), "bark", 0.04)
    for y in (-0.31, 0, 0.31):
        m.box("counter-plank", (0, y, 1.02), (2.1, 0.30, 0.17), "cut", 0.055)
    m.box("reception-tray", (-0.53, 0, 1.15), (0.88, 0.76, 0.10), "wood", 0.05)
    m.box("coin-tray", (0.57, 0, 1.15), (0.62, 0.65, 0.10), "teal", 0.04)
    for y in (-0.32, 0.32):
        m.box("tray-rim", (0.57, y, 1.21), (0.68, 0.065, 0.15), "teal", 0.025)
    for x in (-0.89, 0.89):
        m.cylinder("awning-post", (x, 0.36, 0), (x, 0.36, 2.20), 0.07, "wood")
    m.box("sale-sign", (0, 0.36, 2.05), (1.68, 0.16, 0.45), "teal", 0.12)
    m.cylinder(
        "coin-sign", (0, 0.255, 2.05), (0, 0.22, 2.05), 0.16, "gold", vertices=12
    )
    for side in (-1, 1):
        m.box(
            "sign-mark", (side * 0.47, 0.245, 2.05), (0.25, 0.025, 0.055), "cream", 0.02
        )
    m.socket("deposit", (-0.53, 0, 1.22))
    m.socket("coins", (0.57, 0, 1.25))
    m.socket("interaction", (0, -1.0, 0))
    m.static_mesh()


def gear(m, center, radius=0.46, group="body", color="gold"):
    x, y, z = center
    m.cylinder(
        "gear-disc",
        (x, y - 0.07, z),
        (x, y + 0.07, z),
        radius * 0.80,
        color,
        vertices=16,
        group=group,
    )
    for index in range(12):
        angle = index * math.tau / 12
        m.box(
            "gear-tooth",
            (x + radius * math.cos(angle), y, z + radius * math.sin(angle)),
            (radius * 0.35, 0.16, radius * 0.25),
            color,
            0.025,
            group,
            (0, -angle, 0),
        )
    m.cylinder(
        "gear-hub",
        (x, y - 0.13, z),
        (x, y + 0.13, z),
        radius * 0.27,
        "iron",
        vertices=10,
        group=group,
    )


def conveyor_parts(m, center=(0, 0, 0), length=2.0, angle=0):
    x, y, z = center

    def position(px, py, pz):
        return (
            x + px * math.cos(angle) - py * math.sin(angle),
            y + px * math.sin(angle) + py * math.cos(angle),
            z + pz,
        )

    for side in (-1, 1):
        m.box(
            "conveyor-rail",
            position(side * 0.48, 0, 0.54),
            (0.12, length, 0.23),
            "teal",
            0.045,
            rotation=(0, 0, angle),
        )
        for end in (-1, 1):
            m.box(
                "conveyor-leg",
                position(side * 0.40, end * (length / 2 - 0.16), 0.22),
                (0.13, 0.16, 0.44),
                "iron",
                0.03,
                rotation=(0, 0, angle),
            )
    for index in range(round(length / 0.22)):
        py = -length / 2 + 0.12 + index * 0.22
        m.cylinder(
            "roller",
            position(-0.40, py, 0.53),
            position(0.40, py, 0.53),
            0.085,
            "wood" if index % 2 else "cut",
            vertices=8,
        )


def build_conveyor(m, kind="straight"):
    if kind == "corner":
        # Les deux connecteurs définissent un virage de 90 degrés sur la grille.
        conveyor_parts(m, (0, -0.5, 0), 1.0)
        conveyor_parts(m, (0.5, 0, 0), 1.0, math.pi / 2)
        m.cylinder(
            "corner-turntable", (0, 0, 0.44), (0, 0, 0.60), 0.45, "cut", vertices=12
        )
        m.socket("input", (0, -1, 0.62))
        m.socket("output", (1, 0, 0.62))
    else:
        conveyor_parts(m, length=2)
        if kind == "end":
            m.box("end-bin", (0, 0.76, 0.78), (0.96, 0.32, 0.52), "teal", 0.07)
        m.socket("input", (0, -1, 0.62))
        m.socket("output", (0, 1, 0.62))
    m.static_mesh()


def animate_rotation(model, group, pivot, clip="idle", seconds=1):
    moving = model.groups.pop(group)
    base = [part for part in model.parts if part not in moving]
    model.join(base, model.name + "-body")
    obj = model.join(moving, group)
    bpy.context.scene.cursor.location = pivot
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    obj.rotation_mode = "XYZ"

    def pose(frame):
        obj.rotation_euler.y = (frame - 1) / (24 * seconds) * math.tau
        obj.keyframe_insert("rotation_euler", frame=frame)

    add_clip(
        obj,
        clip,
        (1, 1 + 6 * seconds, 1 + 12 * seconds, 1 + 18 * seconds, 1 + 24 * seconds),
        pose,
    )
    obj.rotation_euler = (0, 0, 0)
    bpy.context.scene.frame_set(1)


def build_sawmill(m, tier=1):
    width = 2.6 + (tier - 1) * 0.38
    depth = 1.65 + (tier - 1) * 0.30
    m.box("stone-foundation", (0, 0, 0.13), (width, depth, 0.26), "iron", 0.12)
    for x in (-0.95, 0.95):
        for y in (-0.5, 0.5):
            m.box("workbench-leg", (x, y, 0.70), (0.24, 0.23, 1.0), "wood", 0.06)
    for y in (-0.47, -0.15, 0.17, 0.49):
        m.box("cutting-table", (0, y, 1.20), (2.45, 0.31, 0.18), "cut", 0.04)
    m.box("saw-housing", (0.30, 0.18, 0.85), (0.68, 0.56, 0.60), "teal", 0.12)
    gear(m, (0.20, 0, 1.3), 0.43, "saw-blade", "steel")
    log_parts(m, (-0.63, -0.30, 1.43), 0.93, 0.16)
    m.box(
        "tier-plaque", (0.7, -depth / 2 - 0.02, 0.36), (0.80, 0.08, 0.24), "teal", 0.04
    )
    for index in range(tier):
        m.box(
            "tier-mark",
            (0.44 + index * 0.17, -depth / 2 - 0.07, 0.36),
            (0.10, 0.04, 0.13),
            "gold",
            0.02,
        )
    if tier >= 2:
        for x in (-1.05, 1.05):
            m.cylinder("canopy-post", (x, 0.56, 0.26), (x, 0.56, 2.38), 0.10, "wood")
        for index in range(6):
            m.box(
                "canopy-slat",
                (-1.0 + index * 0.40, 0.10, 2.35),
                (0.42, 1.80, 0.19),
                "teal" if index % 2 == 0 else "cream",
                0.055,
                rotation=(0.10, 0, 0),
            )
        for index in range(3):
            log_parts(m, (-width / 2 + 0.28, 0.04, 0.43 + index * 0.28), 0.55, 0.13)
        m.box("worker-locker", (1.10, 0.24, 0.70), (0.44, 0.62, 0.83), "leather", 0.09)
    if tier >= 3:
        m.box("motor", (width / 2 - 0.34, 0.26, 0.74), (0.55, 0.83, 0.86), "teal", 0.16)
        gear(m, (width / 2 - 0.33, -0.23, 0.81), 0.29)
        m.cylinder(
            "drive-pipe",
            (0.48, 0.34, 0.76),
            (width / 2 - 0.35, 0.34, 0.76),
            0.11,
            "gold",
        )
        for index in range(4):
            m.box(
                "output-planks",
                (0.20, depth / 2 - 0.30, 0.35 + index * 0.14),
                (1.15, 0.32, 0.12),
                "cut",
                0.025,
            )
        m.socket("conveyor-input", (-width / 2, 0, 0.62))
    if tier >= 4:
        m.cylinder(
            "boiler",
            (width / 2 - 0.38, 0.40, 0.29),
            (width / 2 - 0.38, 0.40, 1.90),
            0.35,
            "coral",
            vertices=16,
        )
        m.blob("boiler-cap", (width / 2 - 0.38, 0.40, 1.90), (0.35, 0.35, 0.19), "gold")
        for z in (0.64, 1.5):
            m.torus("boiler-band", (width / 2 - 0.38, 0.40, z), 0.35, 0.045, "gold")
        m.cylinder(
            "chimney",
            (width / 2 - 0.38, 0.40, 2.0),
            (width / 2 - 0.38, 0.40, 2.87),
            0.12,
            "iron",
        )
        m.blob(
            "chimney-cap", (width / 2 - 0.38, 0.40, 2.87), (0.21, 0.21, 0.09), "gold"
        )
        m.box(
            "delivery-crate",
            (-0.70, depth / 2 - 0.24, 0.67),
            (0.95, 0.57, 0.80),
            "wood",
            0.08,
        )
        for x in (-1.06, -0.35):
            m.box(
                "crate-band",
                (x, depth / 2 - 0.55, 0.68),
                (0.075, 0.04, 0.64),
                "gold",
                0.02,
            )
        m.socket("conveyor-output", (width / 2, 0, 0.62))
    m.socket("deposit", (-0.80, -0.30, 1.60))
    m.socket("output", (0.25, depth / 2 - 0.3, 0.90))
    m.socket("worker", (-1.1, -1.0, 0))
    m.socket("smoke", (width / 2 - 0.38, 0.40, 3.0))
    m.center_base()
    pivot = next(
        part for part in m.groups["saw-blade"] if part.name.startswith("gear-disc")
    ).location.copy()
    animate_rotation(m, "saw-blade", pivot)


def build_upgrade_zone(m):
    m.cylinder("upgrade-pad", (0, 0, 0), (0, 0, 0.075), 1.0, "teal", vertices=32)
    m.torus("upgrade-rim", (0, 0, 0.075), 0.94, 0.035, "gold", segments=32)
    arrow = m.prism(
        "upgrade-arrow",
        [
            (-0.11, -0.49),
            (0.11, -0.49),
            (0.11, 0.12),
            (0.39, 0.12),
            (0, 0.58),
            (-0.39, 0.12),
            (-0.11, 0.12),
        ],
        0.035,
        "cream",
        bevel=0,
    )
    arrow.rotation_euler.x = math.pi / 2
    arrow.location.z = 0.095
    for x in (-0.78, 0.78):
        m.cylinder("marker-post", (x, 0.62, 0.05), (x, 0.62, 0.73), 0.065, "wood")
        m.blob("marker-cap", (x, 0.62, 0.80), (0.12, 0.12, 0.12), "gold", segments=8)
    m.socket("interaction", (0, 0, 0.08))
    m.socket("label", (0, 0, 1.45))
    m.static_mesh()


def build_monument(m, stage=1):
    m.cylinder(
        "monument-foundation", (0, 0, 0), (0, 0, 0.30), 2.20, "iron", vertices=12
    )
    m.cylinder(
        "monument-plinth", (0, 0, 0.30), (0, 0, 0.55), 1.95, "cream", vertices=12
    )
    for index in range(8):
        angle = index * math.tau / 8
        x, y = math.cos(angle) * 1.57, math.sin(angle) * 1.57
        m.box(
            "timber-anchor",
            (x, y, 0.90),
            (0.43, 0.43, 0.80),
            "wood",
            0.09,
            rotation=(0, 0, angle),
        )
        m.blob("anchor-cap", (x, y, 1.29), (0.24, 0.24, 0.12), "gold", segments=8)
    m.cylinder("core-base", (0, 0, 0.55), (0, 0, 1.35), 0.92, "teal", vertices=16)
    m.torus("core-ring", (0, 0, 1.36), 0.92, 0.12, "gold", segments=24)
    m.box("progress-plaque", (0, -1.96, 0.58), (1.24, 0.10, 0.32), "teal", 0.05)
    for index in range(stage):
        m.box(
            "stage-mark",
            (-0.30 + index * 0.30, -2.025, 0.58),
            (0.18, 0.06, 0.18),
            "gold",
            0.035,
        )
    if stage >= 2:
        for x in (-1.17, 1.17):
            m.box("timber-tower", (x, 0.33, 2.04), (0.43, 0.53, 2.98), "wood", 0.12)
            for z in (1.3, 2.4, 3.38):
                m.box("tower-band", (x, 0.33, z), (0.49, 0.59, 0.14), "gold", 0.04)
        m.box("cross-beam", (0, 0.33, 3.44), (2.95, 0.65, 0.39), "cut", 0.12)
        m.cylinder("flywheel-axle", (0, -0.59, 2.10), (0, 0.69, 2.10), 0.17, "iron")
        gear(m, (0, -0.37, 2.10), 0.98, "flywheel", "gold")
        m.torus(
            "flywheel-rim",
            (0, -0.37, 2.10),
            0.73,
            0.075,
            "cream",
            (math.pi / 2, 0, 0),
            "flywheel",
            24,
        )
    if stage >= 3:
        m.cylinder(
            "reactor", (0, 0.56, 1.33), (0, 0.56, 3.75), 0.70, "coral", vertices=20
        )
        m.blob(
            "reactor-dome", (0, 0.56, 3.75), (0.70, 0.70, 0.47), "coral", segments=16
        )
        for z in (1.5, 2.95, 3.64):
            m.torus("reactor-band", (0, 0.56, z), 0.70, 0.085, "gold", segments=20)
        for side in (-1, 1):
            m.cylinder(
                "steam-pipe",
                (side * 1.52, 0.60, 0.58),
                (side * 1.52, 0.60, 3.86),
                0.16,
                "teal",
            )
            m.cylinder(
                "pipe-elbow",
                (side * 1.52, 0.60, 3.86),
                (side * 0.52, 0.60, 3.86),
                0.16,
                "teal",
            )
            m.blob(
                "pipe-joint",
                (side * 1.52, 0.60, 3.86),
                (0.20, 0.20, 0.20),
                "gold",
                segments=10,
            )
        m.cylinder("beacon-stem", (0, 0.56, 4.13), (0, 0.56, 4.72), 0.13, "iron")
        m.blob("beacon-seed", (0, 0.56, 4.85), (0.28, 0.28, 0.36), "gold", segments=12)
        m.blob(
            "beacon-leaf",
            (0.24, 0.56, 4.91),
            (0.25, 0.11, 0.13),
            "leaf-light",
            segments=8,
        )
    m.socket("deposit", (0, -2.45, 0.1))
    m.socket("next-stage", (0, 0, 1.4 if stage == 1 else 3.6 if stage == 2 else 5.3))
    m.socket("beacon", (0, 0.56, 5.2))
    m.center_base()
    if stage >= 2:
        pivot = next(
            part for part in m.groups["flywheel"] if part.name.startswith("gear-disc")
        ).location.copy()
        animate_rotation(m, "flywheel", pivot, seconds=4)
    else:
        m.join(m.parts, m.name + "-mesh")


def catalog():
    for family, worker in (("adventurer", False), ("worker", True)):
        for variant, color in enumerate(("teal", "coral", "leaf"), 1):
            name = family if variant == 1 else f"{family}-{color}"
            yield (
                name,
                "character",
                8000,
                {"family": family, "variant": variant},
                lambda m, worker=worker, color=color: build_character(m, worker, color),
            )
    yield "axe-simple", "tool", 1500, {"form": 1}, build_axe
    yield (
        "axe-reinforced-double",
        "tool",
        1500,
        {"form": 2},
        lambda m: build_axe(m, True),
    )
    for variant in range(1, 6):
        yield (
            f"tree-{variant:02}",
            "tree",
            1500,
            {"family": "tree", "variant": variant},
            lambda m, variant=variant: build_tree(m, variant),
        )
    yield "tree-stump", "tree", 1500, {"state": "depleted"}, build_stump
    yield (
        "tree-regrowth",
        "tree",
        1500,
        {"state": "regrowing"},
        lambda m: build_stump(m, True),
    )
    yield (
        "log",
        "stackable",
        200,
        {"instanceRotationsDegrees": [0, 60, 120, 180, 240, 300]},
        build_log,
    )
    yield (
        "plank",
        "stackable",
        200,
        {"instanceRotationsDegrees": [0, 60, 120, 180, 240, 300]},
        build_plank,
    )
    yield (
        "coin",
        "stackable",
        200,
        {"instanceRotationsDegrees": [0, 60, 120, 180, 240, 300]},
        build_coin,
    )
    yield "sale-bench", "building", 12000, {}, build_sale_bench
    for tier in range(1, 5):
        yield (
            f"sawmill-tier-{tier}",
            "building",
            12000,
            {"family": "sawmill", "tier": tier},
            lambda m, tier=tier: build_sawmill(m, tier),
        )
    for kind in ("straight", "corner", "end"):
        yield (
            f"conveyor-{kind}",
            "building",
            12000,
            {
                "family": "conveyor",
                "module": kind,
                "gridMeters": 1,
                "surfaceHeightMeters": 0.62,
            },
            lambda m, kind=kind: build_conveyor(m, kind),
        )
    yield "upgrade-zone", "building", 12000, {}, build_upgrade_zone
    for stage in range(1, 4):
        yield (
            f"monument-stage-{stage}",
            "building",
            12000,
            {"family": "monument", "stage": stage},
            lambda m, stage=stage: build_monument(m, stage),
        )
    yield from camp_catalog()
    yield from industry_catalog()


def generate(directory):
    directory.mkdir(parents=True, exist_ok=True)
    entries = []
    for name, kind, budget, details, build in catalog():
        reset_scene()
        material = atlas_material(directory)
        model = Model(name, material)
        build(model)
        bpy.context.view_layer.update()
        bounds = gltf_bounds()
        count = triangles()
        if count > budget:
            raise ValueError(
                f"{name} : {count} triangles dépassent le budget {budget}."
            )
        model.root["assetId"] = name
        model.root["forward"] = "+Z"
        model.root["units"] = "meters"
        sockets = {}
        for socket_name, socket in model.sockets.items():
            point = socket.matrix_world.translation
            sockets[socket_name] = [
                round(point.x, 5),
                round(point.z, 5),
                round(-point.y, 5),
            ]
        path = directory / f"{name}.glb"
        bpy.ops.export_scene.gltf(
            filepath=str(path),
            export_format="GLB",
            export_yup=True,
            export_apply=False,
            export_texcoords=True,
            export_normals=True,
            export_materials="EXPORT",
            export_image_format="AUTO",
            export_animations=True,
            export_animation_mode="NLA_TRACKS",
            export_nla_strips=True,
            export_force_sampling=True,
            export_frame_range=False,
            export_anim_slide_to_zero=True,
            export_skins=True,
            export_morph=False,
            export_cameras=False,
            export_lights=False,
            export_extras=True,
        )
        canonicalize_triangles(path)
        document, _ = read_glb(path)
        entries.append(
            {
                "id": name,
                "file": path.name,
                "name": name,
                "kind": kind,
                "dimensionsMeters": [
                    round(high - low, 5)
                    for low, high in zip(bounds["min"], bounds["max"])
                ],
                "boundsMeters": bounds,
                "origin": "feet" if kind == "character" else "base-center",
                "forward": "+Z",
                "triangles": count,
                "triangleBudget": budget,
                "textureSize": [ATLAS_SIZE, ATLAS_SIZE],
                "textureBudget": [2048, 2048] if kind == "building" else [1024, 1024],
                "materials": [material.name],
                "animations": [clip["name"] for clip in document.get("animations", [])],
                "skeleton": "human-skeleton" if kind == "character" else None,
                "sockets": sockets,
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
                **details,
            }
        )
        print(
            f"EXPORT {name}: {count}/{budget} triangles, {path.stat().st_size} octets"
        )
    write_json(
        directory / "manifest.json",
        {
            "schemaVersion": 1,
            "biome": "forest",
            "generator": "scripts/blender/generate_forest.py",
            "blenderVersion": bpy.app.version_string,
            "seed": SEED,
            "units": "meters",
            "up": "+Y",
            "forward": "+Z",
            "ground": 0,
            "atlas": {
                "file": "forest-atlas.png",
                "size": [ATLAS_SIZE, ATLAS_SIZE],
                "sha256": sha256(directory / "forest-atlas.png"),
                "palette": PALETTE,
            },
            "assets": entries,
        },
    )
    print(f"Génération terminée : {len(entries)} GLB dans {directory}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args(
        sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    )
    generate(args.output.resolve())
