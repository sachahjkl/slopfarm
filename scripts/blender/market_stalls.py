"""Comptoirs ouverts, adaptés aux piles physiques du marché."""

from industry_props import finish, foot


def counter(m, center, size, top=0.99):
    x, y = center
    width, depth = size
    m.box("counter-frame", (x, y, top - 0.15), (width, depth, 0.18), "teal", 0.035)
    for index in range(4):
        m.box(
            "counter-board",
            (x, y + (index - 1.5) * depth / 4, top - 0.035),
            (width + 0.04, depth / 4 - 0.012, 0.07),
            "cut",
            0,
        )
    for side in (-1, 1) if width > 1 else (0,):
        for end in (-1, 1):
            foot(
                m,
                x + side * (width / 2 - 0.18),
                y + end * (depth / 2 - 0.15),
                top - 0.22,
            )


def receiver(m, tier):
    m.box("rear-receiver", (1.55, 1.20, 0.69), (1.10, 1.00, 0.14), "teal", 0.025)
    foot(m, 1.55, 1.46, 0.60)
    if tier == 1:
        m.box("manual-delivery-tray", (1.55, 1.20, 0.78), (1.02, 0.99, 0.04), "cut", 0)
    else:
        for index in range(4):
            y = 0.83 + index * 0.24
            m.cylinder(
                "delivery-roller",
                (1.05, y, 0.73),
                (2.05, y, 0.73),
                0.07,
                "steel" if index % 2 else "cut",
                vertices=8,
            )
        for x in (1.04, 2.06):
            m.box("delivery-jamb", (x, 1.00, 0.73), (0.10, 0.66, 0.34), "gold", 0)
        m.box(
            "folded-delivery-hatch", (1.55, 0.76, 0.90), (0.94, 0.16, 0.10), "teal", 0
        )
        m.box("hatch-handle", (1.55, 0.67, 0.91), (0.24, 0.035, 0.045), "gold", 0)


def build_market_stall(m, tier):
    counter(m, (0, 0), (2.60, 1.40))
    # La pile de bois repose à 0,99 m. Le plateau de pièces évite son emprise.
    m.box("coin-pedestal", (0.57, 0.09, 1.105), (0.25, 0.24, 0.23), "teal", 0.025)
    m.box("coin-tray", (0.57, 0.09, 1.235), (0.52, 0.38, 0.03), "gold", 0)
    m.box("front-apron", (0, 0.65, 0.56), (2.34, 0.075, 0.39), "wood", 0.025)
    m.box("tier-plaque", (-0.66, 0.696, 0.56), (0.62, 0.025, 0.24), "teal", 0)
    for index in range(tier):
        m.box(
            "tier-mark",
            (-0.85 + index * 0.19, 0.716, 0.56),
            (0.10, 0.02, 0.12),
            "gold",
            0,
        )
    receiver(m, tier)
    if tier >= 2:
        counter(m, (-1.64, 0), (0.62, 1.12))
        m.box(
            "second-service-tray", (-1.64, 0.24, 1.015), (0.49, 0.39, 0.05), "teal", 0
        )
        m.box("service-drawer", (-1.64, 0.40, 0.64), (0.47, 0.36, 0.29), "coral", 0.025)
        m.box("drawer-handle", (-1.64, 0.59, 0.64), (0.21, 0.04, 0.055), "gold", 0)
        m.socket("service-2", (-1.64, 0.24, 1.04))
        m.socket("customer-2", (-1.1, 1.65, 0))
    if tier >= 3:
        m.box(
            "side-distributor", (1.75, -0.13, 0.54), (0.80, 1.40, 0.92), "teal", 0.035
        )
        for index in range(6):
            y = -0.70 + index * 0.23
            m.cylinder(
                "distribution-roller",
                (1.40, y, 0.95),
                (2.10, y, 0.95),
                0.06,
                "steel",
                vertices=8,
            )
        m.box("side-motor", (2.12, 0.42, 0.58), (0.40, 0.48, 0.44), "gold", 0)
        m.cylinder(
            "motor-cover",
            (2.32, 0.42, 0.58),
            (2.37, 0.42, 0.58),
            0.15,
            "teal",
            vertices=10,
        )
        m.box("cash-register", (1.77, -0.73, 1.16), (0.62, 0.33, 0.30), "gold", 0.035)
        m.box("register-display", (1.77, -0.907, 1.20), (0.40, 0.024, 0.12), "navy", 0)
        m.box("status-pod", (2.02, 0.29, 1.15), (0.24, 0.34, 0.35), "teal", 0.025)
        for index, color in enumerate(("leaf-light", "gold", "coral")):
            m.cylinder(
                "status-lens",
                (2.02, 0.108, 1.04 + index * 0.11),
                (2.02, 0.08, 1.04 + index * 0.11),
                0.041,
                color,
                vertices=8,
            )
        m.socket("distribution", (1.75, -0.40, 1.01))
        m.socket("register", (1.77, -0.73, 1.31))
    m.socket("input", (1.55, 1.70, 0.8))
    m.socket("delivery", (1.55, 0.80, 0.8))
    m.socket("stock", (0.42, -0.35, 0.99))
    m.socket("coins", (0.57, 0, 1.25))
    m.socket("sale", (-0.55, 0.45, 0.99))
    m.socket("worker", (-1.05, -1.10, 0))
    m.socket("customer", (0, 1.65, 0))
    finish(m)


def market_catalog():
    for tier in range(1, 4):
        yield (
            f"industry-market-stall-tier-{tier}",
            "prop",
            2500,
            {
                "family": "industry",
                "module": "market-stall",
                "tier": tier,
                "origin": "module-anchor",
                "ports": {"input": {"direction": [0, 0, -1], "widthMeters": 1}},
                "stockClearance": {
                    "min": [0.21, 0.99, 0.14],
                    "max": [0.63, None, 0.56],
                    "coins": {"center": [0.57, 1.25, 0], "radiusMeters": 0.28},
                },
                "gamePlacement": {"yawDegrees": 90, "scale": 1},
            },
            lambda m, tier=tier: build_market_stall(m, tier),
        )
