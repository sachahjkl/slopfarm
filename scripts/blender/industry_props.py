"""Modules industriels lumineux, avec raccords fixes en mètres."""

import math

from mathutils import Vector


def beam(m, name, start, end, width, depth, color, bevel=0):
    start, end = Vector(start), Vector(end)
    obj = m.box(
        name, (start + end) / 2, (width, depth, (end - start).length), color, bevel
    )
    obj.rotation_euler = (end - start).to_track_quat("Z", "Y").to_euler()
    return obj


def foot(m, x, y, height):
    m.box("support", (x, y, height / 2), (0.16, 0.20, height), "wood", 0.025)
    m.box("support-shoe", (x, y, 0.045), (0.28, 0.32, 0.09), "teal", 0)


def bolt(m, x, y, z):
    m.cylinder("gold-fastener", (x, y, z), (x + 0.04, y, z), 0.055, "gold", vertices=6)


def arrow(m, x, y, height, angle=0, color="cream"):
    obj = m.prism(
        "flow-arrow",
        [
            (-0.055, -0.22),
            (0.055, -0.22),
            (0.055, 0.06),
            (0.16, 0.06),
            (0, 0.24),
            (-0.16, 0.06),
            (-0.055, 0.06),
        ],
        0.015,
        color,
        bevel=0,
    )
    obj.rotation_euler = (math.pi / 2, 0, angle)
    obj.location = (x, y, height)


def signal(m, x, y, height=1.3):
    m.box("signal-housing", (x, y, height), (0.23, 0.23, 0.73), "teal", 0.025)
    for index, color in enumerate(("coral", "gold", "leaf-light")):
        m.cylinder(
            "status-lens",
            (x, y - 0.12, height - 0.22 + index * 0.22),
            (x, y - 0.16, height - 0.22 + index * 0.22),
            0.075,
            color,
            vertices=8,
        )
    m.box("signal-cap", (x, y, height + 0.40), (0.28, 0.28, 0.08), "cream", 0)


def track(m, length=2, height=0.8, center=(0, 0), rollers=False, supports=True):
    x, y = center
    m.box("belt-bed", (x, y, height - 0.14), (1.02, length, 0.16), "iron", 0)
    for side in (-1, 1):
        m.box(
            "teal-rail",
            (x + side * 0.59, y, height - 0.045),
            (0.16, length, 0.23),
            "teal",
            0.025,
        )
        for end in (-1, 1):
            py = y + end * (length / 2 - 0.17)
            m.box(
                "rail-end-cap",
                (x + side * 0.59, py, height + 0.08),
                (0.18, 0.22, 0.08),
                "gold",
                0,
            )
            bolt(m, x + side * 0.68, py, height - 0.02)
            if supports:
                foot(m, x + side * 0.53, py, height - 0.18)
    for index in range(round(length / 0.25)):
        py = y - length / 2 + 0.125 + index * 0.25
        if rollers:
            m.cylinder(
                "buffer-roller",
                (x - 0.49, py, height - 0.08),
                (x + 0.49, py, height - 0.08),
                0.08,
                "steel" if index % 2 else "cut",
                vertices=8,
            )
        else:
            m.box(
                "belt-slat",
                (x, py, height - 0.035),
                (0.99, 0.235, 0.07),
                "iron" if index % 2 else "steel",
                0,
            )


def finish(m):
    # Le repère fixe conserve les raccords malgré les volumes asymétriques.
    m.join(m.parts, m.name + "-mesh")


def build_straight(m):
    track(m)
    arrow(m, 0, 0, 0.807)
    m.socket("input", (0, 1, 0.8))
    m.socket("output", (0, -1, 0.8))
    finish(m)


def curve_strip(m, name, inner, outer, z, depth, color):
    angles = [math.pi + index * math.pi / 16 for index in range(9)]
    outline = [
        (1 + radius * math.cos(angle), -1 - radius * math.sin(angle))
        for radius, values in ((outer, angles), (inner, reversed(angles)))
        for angle in values
    ]
    obj = m.prism(name, outline, depth, color, bevel=0)
    obj.rotation_euler.x = math.pi / 2
    obj.location.z = z


def build_corner(m):
    curve_strip(m, "curved-belt-bed", 0.49, 1.51, 0.66, 0.16, "iron")
    for inner, outer in ((0.33, 0.49), (1.51, 1.67)):
        curve_strip(m, "curved-teal-rail", inner, outer, 0.755, 0.23, "teal")
    for index in range(9):
        angle = math.pi + index * math.pi / 16
        ends = [
            (1 + radius * math.cos(angle), 1 + radius * math.sin(angle), 0.72)
            for radius in (0.50, 1.50)
        ]
        m.cylinder(
            "turn-roller", *ends, 0.08, "steel" if index % 2 else "cut", vertices=8
        )
    for x, y in ((-0.53, 0.82), (0.82, -0.53), (-0.08, -0.08)):
        foot(m, x, y, 0.58)
    for x, y in ((-0.59, 0.88), (0.59, 0.88), (0.88, -0.59), (0.88, 0.59)):
        m.box("curve-end-cap", (x, y, 0.88), (0.18, 0.18, 0.08), "gold", 0)
    arrow(m, 0.30, 0.30, 0.82, math.pi / 4)
    m.socket("input", (0, 1, 0.8))
    m.socket("output", (1, 0, 0.8))
    finish(m)


def build_diverter(m):
    m.box("junction-table", (0, 0, 0.65), (2, 2, 0.22), "teal", 0.035)
    m.box("junction-surface", (0, 0, 0.78), (1.89, 1.89, 0.04), "steel", 0)
    for x in (-0.79, 0.79):
        for y in (-0.79, 0.79):
            foot(m, x, y, 0.55)
            m.box("junction-corner", (x, y, 0.87), (0.28, 0.28, 0.14), "gold", 0.025)
    m.box("closed-side", (-0.94, 0, 0.85), (0.12, 1.6, 0.20), "teal", 0)
    m.cylinder(
        "routing-pivot",
        (-0.20, 0.18, 0.80),
        (-0.20, 0.18, 0.98),
        0.15,
        "gold",
        vertices=10,
    )
    beam(
        m,
        "routing-paddle",
        (-0.20, 0.18, 0.91),
        (0.43, -0.45, 0.91),
        0.12,
        0.12,
        "coral",
        0.02,
    )
    arrow(m, 0, -0.70, 0.81)
    arrow(m, 0.69, 0, 0.81, math.pi / 2, "gold")
    signal(m, -0.79, 0.70)
    m.socket("input", (0, 1, 0.8))
    m.socket("output", (0, -1, 0.8))
    m.socket("output-right", (1, 0, 0.8))
    m.socket("switch", (-0.20, 0.18, 0.98))
    finish(m)


def build_lift(m):
    for x in (-0.66, 0.66):
        for y in (-0.38, 0.38):
            m.box("lift-column", (x, y, 2.05), (0.20, 0.22, 4.10), "teal", 0.035)
            m.box("column-shoe", (x, y, 0.08), (0.36, 0.40, 0.16), "gold", 0)
        m.cylinder(
            "carriage-guide",
            (x * 0.80, 0, 0.20),
            (x * 0.80, 0, 4.02),
            0.045,
            "steel",
            vertices=8,
        )
    for z in (0.20, 4.00):
        m.box("lift-crossbeam", (0, 0, z), (1.62, 0.42, 0.22), "gold", 0.025)
    for y, height in ((0.65, 0.8), (-0.65, 2.6), (0, 1.6)):
        m.box("lift-platform", (0, y, height - 0.07), (1.02, 0.70, 0.14), "teal", 0.025)
        for index in range(3):
            py = y + (index - 1) * 0.21
            m.cylinder(
                "platform-roller",
                (-0.49, py, height - 0.07),
                (0.49, py, height - 0.07),
                0.07,
                "cut",
                vertices=8,
            )
    m.cylinder(
        "hoist-drum", (-0.30, 0, 3.90), (0.30, 0, 3.90), 0.17, "iron", vertices=10
    )
    m.cylinder("lift-cable", (0, 0, 1.65), (0, 0, 3.90), 0.025, "gold", vertices=6)
    signal(m, 0.87, 0, 1.95)
    m.socket("input", (0, 1, 0.8))
    m.socket("output", (0, -1, 2.6))
    m.socket("platform", (0, 0, 1.6))
    finish(m)


def build_bridge(m):
    track(m, length=4, height=2.6, supports=False)
    for x in (-0.64, 0.64):
        for y in (-1.48, 1.48):
            foot(m, x, y, 2.38)
            beam(
                m, "bridge-brace", (x, y, 1.76), (x, y * 0.66, 2.38), 0.09, 0.09, "gold"
            )
        m.box("bridge-guard", (x, 0, 2.84), (0.09, 4, 0.10), "gold", 0)
        for y in (-1.75, 0, 1.75):
            m.box("guard-post", (x, y, 2.70), (0.065, 0.065, 0.28), "teal", 0)
    arrow(m, 0, 0, 2.607)
    m.socket("input", (0, 2, 2.6))
    m.socket("output", (0, -2, 2.6))
    m.socket("passage", (0, 0, 0))
    finish(m)


def build_buffer(m):
    track(m, rollers=True)
    for x in (-0.59, 0.59):
        m.box("buffer-stop-post", (x, -0.78, 1.03), (0.16, 0.18, 0.55), "gold", 0.025)
    m.box("raised-buffer-stop", (0, -0.78, 1.29), (1.30, 0.12, 0.13), "gold", 0.025)
    m.box("buffer-counter", (-0.75, 0, 1.05), (0.17, 0.80, 0.35), "teal", 0.025)
    for index in range(3):
        m.box(
            "capacity-mark",
            (-0.844, -0.25 + index * 0.25, 1.07),
            (0.025, 0.14, 0.15),
            "cream" if index == 2 else "gold",
            0,
        )
    m.socket("input", (0, 1, 0.8))
    m.socket("output", (0, -1, 0.8))
    m.socket("storage", (0, 0, 0.8))
    finish(m)


def build_rack(m):
    for x in (-0.97, 0.97):
        for y in (-0.51, 0.51):
            m.box("rack-column", (x, y, 1.35), (0.18, 0.18, 2.70), "teal", 0.025)
            m.box("rack-shoe", (x, y, 0.055), (0.32, 0.32, 0.11), "gold", 0)
        beam(
            m,
            "rack-side-brace",
            (x, -0.49, 0.26),
            (x, 0.49, 2.53),
            0.075,
            0.075,
            "gold",
        )
    for index, z in enumerate((0.25, 1.10, 1.95)):
        m.box("storage-shelf", (0, 0, z - 0.06), (2.02, 1.13, 0.12), "wood", 0)
        for y in (-0.56, 0.56):
            m.box("shelf-edge", (0, y, z - 0.045), (2.08, 0.09, 0.19), "gold", 0)
        m.socket(f"storage-{index + 1}", (0, 0, z))
    for index in range(3):
        m.box(
            "rack-stock",
            (0, (index - 1) * 0.29, 0.35),
            (1.57, 0.25, 0.20),
            "cut",
            0.025,
        )
    m.box("rack-label", (0, -0.63, 2.44), (0.63, 0.08, 0.30), "cream", 0.025)
    for x in (-0.16, 0, 0.16):
        m.box("inventory-mark", (x, -0.677, 2.44), (0.075, 0.015, 0.15), "teal", 0)
    finish(m)


def build_crane(m):
    for x in (-1.22, 1.22):
        m.box("crane-leg", (x, 0, 1.59), (0.24, 0.30, 3.18), "teal", 0.035)
        m.box("crane-foot", (x, 0, 0.12), (0.49, 1.18, 0.24), "gold", 0.035)
        beam(m, "gantry-brace", (x, 0, 2.50), (x * 0.53, 0, 3.05), 0.11, 0.14, "gold")
    m.box("crane-crossbeam", (0, 0, 3.16), (3.03, 0.43, 0.28), "gold", 0.045)
    m.box("hoist-trolley", (0.45, 0, 2.96), (0.54, 0.60, 0.25), "teal", 0.035)
    m.cylinder(
        "cable-drum", (0.45, -0.25, 2.78), (0.45, 0.25, 2.78), 0.18, "iron", vertices=10
    )
    for x in (0.41, 0.49):
        m.cylinder("crane-cable", (x, 0, 1.79), (x, 0, 2.80), 0.018, "iron", vertices=6)
    m.box("hook-block", (0.45, 0, 1.79), (0.30, 0.25, 0.30), "gold", 0.035)
    hook = m.prism(
        "open-hook",
        [
            (-0.04, 0.17),
            (0.06, 0.17),
            (0.06, -0.04),
            (0.13, -0.10),
            (0.22, -0.04),
            (0.24, 0.03),
            (0.30, 0),
            (0.25, -0.18),
            (0.08, -0.24),
            (-0.06, -0.14),
        ],
        0.10,
        "iron",
        bevel=0,
    )
    hook.location = (0.42, 0, 1.48)
    signal(m, -1.22, -0.26, 1.65)
    m.socket("hook", (0.55, 0, 1.28))
    m.socket("load", (0.55, 0, 0))
    finish(m)


def build_sorter(m):
    track(m)
    for x in (-0.72, 0.72):
        m.box("scanner-column", (x, 0, 1.20), (0.22, 0.38, 1.52), "gold", 0.035)
    m.box("scanner-head", (0, 0, 2.00), (1.76, 0.48, 0.28), "teal", 0.035)
    m.box("scanner-window", (0, -0.251, 2.00), (0.68, 0.035, 0.12), "cream", 0)
    m.box("sorter-control", (-0.90, -0.47, 0.88), (0.39, 0.37, 0.59), "gold", 0.035)
    signal(m, -0.90, -0.47, 1.51)
    arrow(m, 0, -0.64, 0.807)
    m.socket("input", (0, 1, 0.8))
    m.socket("output", (0, -1, 0.8))
    m.socket("scanner", (0, 0, 1.5))
    finish(m)


def build_dock(m):
    for x in (-1.20, 1.20):
        for y in (-0.72, 0.72):
            foot(m, x, y, 0.65)
    m.box("dock-frame", (0, 0, 0.66), (2.88, 2, 0.20), "teal", 0.035)
    for index in range(8):
        m.box(
            "dock-plank",
            ((index - 3.5) * 0.35, 0, 0.775),
            (0.33, 1.98, 0.05),
            "cut" if index % 2 else "wood",
            0,
        )
    for x in (-1.39, 1.39):
        m.box("dock-edge", (x, 0, 0.84), (0.10, 2, 0.14), "gold", 0)
    for x in (-0.80, 0.80):
        m.box("dock-bumper", (x, 0.96, 0.48), (0.20, 0.19, 0.38), "iron", 0.025)
    ramp = m.prism(
        "loading-ramp",
        [(-2.0, 0), (-2.0, 0.08), (-1, 0.80), (-0.91, 0.80), (-0.91, 0.67)],
        1.02,
        "teal",
        bevel=0,
    )
    ramp.rotation_euler.z = math.pi / 2
    for index in range(5):
        m.box(
            "ramp-cleat",
            (0, -1.87 + index * 0.18, 0.18 + index * 0.13),
            (0.96, 0.075, 0.035),
            "gold",
            0,
            rotation=(0.63, 0, 0),
        )
    arrow(m, 0, 0, 0.807, color="teal")
    m.socket("input", (0, 1, 0.8))
    m.socket("cargo", (0, 0, 0.8))
    m.socket("approach", (0, -2.2, 0))
    finish(m)


def hatch_parts(m, y=0):
    for x in (-0.67, 0.67):
        m.box("hatch-jamb", (x, y, 1.17), (0.22, 0.28, 2.34), "teal", 0.035)
        m.box("hatch-foot", (x, y, 0.08), (0.34, 0.38, 0.16), "gold", 0)
    m.box("shutter-box", (0, y, 2.20), (1.64, 0.43, 0.32), "gold", 0.035)
    for index in range(3):
        m.box(
            "raised-shutter-slat",
            (0, y, 1.86 + index * 0.14),
            (1.10, 0.13, 0.12),
            "steel",
            0,
        )
    m.box("hatch-tray", (0, y, 0.70), (1.07, 1.20, 0.12), "teal", 0)
    for index in range(5):
        py = y + (index - 2) * 0.23
        m.cylinder(
            "delivery-roller",
            (-0.50, py, 0.73),
            (0.50, py, 0.73),
            0.07,
            "cut",
            vertices=8,
        )
    m.box("delivery-badge", (0, y + 0.23, 2.21), (0.52, 0.05, 0.18), "cream", 0)


def build_hatch(m):
    hatch_parts(m)
    m.socket("input", (0, 0.60, 0.8))
    m.socket("output", (0, -0.60, 0.8))
    m.socket("mount", (0, 0, 0))
    finish(m)


def build_shop(m):
    hatch_parts(m, 0.94)
    for x in (-1.19, 1.19):
        m.box("shop-post", (x, -0.72, 1.31), (0.22, 0.22, 2.62), "wood", 0.035)
        m.box("shop-foot", (x, -0.72, 0.09), (0.32, 0.32, 0.18), "teal", 0)
        m.box("shop-side", (x, 0.02, 0.49), (0.14, 1.64, 0.98), "wood", 0)
    m.box("sale-counter", (0, -0.67, 1.01), (2.60, 0.61, 0.14), "cut", 0.035)
    m.box("counter-front", (0, -0.77, 0.49), (2.34, 0.12, 0.92), "wood", 0)
    for x in (-0.97, 0.97):
        m.box("counter-strap", (x, -0.847, 0.53), (0.12, 0.05, 0.78), "teal", 0)
    for index in range(6):
        x = (index - 2.5) * 0.45
        color = "coral" if index % 2 else "cream"
        m.box(
            "market-canopy",
            (x, -0.15, 2.65),
            (0.45, 2.22, 0.11),
            color,
            0,
            rotation=(0.12, 0, 0),
        )
        m.box("canopy-valance", (x, -1.25, 2.46), (0.45, 0.07, 0.20), color, 0)
    m.box("product-sign", (0, -0.87, 2.82), (1.46, 0.16, 0.53), "gold", 0.035)
    m.box("sign-inset", (0, -0.96, 2.82), (1.20, 0.035, 0.34), "cream", 0)
    for index in range(2):
        m.box(
            "plank-emblem",
            (0, -0.99 - index * 0.03, 2.77 + index * 0.10),
            (0.65, 0.045, 0.075),
            "wood",
            0,
        )
    m.box("cash-register", (0.72, -0.64, 1.24), (0.44, 0.33, 0.32), "gold", 0.025)
    m.box("register-display", (0.72, -0.81, 1.29), (0.28, 0.025, 0.10), "teal", 0)
    m.box("sale-tray", (-0.51, -0.65, 1.105), (0.88, 0.43, 0.05), "teal", 0)
    m.socket("input", (0, 1.54, 0.8))
    m.socket("delivery", (0, 0.34, 0.8))
    m.socket("sale", (-0.51, -0.65, 1.14))
    m.socket("worker", (0, 0, 0))
    m.socket("customer", (0, -1.65, 0))
    finish(m)


def industry_catalog():
    models = (
        (
            "conveyor-straight",
            build_straight,
            {"input": [0, 0, -1], "output": [0, 0, 1]},
        ),
        ("conveyor-corner", build_corner, {"input": [0, 0, -1], "output": [1, 0, 0]}),
        (
            "diverter",
            build_diverter,
            {"input": [0, 0, -1], "output": [0, 0, 1], "output-right": [1, 0, 0]},
        ),
        ("lift", build_lift, {"input": [0, 0, -1], "output": [0, 0, 1]}),
        ("bridge", build_bridge, {"input": [0, 0, -1], "output": [0, 0, 1]}),
        ("roller-buffer", build_buffer, {"input": [0, 0, -1], "output": [0, 0, 1]}),
        ("storage-rack", build_rack, {}),
        ("gantry-crane", build_crane, {}),
        ("sorter", build_sorter, {"input": [0, 0, -1], "output": [0, 0, 1]}),
        ("loading-dock", build_dock, {"input": [0, 0, -1]}),
        ("delivery-hatch", build_hatch, {"input": [0, 0, -1], "output": [0, 0, 1]}),
        ("market-stall", build_shop, {"input": [0, 0, -1]}),
    )
    for module, build, ports in models:
        yield (
            f"industry-{module}",
            "prop",
            2500,
            {
                "family": "industry",
                "module": module,
                "origin": "module-anchor",
                "ports": {
                    name: {"direction": direction, "widthMeters": 1.0}
                    for name, direction in ports.items()
                },
            },
            build,
        )
