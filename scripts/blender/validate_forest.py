"""Valide les GLB exportés puis leur réimportation dans Blender."""

import argparse
import hashlib
import json
import math
import re
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from asset_common import (  # noqa: E402
    OUTPUT,
    gltf_bounds,
    import_model,
    read_glb,
    sha256,
    triangles,
    write_json,
)


LIMITS = {
    "character": 8000,
    "tree": 1500,
    "stackable": 200,
    "building": 12000,
    "tool": 1500,
    "prop": 2500,
}
CAMP_SOCKETS = {
    "camp-gate": {"passage", "banner", "fence-left", "fence-right"},
    "camp-lamp": {"light"},
    "camp-arch": {"passage", "banner"},
    "camp-log-pile": {"cargo"},
    "camp-plank-pile": {"cargo"},
    "camp-cart": {"cargo", "handle"},
    "camp-crate": {"stack"},
    "camp-barrel": {"stack"},
    "camp-banner": {"mount-left", "mount-right"},
    "camp-planter": {"plant"},
    "camp-signpost": {"label"},
    "camp-awning": {"station", "sign"},
}
INDUSTRY_SOCKETS = {
    "industry-conveyor-straight": {"input": [0, 0.8, -1], "output": [0, 0.8, 1]},
    "industry-conveyor-corner": {"input": [0, 0.8, -1], "output": [1, 0.8, 0]},
    "industry-diverter": {
        "input": [0, 0.8, -1],
        "output": [0, 0.8, 1],
        "output-right": [1, 0.8, 0],
        "switch": [-0.20, 0.98, -0.18],
    },
    "industry-lift": {
        "input": [0, 0.8, -1],
        "output": [0, 2.6, 1],
        "platform": [0, 1.6, 0],
    },
    "industry-bridge": {
        "input": [0, 2.6, -2],
        "output": [0, 2.6, 2],
        "passage": [0, 0, 0],
    },
    "industry-roller-buffer": {
        "input": [0, 0.8, -1],
        "output": [0, 0.8, 1],
        "storage": [0, 0.8, 0],
    },
    "industry-storage-rack": {
        "storage-1": [0, 0.25, 0],
        "storage-2": [0, 1.10, 0],
        "storage-3": [0, 1.95, 0],
    },
    "industry-gantry-crane": {"hook": [0.55, 1.28, 0], "load": [0.55, 0, 0]},
    "industry-sorter": {
        "input": [0, 0.8, -1],
        "output": [0, 0.8, 1],
        "scanner": [0, 1.5, 0],
    },
    "industry-loading-dock": {
        "input": [0, 0.8, -1],
        "cargo": [0, 0.8, 0],
        "approach": [0, 0, 2.2],
    },
    "industry-delivery-hatch": {
        "input": [0, 0.8, -0.6],
        "output": [0, 0.8, 0.6],
        "mount": [0, 0, 0],
    },
    "industry-market-stall": {
        "input": [0, 0.8, -1.54],
        "delivery": [0, 0.8, -0.34],
        "sale": [-0.51, 1.14, 0.65],
        "worker": [0, 0, 0],
        "customer": [0, 0, 1.65],
    },
}
REQUIRED = {
    *CAMP_SOCKETS,
    *INDUSTRY_SOCKETS,
    "adventurer",
    "adventurer-coral",
    "adventurer-leaf",
    "worker",
    "worker-coral",
    "worker-leaf",
    "axe-simple",
    "axe-reinforced-double",
    "tree-stump",
    "tree-regrowth",
    "log",
    "plank",
    "coin",
    "sale-bench",
    "upgrade-zone",
    "conveyor-straight",
    "conveyor-corner",
    "conveyor-end",
    *(f"tree-{index:02}" for index in range(1, 6)),
    *(f"sawmill-tier-{index}" for index in range(1, 5)),
    *(f"monument-stage-{index}" for index in range(1, 4)),
}
COMPONENTS = {
    5120: ("b", 1),
    5121: ("B", 1),
    5122: ("h", 2),
    5123: ("H", 2),
    5125: ("I", 4),
    5126: ("f", 4),
}
WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def close(actual, expected, label, tolerance=0.0002):
    require(len(actual) == len(expected), f"{label} : taille incorrecte")
    require(
        all(
            math.isfinite(value) and abs(value - target) < tolerance
            for value, target in zip(actual, expected)
        ),
        f"{label} : {actual} != {expected}",
    )


def accessor_values(document, binary, index):
    accessor = document["accessors"][index]
    require(
        "sparse" not in accessor, "Les accessors sparse ne font pas partie du pipeline."
    )
    view = document["bufferViews"][accessor["bufferView"]]
    code, size = COMPONENTS[accessor["componentType"]]
    width = WIDTHS[accessor["type"]]
    stride = view.get("byteStride", size * width)
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    end = start + (accessor["count"] - 1) * stride + size * width
    require(
        accessor["count"] > 0 and end <= view.get("byteOffset", 0) + view["byteLength"],
        "Accessor hors du bufferView",
    )
    require(end <= len(binary), "Accessor hors du GLB")
    values = [
        struct.unpack_from("<" + code * width, binary, start + i * stride)
        for i in range(accessor["count"])
    ]
    require(
        all(math.isfinite(value) for row in values for value in row),
        "Accessor non fini",
    )
    return values


def node_world_matrices(document):
    matrices = {}

    def visit(index, parent, ancestors):
        require(index not in ancestors, "Cycle dans la hiérarchie glTF")
        require(index not in matrices, "Un nœud glTF possède plusieurs parents.")
        node = document["nodes"][index]
        if "matrix" in node:
            values = node["matrix"]
            local = Matrix(
                [values[offset : offset + 4] for offset in range(0, 16, 4)]
            ).transposed()
        else:
            x, y, z, w = node.get("rotation", [0, 0, 0, 1])
            local = Matrix.LocRotScale(
                Vector(node.get("translation", [0, 0, 0])),
                Quaternion((w, x, y, z)),
                Vector(node.get("scale", [1, 1, 1])),
            )
        matrices[index] = parent @ local
        for child in node.get("children", []):
            visit(child, matrices[index], ancestors | {index})

    for index in document["scenes"][document.get("scene", 0)]["nodes"]:
        visit(index, Matrix.Identity(4), set())
    return matrices


def validate_glb(path, entry, atlas_hash):
    document, binary = read_glb(path)
    require(document["asset"]["version"] == "2.0", "Version glTF incorrecte")
    require(
        not document.get("extensionsRequired"),
        "Une extension impose un décodeur externe.",
    )
    require(not document.get("cameras"), "Une caméra est exportée.")
    require(
        len(document["buffers"]) == 1 and "uri" not in document["buffers"][0],
        "Le buffer doit être intégré.",
    )
    require(
        len(binary) - document["buffers"][0]["byteLength"] in range(4),
        "Taille de buffer incorrecte",
    )
    for view in document["bufferViews"]:
        require(view.get("buffer", 0) == 0, "Buffer externe")
        require(
            view.get("byteOffset", 0) + view["byteLength"] <= len(binary),
            "BufferView hors limites",
        )
    for index in range(len(document["accessors"])):
        accessor_values(document, binary, index)
    require(
        len(document.get("materials", [])) == 1,
        "Le modèle doit utiliser un matériau partagé.",
    )
    material = document["materials"][0]
    require(material["name"] == "forest-painted-matte", "Nom de matériau incorrect")
    require(material.get("alphaMode", "OPAQUE") == "OPAQUE", "Matériau transparent")
    require(not material.get("doubleSided", False), "Matériau double face")
    pbr = material["pbrMetallicRoughness"]
    require(
        pbr.get("roughnessFactor", 1) >= 0.8 and pbr.get("metallicFactor", 1) == 0,
        "Matériau non mat",
    )
    require("baseColorTexture" in pbr, "Atlas manquant")
    require(len(document["images"]) == 1, "Le modèle doit intégrer un seul atlas.")
    image = document["images"][0]
    require(
        "uri" not in image and image["mimeType"] == "image/png", "Image non intégrée"
    )
    view = document["bufferViews"][image["bufferView"]]
    start = view.get("byteOffset", 0)
    png = binary[start : start + view["byteLength"]]
    require(png[:8] == b"\x89PNG\r\n\x1a\n", "PNG invalide")
    close(
        struct.unpack_from(">II", png, 16),
        entry["textureSize"],
        "Dimensions de texture",
    )
    require(
        hashlib.sha256(png).hexdigest() == atlas_hash,
        "L’atlas intégré diffère de l’atlas partagé.",
    )

    count = 0
    mesh_positions = {}
    for index, mesh in enumerate(document["meshes"]):
        positions = []
        for primitive in mesh["primitives"]:
            require(primitive.get("mode", 4) == 4, "Primitive non triangulée")
            require(not primitive.get("targets"), "Morph targets présents")
            attributes = primitive["attributes"]
            require(
                {"POSITION", "NORMAL", "TEXCOORD_0"} <= attributes.keys(),
                "Attribut de maillage manquant",
            )
            vertices = accessor_values(document, binary, attributes["POSITION"])
            normals = accessor_values(document, binary, attributes["NORMAL"])
            require(
                all(abs(Vector(normal).length - 1) < 0.002 for normal in normals),
                "Normale non unitaire",
            )
            uv = accessor_values(document, binary, attributes["TEXCOORD_0"])
            require(
                all(0 <= value <= 1 for pair in uv for value in pair), "UV hors atlas"
            )
            indices = [
                value[0]
                for value in accessor_values(document, binary, primitive["indices"])
            ]
            require(
                len(indices) % 3 == 0 and max(indices) < len(vertices),
                "Indices incorrects",
            )
            for first in range(0, len(indices), 3):
                a, b, c = (
                    Vector(vertices[indices[first + offset]]) for offset in range(3)
                )
                require((b - a).cross(c - a).length > 1e-10, "Triangle dégénéré")
            if entry["kind"] == "character":
                require(
                    {"JOINTS_0", "WEIGHTS_0"} <= attributes.keys(),
                    "Poids du squelette manquants",
                )
                weights = accessor_values(document, binary, attributes["WEIGHTS_0"])
                require(
                    all(abs(sum(row) - 1) < 0.0001 for row in weights),
                    "Poids du squelette incorrects",
                )
            count += len(indices) // 3
            positions.extend(vertices)
        mesh_positions[index] = positions
    require(count == entry["triangles"], f"Triangles : {count} != {entry['triangles']}")
    require(
        count <= LIMITS[entry["kind"]] == entry["triangleBudget"],
        "Budget de triangles dépassé ou modifié",
    )
    require(
        all(
            actual <= limit
            for actual, limit in zip(entry["textureSize"], entry["textureBudget"])
        ),
        "Budget de texture dépassé",
    )
    matrices = node_world_matrices(document)
    nodes = document["nodes"]
    named = {node["name"]: index for index, node in enumerate(nodes) if "name" in node}
    require(entry["id"] in named, "Origine nommée absente")
    root = nodes[named[entry["id"]]]
    require(
        root.get("extras", {}).get("forward") == "+Z",
        "Convention d’orientation absente",
    )
    close(list(matrices[named[entry["id"]]].translation), [0, 0, 0], "Origine")
    vertices = [
        matrices[index] @ Vector(point)
        for index, node in enumerate(nodes)
        if "mesh" in node
        for point in mesh_positions[node["mesh"]]
    ]
    low = [min(point[axis] for point in vertices) for axis in range(3)]
    high = [max(point[axis] for point in vertices) for axis in range(3)]
    close(low, entry["boundsMeters"]["min"], "Borne basse GLB")
    close(high, entry["boundsMeters"]["max"], "Borne haute GLB")
    close(
        [high[axis] - low[axis] for axis in range(3)],
        entry["dimensionsMeters"],
        "Dimensions GLB",
    )
    require(abs(low[1]) < 0.0002, "Le modèle ne repose pas sur Y = 0.")
    if entry["origin"] == "base-center":
        close([low[0] + high[0], low[2] + high[2]], [0, 0], "Centre de base")
    for name, position in entry["sockets"].items():
        require(name in named, f"Point d’attache absent : {name}")
        close(
            list(matrices[named[name]].translation), position, f"Point d’attache {name}"
        )

    animations = document.get("animations", [])
    if entry["id"] in CAMP_SOCKETS:
        require(
            entry["kind"] == "prop" and entry.get("family") == "camp",
            "Famille d’accessoire incorrecte",
        )
        require(
            set(entry["sockets"]) == CAMP_SOCKETS[entry["id"]],
            "Points d’attache du camp incomplets",
        )
    if entry["id"] in INDUSTRY_SOCKETS:
        require(
            entry["family"] == "industry"
            and entry["kind"] == "prop"
            and entry["origin"] == "module-anchor",
            "Convention de module industriel incorrecte",
        )
        expected = INDUSTRY_SOCKETS[entry["id"]]
        require(
            set(entry["sockets"]) == set(expected),
            "Points d’attache industriels incomplets",
        )
        for name, position in expected.items():
            close(entry["sockets"][name], position, f"Raccord industriel {name}")
        ports = {
            name for name in expected if name in {"input", "output", "output-right"}
        }
        require(
            set(entry["ports"]) == ports, "Catalogue des raccords industriels incorrect"
        )
        for name in ports:
            direction = [0, 0, -1] if name == "input" else [0, 0, 1]
            if name == "output-right" or (
                name == "output" and entry["module"] == "conveyor-corner"
            ):
                direction = [1, 0, 0]
            close(entry["ports"][name]["direction"], direction, f"Direction {name}")
            require(
                entry["ports"][name]["widthMeters"] == 1,
                "Largeur de raccord incorrecte",
            )
    if entry["id"] in CAMP_SOCKETS or entry["id"] in INDUSTRY_SOCKETS:
        require(
            len(document["meshes"]) == 1
            and len(document["meshes"][0]["primitives"]) == 1
            and not animations
            and not document.get("skins"),
            "Un accessoire doit contenir un seul maillage statique.",
        )
    names = [animation["name"] for animation in animations]
    require(
        names == entry["animations"] and len(names) == len(set(names)),
        "Catalogue des animations incorrect",
    )
    if entry["kind"] == "character":
        require(
            set(names) == {"idle", "walk", "attack", "hit", "death"},
            "Animation de personnage absente",
        )
        require(
            len(document.get("skins", [])) == 1,
            "Le personnage doit utiliser un seul squelette.",
        )
        joints = document["skins"][0]["joints"]
        require(
            {nodes[index]["name"] for index in joints}
            == {
                "root",
                "body",
                "head",
                "left-arm",
                "right-arm",
                "left-leg",
                "right-leg",
            },
            "Squelette de famille incorrect",
        )
    for animation in animations:
        changed = False
        duration = 0
        for channel in animation["channels"]:
            sampler = animation["samplers"][channel["sampler"]]
            times = [
                row[0] for row in accessor_values(document, binary, sampler["input"])
            ]
            values = accessor_values(document, binary, sampler["output"])
            require(
                times[0] == 0 and all(a < b for a, b in zip(times, times[1:])),
                "Temps d’animation incorrects",
            )
            require(len(times) == len(values), "Échantillons d’animation incorrects")
            duration = max(duration, times[-1])
            changed |= any(
                any(abs(a - b) > 0.001 for a, b in zip(values[0], row))
                for row in values[1:]
            )
            if animation["name"] in ("idle", "walk"):
                first, last = values[0], values[-1]
                if channel["target"]["path"] == "rotation":
                    require(
                        abs(abs(sum(a * b for a, b in zip(first, last))) - 1) < 0.001,
                        "Boucle de rotation ouverte",
                    )
                else:
                    close(first, last, "Boucle d’animation")
        require(changed and duration > 0, "Animation vide ou statique")
    return {
        "triangles": count,
        "meshCount": len(document["meshes"]),
        "animationCount": len(animations),
    }


def validate_import(path, entry):
    import_model(path)
    bounds = gltf_bounds(evaluated=True)
    close(bounds["min"], entry["boundsMeters"]["min"], "Réimportation : borne basse")
    close(bounds["max"], entry["boundsMeters"]["max"], "Réimportation : borne haute")
    require(
        triangles() == entry["triangles"],
        "Réimportation : nombre de triangles incorrect",
    )
    for obj in bpy.context.scene.objects:
        require(
            obj.type in {"MESH", "EMPTY", "ARMATURE"}, "Réimportation : objet inattendu"
        )
        if obj.type == "MESH":
            require(len(obj.data.uv_layers) == 1, "Réimportation : atlas UV absent")
            require(not obj.data.shape_keys, "Réimportation : morph targets présents")
            for vertex in obj.data.vertices:
                require(
                    all(math.isfinite(value) for value in vertex.co),
                    "Réimportation : sommet non fini",
                )


def validate_industry_assembly(entries):
    assets = {entry["id"]: entry for entry in entries}
    connections = (
        (
            ("conveyor-straight", "output", (0, 0, 0), 0),
            ("roller-buffer", "input", (0, 0, 2), 0),
        ),
        (("roller-buffer", "output", (0, 0, 2), 0), ("sorter", "input", (0, 0, 4), 0)),
        (
            ("sorter", "output", (0, 0, 4), 0),
            ("market-stall", "input", (0, 0, 6.54), 0),
        ),
        (
            ("conveyor-corner", "output", (0, 0, 0), 0),
            ("conveyor-straight", "input", (2, 0, 0), math.pi / 2),
        ),
        (("lift", "output", (0, 0, 0), 0), ("bridge", "input", (0, 0, 3), 0)),
    )
    for source, target in connections:
        points, directions = [], []
        for module, port, translation, yaw in (source, target):
            entry = assets[f"industry-{module}"]
            rotation = Matrix.Rotation(yaw, 3, "Y")
            points.append(
                Vector(translation) + rotation @ Vector(entry["sockets"][port])
            )
            directions.append(rotation @ Vector(entry["ports"][port]["direction"]))
        close(points[0], points[1], f"Assemblage {source[0]} → {target[0]}")
        close(directions[0], -directions[1], "Raccords opposés")


def validate(directory, compare=None):
    manifest = json.loads((directory / "manifest.json").read_text())
    require(manifest["schemaVersion"] == 1, "Version du manifeste incorrecte")
    require(
        manifest["units"] == "meters"
        and manifest["up"] == "+Y"
        and manifest["forward"] == "+Z"
        and manifest["ground"] == 0,
        "Conventions incorrectes",
    )
    require(
        manifest["blenderVersion"] == bpy.app.version_string,
        "Version Blender différente du générateur",
    )
    entries = manifest["assets"]
    identifiers = [entry["id"] for entry in entries]
    require(
        set(identifiers) == REQUIRED and len(identifiers) == len(REQUIRED),
        "Catalogue incomplet ou dupliqué",
    )
    expected_files = {entry["file"] for entry in entries}
    require(
        {path.name for path in directory.glob("*.glb")} == expected_files,
        "GLB absent ou non déclaré",
    )
    atlas_hash = sha256(directory / manifest["atlas"]["file"])
    require(
        atlas_hash == manifest["atlas"]["sha256"], "Empreinte de l’atlas incorrecte"
    )
    results, failures = [], []
    for entry in entries:
        name = entry["id"]
        try:
            require(
                re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name)
                and entry["file"] == name + ".glb",
                "Nom hors convention kebab-case",
            )
            path = directory / entry["file"]
            require(
                path.stat().st_size == entry["bytes"]
                and sha256(path) == entry["sha256"],
                "Empreinte ou taille incorrecte",
            )
            result = validate_glb(path, entry, atlas_hash)
            validate_import(path, entry)
            results.append({"id": name, "status": "passed", **result})
            print(f"PASS {name}")
        except Exception as error:
            failures.append({"id": name, "error": str(error)})
            print(f"FAIL {name}: {error}")
    for family, field in (("sawmill", "tier"), ("monument", "stage")):
        progression = sorted(
            (entry for entry in entries if entry.get("family") == family),
            key=lambda entry: entry[field],
        )
        require(
            all(
                a["triangles"] < b["triangles"]
                and a["dimensionsMeters"][1] < b["dimensionsMeters"][1] + 0.001
                for a, b in zip(progression, progression[1:])
            ),
            f"Progression visuelle incorrecte : {family}",
        )
    comparison = None
    validate_industry_assembly(entries)
    if compare:
        compared_files = sorted(
            expected_files | {"manifest.json", manifest["atlas"]["file"]}
        )
        different = [
            name
            for name in compared_files
            if not (compare / name).is_file()
            or sha256(directory / name) != sha256(compare / name)
        ]
        comparison = {
            "files": len(compared_files),
            "identical": not different,
            "different": different,
        }
        require(not different, f"Génération non reproductible : {different}")
    report = {
        "schemaVersion": 1,
        "blenderVersion": bpy.app.version_string,
        "status": "failed" if failures else "passed",
        "assetCount": len(entries),
        "totalTriangles": sum(entry["triangles"] for entry in entries),
        "totalBytes": sum(entry["bytes"] for entry in entries),
        "checks": [
            "glb-structure",
            "embedded-atlas",
            "matte-material",
            "triangle-budgets",
            "texture-budgets",
            "finite-geometry",
            "triangle-area",
            "normals",
            "uv",
            "meters-y-up",
            "ground-origin",
            "dimensions",
            "sockets",
            "family-skeleton",
            "animation-content",
            "animation-loops",
            "blender-reimport",
            "visual-progression",
            "camp-static-mesh",
            "camp-sockets",
            "industry-static-mesh",
            "industry-fixed-anchors",
            "industry-ports",
            "industry-assembly",
        ],
        "reproducibility": comparison,
        "assets": results,
        "failures": failures,
    }
    write_json(directory / "validation-report.json", report)
    require(not failures, f"{len(failures)} modèle(s) invalide(s)")
    print(
        f"Validation terminée : {len(results)} GLB, {report['totalTriangles']} triangles, {report['totalBytes']} octets"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=OUTPUT)
    parser.add_argument("--compare", type=Path)
    args = parser.parse_args(
        sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    )
    validate(args.input.resolve(), args.compare.resolve() if args.compare else None)
