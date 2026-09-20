"""Accessoires originaux du camp : bois miel, toile et motif de jeune pousse."""


def sprout(m, x, y, z, scale=1):
    m.cylinder(
        "sprout-stem",
        (x, y, z),
        (x, y, z + 0.28 * scale),
        0.035 * scale,
        "cream",
        vertices=6,
    )
    for side in (-1, 1):
        leaf = m.prism(
            "sprout-leaf",
            [(0, 0), (side * 0.23, 0.03), (side * 0.30, 0.23), (side * 0.09, 0.20)],
            0.045 * scale,
            "gold",
            bevel=0,
        )
        leaf.scale.x = scale
        leaf.scale.z = scale
        leaf.location = (x, y, z + 0.17 * scale)


def post(m, x, y, height):
    m.box("timber-post", (x, y, height / 2), (0.28, 0.30, height), "wood", 0.045)
    m.box("post-shoe", (x, y, 0.13), (0.34, 0.36, 0.26), "iron", 0.035)
    m.box("post-collar", (x, y, height - 0.27), (0.32, 0.34, 0.12), "teal", 0.02)


def lantern(m, x, y, z):
    m.cylinder(
        "lantern-core",
        (x, y, z),
        (x, y, z + 0.42),
        0.18,
        "cream",
        vertices=6,
        radius_end=0.23,
    )
    for height, radius, end in ((0, 0.23, 0.17), (0.42, 0.31, 0.08)):
        m.cylinder(
            "lantern-cap",
            (x, y, z + height),
            (x, y, z + height + 0.14),
            radius,
            "teal",
            vertices=6,
            radius_end=end,
        )
    for side in (-1, 1):
        m.cylinder(
            "lantern-frame",
            (x + side * 0.15, y - 0.10, z + 0.08),
            (x + side * 0.19, y - 0.10, z + 0.44),
            0.025,
            "gold",
            vertices=6,
        )


def build_gate(m):
    for x in (-1.75, 1.75):
        post(m, x, 0, 3.35)
        m.cylinder(
            "fork-brace", (x, 0, 2.36), (x * 0.64, 0, 3.25), 0.105, "bark", vertices=7
        )
        lantern(m, x, -0.31, 1.91)
        m.socket("fence-left" if x < 0 else "fence-right", (x, 0, 0))
    m.box("lintel", (0, 0, 3.22), (4.15, 0.42, 0.33), "cut", 0.065)
    for side in (-1, 1):
        roof = m.prism(
            "peaked-roof",
            [(0, 3.95), (side * 2.20, 3.45), (side * 2.20, 3.28), (0, 3.75)],
            0.98,
            "teal",
            bevel=0.025,
        )
        roof.location.y = 0.02
    m.box("welcome-plaque", (0, -0.30, 3.24), (0.93, 0.14, 0.65), "bark", 0.06)
    sprout(m, 0, -0.39, 3.03, 0.9)
    m.socket("passage", (0, 0, 0))
    m.socket("banner", (0, 0.36, 3.08))
    m.static_mesh()


def build_lamp(m):
    post(m, -0.35, 0, 2.80)
    m.cylinder(
        "crooked-arm",
        (-0.35, 0, 2.67),
        (0.51, 0, 2.90),
        0.10,
        "wood",
        vertices=7,
        radius_end=0.07,
    )
    m.cylinder(
        "arm-brace", (-0.35, 0, 2.11), (0.25, 0, 2.82), 0.055, "bark", vertices=6
    )
    m.cylinder(
        "lantern-hanger", (0.43, 0, 2.40), (0.43, 0, 2.87), 0.035, "iron", vertices=6
    )
    lantern(m, 0.43, 0, 1.90)
    m.socket("light", (0.43, 0, 2.18))
    m.static_mesh()


def build_arch(m):
    for x in (-1.30, 1.30):
        post(m, x, 0, 2.83)
        m.cylinder(
            "arch-branch", (x, 0, 2.44), (x * 0.32, 0, 3.13), 0.13, "wood", vertices=7
        )
    m.box("district-beam", (0, 0, 2.95), (3.08, 0.31, 0.24), "cut", 0.055)
    for x, drop, color in (
        (-0.72, 0.44, "teal"),
        (0, 0.63, "coral"),
        (0.72, 0.44, "teal"),
    ):
        flag = m.prism(
            "district-pennant",
            [
                (-0.24, 0),
                (0.24, 0),
                (0.24, -drop + 0.14),
                (0, -drop),
                (-0.24, -drop + 0.14),
            ],
            0.055,
            color,
            bevel=0,
        )
        flag.location = (x, -0.18, 2.94)
    sprout(m, 0, -0.23, 2.55, 0.65)
    m.socket("passage", (0, 0, 0))
    m.socket("banner", (0, -0.18, 2.94))
    m.static_mesh()


def build_logs(m):
    for x in (-0.70, 0.70):
        m.box("rack-foot", (x, 0, 0.09), (0.20, 1.44, 0.18), "wood", 0.025)
        for y in (-0.65, 0.65):
            m.box("rack-stake", (x, y, 0.42), (0.16, 0.16, 0.84), "teal", 0.025)
    for layer in range(3):
        for index in range(3 - layer):
            y = (index - (2 - layer) / 2) * 0.40
            z = 0.38 + layer * 0.35
            length = 1.90 - index * 0.11 + layer * 0.07
            m.cylinder(
                "stacked-log",
                (-length / 2, y, z),
                (length / 2, y, z),
                0.21,
                "bark",
                vertices=8,
            )
            for side in (-1, 1):
                end = side * length / 2
                m.cylinder(
                    "log-cut",
                    (end, y, z),
                    (end + side * 0.012, y, z),
                    0.18,
                    "cut",
                    vertices=8,
                )
                m.cylinder(
                    "log-heart",
                    (end + side * 0.013, y, z),
                    (end + side * 0.018, y, z),
                    0.055,
                    "wood",
                    vertices=6,
                )
    m.socket("cargo", (0, 0, 1.28))
    m.static_mesh()


def build_planks(m):
    for x in (-0.60, 0.60):
        m.box("stack-skid", (x, 0, 0.11), (0.22, 1.0, 0.22), "bark", 0.025)
    for layer in range(4):
        for row in range(3):
            m.box(
                "stacked-plank",
                ((layer % 2) * 0.09 - 0.045, (row - 1) * 0.29, 0.27 + layer * 0.15),
                (1.88 - row * 0.08, 0.26, 0.13),
                "cut" if (layer + row) % 2 else "wood",
                0.018,
            )
    for x in (-0.56, 0.56):
        m.box("bundle-strap", (x, 0, 0.80), (0.075, 0.88, 0.045), "teal", 0)
        for y in (-0.435, 0.435):
            m.box("bundle-strap", (x, y, 0.51), (0.075, 0.045, 0.58), "teal", 0)
    m.socket("cargo", (0, 0, 0.84))
    m.static_mesh()


def build_cart(m):
    for x in (-0.68, 0.68):
        m.cylinder(
            "wheel-rim",
            (x - 0.07, 0.20, 0.46),
            (x + 0.07, 0.20, 0.46),
            0.46,
            "iron",
            vertices=12,
        )
        for side in (-1, 1):
            face = x + side * 0.075
            m.cylinder(
                "wheel-disc",
                (face, 0.20, 0.46),
                (face + side * 0.012, 0.20, 0.46),
                0.35,
                "wood",
                vertices=12,
            )
            m.cylinder(
                "wheel-hub",
                (face, 0.20, 0.46),
                (face + side * 0.06, 0.20, 0.46),
                0.10,
                "gold",
                vertices=8,
            )
        m.box(
            "cart-shaft",
            (x * 0.70, -1.08, 0.53),
            (0.12, 1.90, 0.14),
            "wood",
            0.025,
            rotation=(0.09, 0, 0),
        )
    m.box("cart-floor", (0, 0, 0.64), (1.18, 1.55, 0.17), "cut", 0.035)
    for layer in range(2):
        z = 0.88 + layer * 0.26
        for x in (-0.58, 0.58):
            m.box("cart-side", (x, 0, z), (0.10, 1.55, 0.22), "wood", 0.025)
        for y in (-0.73, 0.73):
            m.box("cart-end", (0, y, z), (1.18, 0.10, 0.22), "cut", 0.025)
    for x in (-0.56, 0.56):
        for y in (-0.71, 0.71):
            m.box("cart-corner", (x, y, 0.99), (0.14, 0.14, 0.75), "teal", 0.025)
    m.box("rest-leg", (0, -0.54, 0.29), (0.18, 0.20, 0.58), "bark", 0.025)
    m.socket("cargo", (0, 0, 0.73))
    m.socket("handle", (0, -1.97, 0.45))
    m.static_mesh()


def build_crate(m):
    m.box("crate-core", (0, 0, 0.44), (0.90, 0.78, 0.88), "wood", 0.035)
    for x in (-0.32, 0, 0.32):
        m.box("lid-plank", (x, 0, 0.91), (0.29, 0.82, 0.09), "cut", 0.015)
    for y in (-0.41, 0.41):
        for x in (-0.36, 0.36):
            m.box("crate-strap", (x, y, 0.47), (0.11, 0.08, 0.94), "cut", 0.018)
        m.box(
            "diagonal-brace",
            (0, y, 0.45),
            (0.85, 0.08, 0.13),
            "cut",
            0.018,
            rotation=(0, -0.68, 0),
        )
    m.box("shipping-tag", (0, -0.475, 0.58), (0.34, 0.035, 0.25), "teal", 0.01)
    sprout(m, 0, -0.50, 0.48, 0.4)
    m.socket("stack", (0, 0, 0.955))
    m.static_mesh()


def build_barrel(m):
    for start, end, radius, top in (
        (0, 0.20, 0.33, 0.40),
        (0.20, 0.70, 0.40, 0.40),
        (0.70, 0.90, 0.40, 0.33),
    ):
        m.cylinder(
            "barrel-staves",
            (0, 0, start),
            (0, 0, end),
            radius,
            "wood",
            radius_end=top,
            vertices=12,
        )
    for z in (0.19, 0.70):
        m.cylinder(
            "barrel-hoop",
            (0, 0, z - 0.045),
            (0, 0, z + 0.045),
            0.415,
            "teal",
            vertices=12,
        )
    m.cylinder("barrel-lid", (0, 0, 0.89), (0, 0, 0.92), 0.315, "cut", vertices=12)
    for y in (-0.12, 0.12):
        m.box("lid-seam", (0, y, 0.922), (0.52, 0.012, 0.006), "bark", 0)
    m.cylinder("bung", (0.14, 0, 0.92), (0.14, 0, 0.945), 0.055, "bark", vertices=8)
    m.socket("stack", (0, 0, 0.945))
    m.static_mesh()


def build_banner(m):
    m.cylinder(
        "banner-rail", (-0.72, 0, 1.65), (0.72, 0, 1.65), 0.06, "wood", vertices=8
    )
    for x in (-0.48, 0.48):
        m.box("cloth-loop", (x, 0, 1.57), (0.12, 0.15, 0.25), "gold", 0.015)
    m.prism(
        "swallowtail-cloth",
        [(-0.57, 1.52), (0.57, 1.52), (0.57, 0), (0, 0.30), (-0.57, 0)],
        0.065,
        "teal",
        bevel=0,
    )
    for x in (-0.51, 0.51):
        m.box("woven-border", (x, -0.038, 0.82), (0.045, 0.018, 1.38), "gold", 0)
    m.prism(
        "banner-badge",
        [(0, 0.51), (0.36, 0.87), (0, 1.30), (-0.36, 0.87)],
        0.035,
        "cream",
        bevel=0,
    ).location.y = -0.057
    sprout(m, 0, -0.095, 0.73, 0.75)
    m.socket("mount-left", (-0.60, 0, 1.65))
    m.socket("mount-right", (0.60, 0, 1.65))
    m.static_mesh()


def build_planter(m):
    m.box("planter-box", (0, 0, 0.25), (1.44, 0.68, 0.50), "wood", 0.045)
    m.box("soil", (0, 0, 0.51), (1.22, 0.49, 0.06), "bark", 0.025)
    for y in (-0.34, 0.34):
        m.box("planter-rim", (0, y, 0.50), (1.52, 0.10, 0.13), "cut", 0.025)
        for x in (-0.58, 0.58):
            m.box("planter-band", (x, y, 0.26), (0.10, 0.075, 0.48), "teal", 0.012)
    for index, x in enumerate((-0.43, 0, 0.43)):
        z = 0.78 + (index % 2) * 0.16
        m.blob(
            "herb-cluster",
            (x, 0, z),
            (0.30, 0.29, 0.36),
            "leaf" if index % 2 else "leaf-light",
            segments=8,
            rings=5,
        )
        for side in (-1, 1):
            m.blob(
                "herb-leaf",
                (x + side * 0.17, -0.16, z - 0.13),
                (0.18, 0.17, 0.21),
                "leaf-dark",
                segments=6,
                rings=4,
            )
        m.blob(
            "camp-flower",
            (x, -0.03, z + 0.31),
            (0.09, 0.09, 0.09),
            "coral" if index % 2 else "gold",
            segments=6,
            rings=4,
        )
    m.socket("plant", (0, 0, 0.55))
    m.static_mesh()


def build_signpost(m):
    post(m, 0, 0, 2.08)
    for side, z, color in ((1, 1.76, "teal"), (-1, 1.28, "coral")):
        arrow = m.prism(
            "direction-board",
            [(-0.47, -0.16), (0.45, -0.16), (0.73, 0), (0.45, 0.19), (-0.47, 0.19)],
            0.13,
            color,
            bevel=0.02,
        )
        arrow.scale.x = side
        arrow.location = (0, -0.19, z)
        for x in (-0.23, 0.02):
            m.box(
                "direction-mark", (x * side, -0.27, z), (0.15, 0.025, 0.045), "cream", 0
            )
    m.blob("post-seed", (0, 0, 2.15), (0.16, 0.16, 0.20), "gold", segments=8, rings=5)
    m.socket("label", (0, 0, 2.48))
    m.static_mesh()


def build_awning(m):
    for x in (-1.22, 1.22):
        for y in (-0.69, 0.69):
            height = 2.50 if y < 0 else 2.88
            post(m, x, y, height)
        m.cylinder(
            "awning-brace", (x, 0.69, 2.12), (x, 0.12, 2.70), 0.075, "bark", vertices=6
        )
    for index in range(7):
        x = (index - 3) * 0.40
        m.box(
            "canvas-stripe",
            (x, 0, 2.72),
            (0.405, 1.91, 0.095),
            "teal" if index % 2 == 0 else "cream",
            0.025,
            rotation=(0.25, 0, 0),
        )
        scallop = m.prism(
            "awning-scallop",
            [(-0.20, 0.10), (0.20, 0.10), (0.17, -0.12), (0, -0.20), (-0.17, -0.12)],
            0.055,
            "teal" if index % 2 == 0 else "cream",
            bevel=0,
        )
        scallop.location = (x, -0.93, 2.49)
    for y, z in ((-0.69, 2.46), (0.69, 2.84)):
        m.box("awning-beam", (0, y, z), (2.73, 0.16, 0.16), "cut", 0.025)
    m.socket("station", (0, 0, 0))
    m.socket("sign", (0, -0.78, 2.35))
    m.static_mesh()


def camp_catalog():
    models = (
        ("camp-gate", build_gate, "entrance", {"passageWidthMeters": 3.22}),
        ("camp-lamp", build_lamp, "path", {}),
        ("camp-arch", build_arch, "district", {"passageWidthMeters": 2.32}),
        ("camp-log-pile", build_logs, "storage", {}),
        ("camp-plank-pile", build_planks, "storage", {}),
        ("camp-cart", build_cart, "courtyard", {}),
        ("camp-crate", build_crate, "storage", {}),
        ("camp-barrel", build_barrel, "storage", {}),
        ("camp-banner", build_banner, "suspended", {}),
        ("camp-planter", build_planter, "path", {}),
        ("camp-signpost", build_signpost, "junction", {}),
        ("camp-awning", build_awning, "station", {}),
    )
    for name, build, placement, details in models:
        yield (
            name,
            "prop",
            2500,
            {"family": "camp", "placement": placement, **details},
            build,
        )
