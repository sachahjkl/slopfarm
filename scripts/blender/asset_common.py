"""Fonctions communes au générateur et au validateur Blender."""

import hashlib
import json
import math
import struct
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "assets" / "forest"
SEED = 73421
ATLAS_SIZE = 1024
PALETTE = {
    "bark": "76503b",
    "wood": "b6804d",
    "cut": "e5ba75",
    "leaf": "53934d",
    "leaf-light": "82b85a",
    "leaf-dark": "326b48",
    "teal": "388d91",
    "navy": "304b63",
    "canvas": "d8ac67",
    "leather": "965437",
    "skin": "f0b887",
    "cream": "f8e7b7",
    "steel": "aac8c6",
    "iron": "57787e",
    "gold": "eabd4b",
    "coral": "da7052",
}


def write_json(path, value):
    def normalize(item):
        if isinstance(item, dict):
            return {key: normalize(value) for key, value in item.items()}
        if isinstance(item, list):
            return [normalize(value) for value in item]
        if isinstance(item, float) and item.is_integer():
            return int(item)
        return item

    path.write_text(json.dumps(normalize(value), ensure_ascii=False, indent=2) + "\n")


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_glb(path):
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", raw)
    if magic != b"glTF" or version != 2 or length != len(raw):
        raise ValueError(f"En-tête GLB invalide : {path.name}")
    offset = 12
    chunks = {}
    while offset < length:
        size, kind = struct.unpack_from("<I4s", raw, offset)
        offset += 8
        if size % 4 or offset + size > length or kind in chunks:
            raise ValueError(f"Bloc GLB invalide : {path.name}")
        chunks[kind] = raw[offset : offset + size]
        offset += size
    return json.loads(chunks[b"JSON"]), chunks[b"BIN\x00"]


def canonicalize_triangles(path):
    """Fixe l’ordre des triangles, variable entre les processus Blender."""
    document, _ = read_glb(path)
    raw = bytearray(path.read_bytes())
    offset = 12
    while offset < len(raw):
        size, kind = struct.unpack_from("<I4s", raw, offset)
        if kind == b"BIN\x00":
            binary_offset = offset + 8
            break
        offset += size + 8
    for mesh in document["meshes"]:
        for primitive in mesh["primitives"]:
            accessor = document["accessors"][primitive["indices"]]
            view = document["bufferViews"][accessor["bufferView"]]
            code, size = {5121: ("B", 1), 5123: ("H", 2), 5125: ("I", 4)}[
                accessor["componentType"]
            ]
            start = (
                binary_offset
                + view.get("byteOffset", 0)
                + accessor.get("byteOffset", 0)
            )
            stride = view.get("byteStride", size)
            indices = [
                struct.unpack_from("<" + code, raw, start + index * stride)[0]
                for index in range(accessor["count"])
            ]
            faces = []
            for index in range(0, len(indices), 3):
                face = tuple(indices[index : index + 3])
                faces.append(min(face, face[1:] + face[:1], face[2:] + face[:2]))
            for index, value in enumerate(
                value for face in sorted(faces) for value in face
            ):
                struct.pack_into("<" + code, raw, start + index * stride, value)
    path.write_bytes(raw)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.fps = 24
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 1
    scene.frame_start = 1
    scene.frame_end = 25


def model_meshes(objects=None):
    objects = list(objects if objects is not None else bpy.context.scene.objects)
    shapes = {
        bone.custom_shape
        for obj in objects
        if obj.type == "ARMATURE"
        for bone in obj.pose.bones
        if bone.custom_shape
    }
    return [obj for obj in objects if obj.type == "MESH" and obj not in shapes]


def import_model(path):
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(path), import_shading="NORMALS")
    bpy.context.scene.frame_set(0)
    for obj in bpy.context.scene.objects:
        if obj.animation_data:
            obj.animation_data.action = None
            for track in obj.animation_data.nla_tracks:
                track.mute = True
        if obj.type == "ARMATURE":
            obj.data.pose_position = "REST"
    bpy.context.view_layer.update()


def mesh_bounds(objects=None, evaluated=False):
    graph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in model_meshes(objects):
        source = obj.evaluated_get(graph) if evaluated else obj
        points.extend(
            source.matrix_world @ vertex.co for vertex in source.data.vertices
        )
    if not points:
        raise ValueError("Le modèle ne contient aucun maillage.")
    low = [min(point[axis] for point in points) for axis in range(3)]
    high = [max(point[axis] for point in points) for axis in range(3)]
    return low, high


def gltf_bounds(evaluated=False):
    low, high = mesh_bounds(evaluated=evaluated)
    return {
        "min": [round(low[0], 5), round(low[2], 5), round(-high[1], 5)],
        "max": [round(high[0], 5), round(high[2], 5), round(-low[1], 5)],
    }


def triangles():
    total = 0
    for obj in model_meshes():
        obj.data.calc_loop_triangles()
        total += len(obj.data.loop_triangles)
    return total


def atlas_material(directory):
    import numpy as np

    image = bpy.data.images.new("forest-atlas", ATLAS_SIZE, ATLAS_SIZE, alpha=False)
    pixels = np.ones((ATLAS_SIZE, ATLAS_SIZE, 4), dtype=np.float32)
    tile = ATLAS_SIZE // 4
    y, x = np.mgrid[0:tile, 0:tile] / tile
    for index, color in enumerate(PALETTE.values()):
        rgb = np.array([int(color[n : n + 2], 16) / 255 for n in (0, 2, 4)])
        # Les variations larges restent visibles à la distance de jeu.
        brush = (
            0.97
            + 0.038 * np.sin(x * 10 + np.sin(y * 8) + index + SEED % 101)
            + 0.022 * np.cos(y * 21 + x * 5)
            + 0.035 * (y - 0.5)
        )
        row, column = divmod(index, 4)
        pixels[
            row * tile : (row + 1) * tile, column * tile : (column + 1) * tile, :3
        ] = np.clip(brush[:, :, None] * rgb, 0, 1)
    image.pixels.foreach_set(pixels.ravel())
    image.filepath_raw = str(directory / "forest-atlas.png")
    image.file_format = "PNG"
    image.save()
    image.pack()
    material = bpy.data.materials.new("forest-painted-matte")
    material.use_nodes = True
    material.use_backface_culling = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = 0.86
    shader.inputs["Metallic"].default_value = 0.0
    texture = material.node_tree.nodes.new("ShaderNodeTexImage")
    texture.image = image
    texture.interpolation = "Linear"
    material.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    return material


class Model:
    def __init__(self, name, material):
        self.name = name
        self.material = material
        self.parts = []
        self.groups = {}
        self.sockets = {}
        self.root = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(self.root)

    def finish(self, obj, name, color, group="body", smooth=True):
        obj.name = name
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.data.materials.clear()
        obj.data.materials.append(self.material)
        self.paint_uv(obj, color)
        for face in obj.data.polygons:
            face.use_smooth = smooth
        obj.parent = self.root
        self.parts.append(obj)
        self.groups.setdefault(group, []).append(obj)
        return obj

    def paint_uv(self, obj, color):
        mesh = obj.data
        uv = mesh.uv_layers.active or mesh.uv_layers.new(name="forest-atlas")
        uv.name = "forest-atlas"
        index = list(PALETTE).index(color)
        row, column = divmod(index, 4)
        coordinates = [vertex.co for vertex in mesh.vertices]
        low = [min(point[axis] for point in coordinates) for axis in range(3)]
        size = [
            max(point[axis] for point in coordinates) - low[axis] for axis in range(3)
        ]
        for face in mesh.polygons:
            axis = max(range(3), key=lambda axis: abs(face.normal[axis]))
            axes = [value for value in range(3) if value != axis]
            for loop in face.loop_indices:
                point = mesh.vertices[mesh.loops[loop].vertex_index].co
                values = [
                    (point[axis] - low[axis]) / max(size[axis], 0.0001) for axis in axes
                ]
                uv.data[loop].uv = (
                    (column + 0.04 + values[0] * 0.92) / 4,
                    (row + 0.04 + values[1] * 0.92) / 4,
                )

    def box(self, name, center, size, color, bevel=0.06, group="body", rotation=None):
        bpy.ops.mesh.primitive_cube_add(size=1, location=center)
        obj = bpy.context.object
        obj.scale = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if bevel:
            modifier = obj.modifiers.new("soft-edges", "BEVEL")
            modifier.width = min(bevel, min(size) * 0.4)
            modifier.segments = 2
        if rotation:
            obj.rotation_euler = rotation
        obj = self.finish(obj, name, color, group, smooth=False)
        return obj

    def blob(
        self, name, center, size, color, group="body", segments=12, rings=8, bend=0.0
    ):
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=segments, ring_count=rings, radius=1, location=center
        )
        obj = bpy.context.object
        for vertex in obj.data.vertices:
            point = vertex.co
            point.x += bend * point.z * point.z
            factor = 1 + 0.035 * math.sin(point.z * 5 + point.x * 3)
            point.x *= factor
            point.y *= factor
        obj.scale = size
        return self.finish(obj, name, color, group)

    def cylinder(
        self,
        name,
        start,
        end,
        radius,
        color,
        radius_end=None,
        vertices=12,
        group="body",
    ):
        start, end = Vector(start), Vector(end)
        direction = end - start
        bpy.ops.mesh.primitive_cone_add(
            vertices=vertices,
            radius1=radius,
            radius2=radius if radius_end is None else radius_end,
            depth=direction.length,
            location=(start + end) / 2,
        )
        obj = bpy.context.object
        obj.rotation_mode = "QUATERNION"
        obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
        obj = self.finish(obj, name, color, group)
        for face in obj.data.polygons:
            if len(face.vertices) > 4:
                face.use_smooth = False
        return obj

    def torus(
        self,
        name,
        center,
        radius,
        tube,
        color,
        rotation=None,
        group="body",
        segments=16,
    ):
        bpy.ops.mesh.primitive_torus_add(
            major_segments=segments,
            minor_segments=6,
            location=center,
            major_radius=radius,
            minor_radius=tube,
        )
        obj = bpy.context.object
        if rotation:
            obj.rotation_euler = rotation
        return self.finish(obj, name, color, group)

    def prism(self, name, outline, depth, color, group="body", bevel=0.025):
        vertices = [(x, y, z) for y in (-depth / 2, depth / 2) for x, z in outline]
        count = len(outline)
        faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
        faces.extend(
            (i, (i + 1) % count, (i + 1) % count + count, i + count)
            for i in range(count)
        )
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        topology = bmesh.new()
        topology.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(topology, faces=list(topology.faces))
        topology.to_mesh(mesh)
        topology.free()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        if bevel:
            modifier = obj.modifiers.new("soft-blade", "BEVEL")
            modifier.width = bevel
            modifier.segments = 2
        return self.finish(obj, name, color, group, smooth=False)

    def socket(self, name, position):
        obj = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(obj)
        obj.parent = self.root
        obj.location = position
        self.sockets[name] = obj
        return obj

    def center_base(self):
        bpy.context.view_layer.update()
        low, high = mesh_bounds(self.parts)
        offset = Vector((-(low[0] + high[0]) / 2, -(low[1] + high[1]) / 2, -low[2]))
        for obj in self.parts + list(self.sockets.values()):
            obj.location += offset
        bpy.context.view_layer.update()

    def join(self, parts, name):
        bpy.ops.object.select_all(action="DESELECT")
        for obj in parts:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        bpy.ops.object.join()
        obj = bpy.context.object
        obj.name = name
        bpy.context.scene.cursor.location = (0, 0, 0)
        bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        return obj

    def static_mesh(self):
        self.center_base()
        return self.join(self.parts, self.name + "-mesh")


def set_linear(action):
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for point in curve.keyframe_points:
                        point.interpolation = "LINEAR"


def add_clip(obj, name, frames, animate):
    action = bpy.data.actions.new(name)
    obj.animation_data_create()
    obj.animation_data.action = action
    for frame in frames:
        bpy.context.scene.frame_set(frame)
        animate(frame)
    set_linear(action)
    slot = obj.animation_data.action_slot
    obj.animation_data.action = None
    track = obj.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 1, action)
    strip.action_slot = slot
    track.mute = True
    return action
