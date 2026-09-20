"""Montre les trois échoppes avec les piles du jeu et sa caméra orthographique."""

import argparse
import json
import sys
from pathlib import Path

import bpy
import numpy as np

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from asset_common import OUTPUT, write_json  # noqa: E402
from market_visibility import runtime_layout  # noqa: E402
from render_forest import render_model  # noqa: E402


def render_market(directory, size):
    entries = [
        entry
        for entry in json.loads((directory / "manifest.json").read_text())["assets"]
        if entry.get("module") == "market-stall"
    ]
    if [entry["tier"] for entry in entries] != [1, 2, 3]:
        raise ValueError("Les trois niveaux d’échoppe sont requis.")
    scenarios = [("stock-low", 6, 12), ("stock-high", 24, 96)]
    sheet = np.ones((2 * size, 3 * size, 4), dtype=np.float32)
    for row, (name, wood, coins) in enumerate(scenarios):
        for column, entry in enumerate(entries):
            pixels = render_model(directory, entry, size, (wood, coins), f"-{name}")
            start = (1 - row) * size
            sheet[start : start + size, column * size : (column + 1) * size] = pixels
    image = bpy.data.images.new(
        "market-stock-contact-sheet", 3 * size, 2 * size, alpha=True
    )
    image.pixels.foreach_set(sheet.ravel())
    image.filepath_raw = str(directory / "contact-sheet-market-stock.png")
    image.file_format = "PNG"
    image.save()
    write_json(
        directory / "market-stock-preview.json",
        {
            "layout": runtime_layout(),
            "scenarios": [
                {"name": name, "woodItems": wood, "coinItems": coins}
                for name, wood, coins in scenarios
            ],
            "assets": [entry["id"] for entry in entries],
            "projection": "orthographic",
            "framing": "fit-assembly",
        },
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=OUTPUT)
    parser.add_argument("--size", type=int, default=600)
    args = parser.parse_args(
        sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    )
    render_market(args.input.resolve(), args.size)
