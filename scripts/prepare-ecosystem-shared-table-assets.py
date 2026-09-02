from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


TARGET_SIZE = (784, 576)
REACTION_SIZE = (128, 128)


def remove_edge_background(image: Image.Image) -> Image.Image:
    """Remove the generated navy backdrop without touching enclosed blue water."""
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()
    queue: deque[tuple[int, int]] = deque()
    queue.extend((x, 0) for x in range(width))
    queue.extend((x, height - 1) for x in range(width))
    queue.extend((0, y) for y in range(height))
    queue.extend((width - 1, y) for y in range(height))
    visited: set[tuple[int, int]] = set()

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited:
            continue
        visited.add((x, y))
        red, green, blue, alpha = pixels[x, y]
        background_like = alpha == 0 or (
            red < 72
            and green < 104
            and blue < 172
            and blue >= green
            and blue > red
        )
        if not background_like:
            continue
        pixels[x, y] = (red, green, blue, 0)
        if x > 0:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))

    return image


def match_slot_table_palette(image: Image.Image) -> Image.Image:
    """Bring the clean extension's wood into the slot scene's darker palette."""
    image = image.copy()
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            is_wood = (
                alpha > 0
                and 45 < red < 210
                and green < 100
                and red > green * 1.8
                and red > blue * 2
            )
            if is_wood:
                pixels[x, y] = (round(red * 0.88), green, min(255, blue + 2), alpha)
    return image


def prepare(
    source: Path,
    destination: Path,
    *,
    shift_y: int = 0,
    scale_y: float = 1.0,
    match_table: bool = False,
) -> None:
    with Image.open(source) as image:
        image = image.convert("RGBA").resize(TARGET_SIZE, Image.Resampling.NEAREST)
        image = remove_edge_background(image)
        if match_table:
            image = match_slot_table_palette(image)
        if scale_y != 1.0:
            scaled_height = round(TARGET_SIZE[1] * scale_y)
            image = image.resize((TARGET_SIZE[0], scaled_height), Image.Resampling.NEAREST)
        if scale_y != 1.0 or shift_y:
            # Apply the vertical affine transform in one composite.  Baking the
            # tall image to 576px before a negative shift would discard the
            # lower fascia and make the two table halves impossible to align.
            transformed = Image.new("RGBA", TARGET_SIZE, (0, 0, 0, 0))
            transformed.alpha_composite(image, (0, shift_y))
            image = transformed
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, optimize=True)


def copy_to_plugin(public_asset: Path, plugin_assets: Path) -> None:
    destination = plugin_assets / public_asset.name
    destination.write_bytes(public_asset.read_bytes())


def prepare_reactions(source: Path, public_assets: Path, plugin_assets: Path) -> None:
    names = ("fish", "crop", "animal")
    with Image.open(source) as image:
        image = remove_edge_background(image)
        panel_width = image.width // 3
        for index, name in enumerate(names):
            left = index * panel_width
            right = image.width if index == 2 else (index + 1) * panel_width
            panel = image.crop((left, 0, right, image.height))
            bounds = panel.getchannel("A").getbbox()
            if bounds is None:
                raise ValueError(f"reaction panel {name} has no visible pixels")
            effect = panel.crop(bounds)
            padding = max(12, round(max(effect.size) * 0.1))
            side = max(effect.size) + padding * 2
            square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            square.alpha_composite(
                effect,
                ((side - effect.width) // 2, (side - effect.height) // 2),
            )
            square = square.resize(REACTION_SIZE, Image.Resampling.NEAREST)
            destination = public_assets / f"ecosystem-reaction-{name}.png"
            square.save(destination, optimize=True)
            copy_to_plugin(destination, plugin_assets)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path, required=True)
    parser.add_argument("--table", type=Path)
    parser.add_argument("--aquarium", type=Path)
    parser.add_argument("--garden", type=Path)
    parser.add_argument("--pasture", type=Path)
    parser.add_argument("--reactions", type=Path)
    args = parser.parse_args()

    public_assets = args.project / "public" / "assets"
    plugin_assets = args.project / "src" / "plugin" / "client" / "assets"
    outputs = {
        "ecosystem-shared-table.png": (args.table, -136, 1.46, True),
        "ecosystem-reference-aquarium.png": (args.aquarium, -50, 1.0, False),
        "ecosystem-reference-garden.png": (args.garden, 0, 1.0, False),
        "ecosystem-reference-pasture.png": (args.pasture, 0, 1.0, False),
    }
    for filename, (source, shift_y, scale_y, match_table) in outputs.items():
        if source is None:
            continue
        destination = public_assets / filename
        prepare(
            source,
            destination,
            shift_y=shift_y,
            scale_y=scale_y,
            match_table=match_table,
        )
        copy_to_plugin(destination, plugin_assets)
    if args.reactions is not None:
        prepare_reactions(args.reactions, public_assets, plugin_assets)


if __name__ == "__main__":
    main()
