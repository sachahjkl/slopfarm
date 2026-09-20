"""Contrôle les colonnes et les lignes de vue à partir du contrat du jeu."""

import math
import re

from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

from asset_common import ROOT, model_meshes


def runtime_layout():
    paths = {
        "camera": "src/app/camera-layout.ts",
        "view": "src/presentation/game-view.ts",
        "coins": "src/presentation/market-stock-layout.ts",
        "resources": "src/presentation/resource-view.ts",
        "stack": "src/game/stack-layout.ts",
    }
    texts = {name: (ROOT / path).read_text() for name, path in paths.items()}

    def numbers(source, pattern):
        match = re.search(pattern, texts[source], re.S)
        if not match:
            raise ValueError(f"Contrat du marché modifié : {paths[source]} ({pattern})")
        return [float(value) for value in match.groups()]

    number = r"([-\d.]+)"
    camera = numbers(
        "camera", rf"CAMERA_OFFSET = \{{ x: {number}, y: {number}, z: {number} \}}"
    )
    stock = numbers(
        "view",
        rf"position.set\(\s*{number} \+ offset.x, {number} \+ index \* {number}, {number} \+ offset.z\)",
    )
    wood_size = numbers(
        "resources",
        rf"function createCarriedWoodGeometry.*?RoundedBoxGeometry\({number}, {number}, {number},",
    )
    coins = numbers(
        "coins", rf"x: MARKET_TABLE.x,\s*y: {number},\s*z: MARKET_TABLE.z - {number},"
    )
    coin_step = numbers("coins", rf"VISUAL_STACK_STEP = {number};")[0]
    scales = numbers(
        "resources", rf'usesAsset\s*\? kind === "coin"\s*\? {number}\s*: {number}'
    )[0]
    wood_count = int(numbers("view", rf"const count = Math.min\({number}, amount\)")[0])
    coin_count = int(
        numbers("resources", rf"resources: ResourceMeshes, maximum = {number}\)")[0]
    )
    offsets = numbers(
        "stack",
        rf"x: Math.sin\(index \* {number}\) \* {number},\s*z: Math.sin\(index \* {number} \+ {number}\) \* {number},\s*rotation: Math.sin\(index \* {number} \+ {number}\) \* {number},",
    )
    if "this.#saleBuilding.rotation.y = Math.PI / 2;" not in texts["view"]:
        raise ValueError(
            "La rotation du marché a changé. Actualisez la preuve de visibilité."
        )
    return {
        "sources": list(paths.values()),
        "cameraOffset": camera,
        "yawRadians": math.pi / 2,
        "wood": {
            "center": [stock[0], stock[1], stock[3]],
            "step": stock[2],
            "size": wood_size,
            "maximum": wood_count,
        },
        "coins": {
            "center": [0, coins[0], -coins[1]],
            "step": coin_step,
            "scale": scales,
            "maximum": coin_count,
        },
        "offsets": offsets,
    }


def item_offset(layout, index):
    xf, xa, zf, zp, za, rf, rp, ra = layout["offsets"]
    return (
        math.sin(index * xf) * xa,
        math.sin(index * zf + zp) * za,
        math.sin(index * rf + rp) * ra,
    )


def blender_point(point):
    return Vector((point[0], -point[2], point[1]))


def clip(poly, axis, bound, above):
    result = []
    for a, b in zip(poly, poly[1:] + poly[:1]):
        inside_a = a[axis] >= bound if above else a[axis] <= bound
        inside_b = b[axis] >= bound if above else b[axis] <= bound
        if inside_a:
            result.append(a)
        if inside_a != inside_b:
            result.append(a.lerp(b, (bound - a[axis]) / (b[axis] - a[axis])))
    return result


def column_intersects(triangle, center, half_x, half_y, floor, ceiling=None):
    polygon = list(triangle)
    planes = [
        (0, center.x - half_x, True),
        (0, center.x + half_x, False),
        (1, center.y - half_y, True),
        (1, center.y + half_y, False),
        (2, floor + 0.0003, True),
    ]
    if ceiling is not None:
        planes.append((2, ceiling, False))
    for axis, bound, above in planes:
        polygon = clip(polygon, axis, bound, above)
        if not polygon:
            return False
    return len(polygon) >= 3 and any(
        (polygon[i] - polygon[0]).cross(polygon[i + 1] - polygon[0]).length > 1e-9
        for i in range(1, len(polygon) - 1)
    )


def validate_market(entry):
    layout = runtime_layout()
    rotation = Matrix.Rotation(layout["yawRadians"], 4, "Z")
    vertices, faces = [], []
    for mesh in model_meshes():
        mesh.data.calc_loop_triangles()
        offset = len(vertices)
        vertices.extend(
            rotation @ mesh.matrix_world @ vertex.co for vertex in mesh.data.vertices
        )
        faces.extend(
            tuple(offset + i for i in face.vertices)
            for face in mesh.data.loop_triangles
        )
    triangles = [tuple(vertices[i] for i in face) for face in faces]
    tree = BVHTree.FromPolygons(vertices, faces, all_triangles=True)
    direction = blender_point(layout["cameraOffset"]).normalized()
    wood = layout["wood"]
    coins = layout["coins"]
    wood_base = blender_point(wood["center"])
    wood_floor = wood_base.z - wood["size"][1] / 2
    coin_base = blender_point(coins["center"])
    for socket, expected in (
        ("stock", Vector((wood_base.x, wood_base.y, wood_floor))),
        ("coins", coin_base),
    ):
        actual = rotation @ blender_point(entry["sockets"][socket])
        if (actual - expected).length > 0.0002:
            raise ValueError(f"Point {socket} incompatible avec le stock du jeu")
    columns = [
        ("stock", wood_base, 0.21, 0.21, wood_floor, None),
        ("coins", coin_base, 0.28, 0.28, coin_base.z, None),
    ]
    for name in ("worker", "customer", "customer-2"):
        if name in entry["sockets"]:
            columns.append(
                (
                    name,
                    rotation @ blender_point(entry["sockets"][name]),
                    0.35,
                    0.35,
                    0,
                    2.1,
                )
            )
    for name, center, width, depth, floor, ceiling in columns:
        if any(
            column_intersects(face, center, width, depth, floor, ceiling)
            for face in triangles
        ):
            raise ValueError(f"Volume réservé obstrué : {name}")
    rays = 0
    for kind, data, radius, base_offset in (
        ("wood", wood, 0.16, -wood["size"][1] / 2 + 0.004),
        ("coins", coins, 0.14 * coins["scale"], 0.004),
    ):
        for index in range(data["maximum"]):
            dx, dz, _ = item_offset(layout, index)
            base = blender_point(data["center"]) + Vector(
                (dx, -dz, index * data["step"] + base_offset)
            )
            for x, y in ((0, 0), (-radius, 0), (radius, 0), (0, -radius), (0, radius)):
                start = base + Vector((x, y, 0))
                if tree.ray_cast(start, direction)[0] is not None:
                    raise ValueError(
                        f"Pile masquée depuis la caméra du jeu : {kind}, unité {index}"
                    )
                rays += 1
    worker = rotation @ blender_point(entry["sockets"]["worker"])
    for height in (1.15, 1.55, 1.85):
        if tree.ray_cast(worker + Vector((0, 0, height)), direction)[0] is not None:
            raise ValueError("Le comptoir masque le vendeur.")
    return {
        "cameraOffset": layout["cameraOffset"],
        "yawDegrees": 90,
        "woodItems": wood["maximum"],
        "coinItems": coins["maximum"],
        "unobstructedRays": rays + 3,
        "clearColumns": [column[0] for column in columns],
    }
