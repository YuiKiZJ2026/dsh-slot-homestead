from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


STAGE_SIZE = (704, 304)
SLOT_CANVAS_X = 320
TABLE_SOURCE_CROP = (0, 248, 1907, 687)
TABLE_TARGET_TOP = 107
TABLE_TARGET_HEIGHT = 197
TABLE_FRONT_Y = 228
GARDEN_BED_BOUNDS = (166, 144, 737, 431)
WATERING_CAN_BOUNDS = (11, 246, 160, 352)
WATERING_CAN_ALPHA_THRESHOLD = 250


def replace_png_atomic(image: Image.Image, destination: Path) -> None:
    """Verify a complete PNG before atomically replacing a live asset."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f".{destination.stem}.tmp.png")
    image.save(temporary, format="PNG", optimize=True)
    with Image.open(temporary) as generated:
        generated.verify()
    temporary.replace(destination)


def build_single_table(source_path: Path) -> Image.Image:
    """Fit the generated one-piece table into the fixed 704x304 world."""
    with Image.open(source_path) as source:
        source = source.convert("RGBA")
        if source.size != (1907, 825):
            raise ValueError(f"single-table source must be 1907x825, got {source.size}")
        table = source.crop(TABLE_SOURCE_CROP).resize(
            (STAGE_SIZE[0], TABLE_TARGET_HEIGHT),
            Image.Resampling.NEAREST,
        )

    stage = Image.new("RGBA", STAGE_SIZE, (0, 0, 0, 0))
    stage.alpha_composite(table, (0, TABLE_TARGET_TOP))
    return stage


def build_equipment_layer(scene_path: Path) -> Image.Image:
    """Keep fixed slot equipment while rejecting every old-table pixel."""
    with Image.open(scene_path) as source:
        scene = source.convert("RGBA")
    if scene.size != (384, 288):
        raise ValueError(f"scene base must be 384x288, got {scene.size}")

    mask = Image.new("L", scene.size, 0)
    draw = ImageDraw.Draw(mask)

    # Rear-left round and small stands, including their own raised wood blocks.
    draw.ellipse((38, 47, 95, 89), fill=255)
    draw.polygon(((42, 78), (91, 78), (92, 108), (44, 108)), fill=255)
    draw.polygon(((39, 84), (93, 84), (98, 127), (34, 127)), fill=255)
    draw.ellipse((102, 61, 153, 95), fill=255)
    draw.polygon(((111, 86), (143, 86), (143, 109), (111, 109)), fill=255)
    draw.polygon(((99, 91), (156, 91), (159, 127), (96, 127)), fill=255)

    # Left middle and front positions.
    draw.ellipse((25, 108, 97, 154), fill=255)
    draw.polygon(((31, 140), (92, 140), (93, 179), (30, 179)), fill=255)
    draw.polygon(((98, 126), (149, 126), (156, 134), (153, 154), (145, 159), (101, 159), (94, 153), (94, 134)), fill=255)
    draw.polygon(((109, 151), (140, 151), (140, 181), (109, 181)), fill=255)
    draw.ellipse((17, 163, 99, 209), fill=255)
    draw.polygon(((21, 190), (95, 190), (96, 213), (90, 222), (27, 222), (20, 213)), fill=255)
    draw.polygon(((96, 170), (151, 170), (160, 179), (157, 210), (151, 222), (94, 222), (87, 212), (88, 179)), fill=255)

    # Slot machine body, crown, lever and two feet. The gap between the feet is
    # explicitly cleared below so no tabletop rectangle can survive.
    draw.ellipse((191, 5, 224, 27), fill=255)
    draw.polygon(((181, 20), (233, 20), (248, 30), (257, 48), (259, 82), (267, 89), (267, 164), (261, 173), (261, 184), (249, 184), (249, 202), (231, 202), (231, 181), (184, 181), (184, 202), (159, 202), (159, 184), (148, 184), (148, 55), (156, 55), (156, 39), (169, 39), (169, 28)), fill=255)
    draw.ellipse((258, 87, 278, 114), fill=255)
    draw.rectangle((274, 101, 282, 154), fill=255)
    draw.ellipse((270, 145, 288, 164), fill=255)
    draw.rectangle((184, 183, 231, 203), fill=0)

    # Front centre positions.
    draw.polygon(((151, 171), (235, 171), (244, 180), (241, 209), (234, 220), (152, 220), (144, 209), (145, 181)), fill=255)
    draw.polygon(((245, 171), (289, 171), (296, 180), (292, 212), (286, 221), (244, 221), (238, 212), (239, 180)), fill=255)

    # Right-side positions.
    draw.polygon(((294, 75), (344, 75), (354, 84), (352, 113), (346, 120), (294, 120), (287, 112), (288, 84)), fill=255)
    draw.polygon(((304, 110), (338, 110), (338, 136), (304, 136)), fill=255)
    draw.ellipse((291, 110, 365, 155), fill=255)
    draw.polygon(((300, 141), (355, 141), (355, 180), (299, 180)), fill=255)
    draw.ellipse((290, 162, 374, 210), fill=255)
    draw.polygon(((295, 190), (369, 190), (370, 213), (364, 223), (301, 223), (294, 213)), fill=255)

    # Respect the source alpha and enforce the structural no-old-desk boundary.
    mask = ImageChops.multiply(mask, scene.getchannel("A"))
    ImageDraw.Draw(mask).rectangle((0, TABLE_FRONT_Y, scene.width, scene.height), fill=0)
    local = Image.new("RGBA", scene.size, (0, 0, 0, 0))
    local.paste(scene, (0, 0), mask)

    stage = Image.new("RGBA", STAGE_SIZE, (0, 0, 0, 0))
    stage.alpha_composite(local, (SLOT_CANVAS_X, 0))
    return stage


def build_garden_bed(source_path: Path) -> Image.Image:
    """Keep only the planter from the original garden reference."""
    with Image.open(source_path) as source:
        source = source.convert("RGBA")
    if source.size != (784, 576):
        raise ValueError(f"garden reference must be 784x576, got {source.size}")

    bed = Image.new("RGBA", source.size, (0, 0, 0, 0))
    bed.alpha_composite(source.crop(GARDEN_BED_BOUNDS), GARDEN_BED_BOUNDS[:2])
    return bed


def build_solid_watering_can(source_path: Path) -> Image.Image:
    """Normalize the generated cutout into an opaque pixel sprite at its fixed world dock."""
    with Image.open(source_path) as source:
        source = source.convert("RGBA")

    alpha = source.getchannel("A").point(
        lambda value: 255 if value >= WATERING_CAN_ALPHA_THRESHOLD else 0,
    )
    source.putalpha(alpha)
    source_bounds = alpha.getbbox()
    if source_bounds is None:
        raise ValueError("watering-can source has no opaque pixels")

    target_width = WATERING_CAN_BOUNDS[2] - WATERING_CAN_BOUNDS[0]
    target_height = WATERING_CAN_BOUNDS[3] - WATERING_CAN_BOUNDS[1]
    sprite = source.crop(source_bounds).resize(
        (target_width, target_height),
        Image.Resampling.NEAREST,
    )
    sprite_alpha = sprite.getchannel("A").point(lambda value: 255 if value > 0 else 0)
    sprite.putalpha(sprite_alpha)

    watering_can = Image.new("RGBA", (784, 576), (0, 0, 0, 0))
    watering_can.alpha_composite(sprite, WATERING_CAN_BOUNDS[:2])
    return watering_can


def write_runtime_asset(image: Image.Image, name: str, public_assets: Path, plugin_assets: Path) -> None:
    replace_png_atomic(image, public_assets / name)
    replace_png_atomic(image, plugin_assets / name)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path, required=True)
    args = parser.parse_args()

    public_assets = args.project / "public" / "assets"
    plugin_assets = args.project / "src" / "plugin" / "client" / "assets"
    table_source = args.project / "artifacts" / "source-assets" / "ecosystem-workbench-table-v3-source.png"
    watering_can_source = (
        args.project
        / "artifacts"
        / "source-assets"
        / "ecosystem-garden-watering-can-solid-source.png"
    )

    table = build_single_table(table_source)
    equipment = build_equipment_layer(public_assets / "scene-base.png")
    bed = build_garden_bed(public_assets / "ecosystem-reference-garden.png")
    watering_can = build_solid_watering_can(watering_can_source)

    write_runtime_asset(table, "ecosystem-workbench-table-v3.png", public_assets, plugin_assets)
    write_runtime_asset(equipment, "ecosystem-slot-equipment-v3.png", public_assets, plugin_assets)
    write_runtime_asset(bed, "ecosystem-garden-bed-v3.png", public_assets, plugin_assets)
    write_runtime_asset(watering_can, "ecosystem-garden-watering-can-v3.png", public_assets, plugin_assets)


if __name__ == "__main__":
    main()
