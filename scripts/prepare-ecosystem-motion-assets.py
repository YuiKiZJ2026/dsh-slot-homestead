from __future__ import annotations

import argparse
import colorsys
from pathlib import Path
from typing import Callable

from PIL import Image, ImageFilter


PixelRule = Callable[[float, float, float], bool]


def remove_border_components(alpha: Image.Image, minimum_area: int = 4) -> Image.Image:
    width, height = alpha.size
    pixels = alpha.load()
    visited: set[tuple[int, int]] = set()
    for start_y in range(height):
        for start_x in range(width):
            if pixels[start_x, start_y] == 0 or (start_x, start_y) in visited:
                continue
            stack = [(start_x, start_y)]
            component: list[tuple[int, int]] = []
            touches_border = False
            while stack:
                x, y = stack.pop()
                if (x, y) in visited or pixels[x, y] == 0:
                    continue
                visited.add((x, y))
                component.append((x, y))
                touches_border = touches_border or x in (0, width - 1) or y in (0, height - 1)
                for next_y in range(max(0, y - 1), min(height, y + 2)):
                    for next_x in range(max(0, x - 1), min(width, x + 2)):
                        if (next_x, next_y) not in visited:
                            stack.append((next_x, next_y))
            if touches_border or len(component) < minimum_area:
                for x, y in component:
                    pixels[x, y] = 0
    return alpha


def keep_largest_component(alpha: Image.Image) -> Image.Image:
    width, height = alpha.size
    pixels = alpha.load()
    visited: set[tuple[int, int]] = set()
    largest: list[tuple[int, int]] = []
    for start_y in range(height):
        for start_x in range(width):
            if pixels[start_x, start_y] == 0 or (start_x, start_y) in visited:
                continue
            stack = [(start_x, start_y)]
            component: list[tuple[int, int]] = []
            while stack:
                x, y = stack.pop()
                if (x, y) in visited or pixels[x, y] == 0:
                    continue
                visited.add((x, y))
                component.append((x, y))
                for next_y in range(max(0, y - 1), min(height, y + 2)):
                    for next_x in range(max(0, x - 1), min(width, x + 2)):
                        if (next_x, next_y) not in visited:
                            stack.append((next_x, next_y))
            if len(component) > len(largest):
                largest = component

    result = Image.new("L", alpha.size, 0)
    result_pixels = result.load()
    for x, y in largest:
        result_pixels[x, y] = pixels[x, y]
    return result


def hsv(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    red, green, blue = (channel / 255 for channel in rgb)
    hue, saturation, value = colorsys.rgb_to_hsv(red, green, blue)
    return hue * 360, saturation, value


def extract_sprite(
    source: Image.Image,
    box: tuple[int, int, int, int],
    destination: Path,
    seed_rule: PixelRule,
    *,
    dilation: int = 5,
    padding: int = 4,
    remove_border: bool = True,
    keep_largest: bool = False,
    erase_boxes: tuple[tuple[int, int, int, int], ...] = (),
) -> None:
    crop = source.crop(box).convert("RGBA")
    alpha = Image.new("L", crop.size, 0)
    alpha_pixels = alpha.load()
    source_pixels = crop.load()
    for y in range(crop.height):
        for x in range(crop.width):
            hue, saturation, value = hsv(source_pixels[x, y][:3])
            alpha_pixels[x, y] = 255 if seed_rule(hue, saturation, value) else 0

    alpha = alpha.filter(ImageFilter.MaxFilter(dilation))
    if remove_border:
        alpha = remove_border_components(alpha)
    if keep_largest:
        alpha = keep_largest_component(alpha)
    for erase_box in erase_boxes:
        alpha.paste(0, erase_box)
    bounds = alpha.getbbox()
    if bounds is None:
        raise RuntimeError(f"No foreground found for {destination.name}")
    left, top, right, bottom = bounds
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(crop.width, right + padding)
    bottom = min(crop.height, bottom + padding)
    crop.putalpha(alpha)
    destination.parent.mkdir(parents=True, exist_ok=True)
    crop.crop((left, top, right, bottom)).save(destination)


def crop_background(source_path: Path, box: tuple[int, int, int, int], destination: Path) -> None:
    with Image.open(source_path) as source:
        cropped = source.convert("RGB").crop(box)
        resized = cropped.resize((456, 304), Image.Resampling.NEAREST)
        destination.parent.mkdir(parents=True, exist_ok=True)
        resized.save(destination, optimize=True)


def build_table_extension(scene_path: Path, destination: Path) -> None:
    """Reuse the slot's woodwork as one continuous bench without a second inner end-cap."""
    with Image.open(scene_path) as source:
        table = source.convert("RGBA").crop((16, 150, 368, 282))
        table = table.resize((308, 132), Image.Resampling.NEAREST)
        # The source is a complete standalone table. Replace its inner/right end
        # with a real center section so it can overlap the slot table seamlessly.
        tabletop_continuation = table.crop((92, 0, 164, 76))
        front_rail_continuation = table.crop((82, 76, 154, 132))
        table.alpha_composite(tabletop_continuation, (236, 0))
        table.alpha_composite(front_rail_continuation, (236, 76))
        destination.parent.mkdir(parents=True, exist_ok=True)
        table.save(destination, optimize=True)


def normalize_reference_scene(source_path: Path, destination: Path) -> None:
    """Prepare generated habitat art for a 392x288 runtime slot at 2x density."""
    target_width, target_height = 784, 576
    background = (7, 20, 44)
    with Image.open(source_path) as source:
        scene = source.convert("RGBA")
        scale = target_width / scene.width
        rendered_height = min(target_height, max(1, round(scene.height * scale)))
        scene = scene.resize((target_width, rendered_height), Image.Resampling.NEAREST)
        pixels = scene.load()
        for y in range(scene.height):
            for x in range(scene.width):
                red, green, blue, alpha = pixels[x, y]
                if alpha > 0 and (red, green, blue) == background:
                    pixels[x, y] = (red, green, blue, 0)

        # Image edits can leave a subtle navy gradient around the object. Remove
        # only dark-blue pixels connected to an outer edge so aquarium water and
        # other enclosed blue details remain intact.
        visited: set[tuple[int, int]] = set()
        stack = [
            *((x, 0) for x in range(scene.width)),
            *((x, scene.height - 1) for x in range(scene.width)),
            *((0, y) for y in range(scene.height)),
            *((scene.width - 1, y) for y in range(scene.height)),
        ]
        while stack:
            x, y = stack.pop()
            if (x, y) in visited:
                continue
            visited.add((x, y))
            red, green, blue, alpha = pixels[x, y]
            background_like = alpha == 0 or (
                red < 32 and green < 52 and blue < 96 and blue >= green and blue > red
            )
            if not background_like:
                continue
            pixels[x, y] = (red, green, blue, 0)
            if x > 0:
                stack.append((x - 1, y))
            if x + 1 < scene.width:
                stack.append((x + 1, y))
            if y > 0:
                stack.append((x, y - 1))
            if y + 1 < scene.height:
                stack.append((x, y + 1))

        canvas = Image.new("RGBA", (target_width, target_height), (0, 0, 0, 0))
        canvas.alpha_composite(scene, (0, target_height - rendered_height))
        destination.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(destination, optimize=True)


def normalize_reference_asset(source_path: Path, destination: Path) -> None:
    """Prepare generated habitat art for the exact 392×288 runtime slot at 2× density."""
    with Image.open(source_path) as source:
        source = source.convert("RGBA")
        render_width = 784
        render_height = round(source.height * render_width / source.width)
        if render_height > 576:
            render_height = 576
            render_width = round(source.width * render_height / source.height)
        rendered = source.resize((render_width, render_height), Image.Resampling.NEAREST)
        pixels = rendered.load()
        for y in range(rendered.height):
            for x in range(rendered.width):
                red, green, blue, alpha = pixels[x, y]
                if alpha > 0 and (red, green, blue) == (7, 20, 44):
                    pixels[x, y] = (7, 20, 44, 0)

        canvas = Image.new("RGBA", (784, 576), (7, 20, 44, 0))
        canvas.alpha_composite(rendered, ((784 - render_width), 576 - render_height))
        destination.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(destination, optimize=True)


def warm_sprite(hue: float, saturation: float, value: float) -> bool:
    return (
        (value > 0.72 and saturation < 0.42)
        or (hue < 75 and saturation > 0.30 and value > 0.28)
        or (hue > 330 and saturation > 0.30 and value > 0.28)
    )


def chick_sprite(hue: float, saturation: float, value: float) -> bool:
    return (
        (value > 0.66 and saturation < 0.44)
        or (hue < 70 and saturation > 0.22 and value > 0.20)
        or (hue > 330 and saturation > 0.24 and value > 0.28)
    )


def plant_sprite(hue: float, saturation: float, value: float) -> bool:
    return (
        (65 <= hue <= 175 and saturation > 0.22 and value > 0.15)
        or (hue < 65 and saturation > 0.32 and value > 0.28)
        or (hue > 330 and saturation > 0.35 and value > 0.30)
        or (175 < hue < 265 and saturation > 0.34 and value > 0.42)
        or (value > 0.78 and saturation < 0.28)
    )


def green_sprite(hue: float, saturation: float, value: float) -> bool:
    return 68 <= hue <= 172 and saturation > 0.24 and value > 0.14


def crop_sprite(hue: float, saturation: float, value: float) -> bool:
    return (
        (65 <= hue <= 175 and saturation > 0.24 and value > 0.16)
        or ((hue < 20 or hue > 340) and saturation > 0.38 and value > 0.34)
        or (20 <= hue < 65 and saturation > 0.48 and value > 0.52)
        or (175 < hue < 265 and saturation > 0.38 and value > 0.55)
        or (value > 0.82 and saturation < 0.30)
    )


def tomato_sprite(hue: float, saturation: float, value: float) -> bool:
    return (
        green_sprite(hue, saturation, value)
        or ((hue < 25 or hue > 340) and saturation > 0.50 and value > 0.34)
    )


def green_orange_sprite(hue: float, saturation: float, value: float) -> bool:
    return (
        green_sprite(hue, saturation, value)
        or (8 <= hue < 65 and saturation > 0.38 and value > 0.30)
        or (value > 0.80 and saturation < 0.28)
    )


def pale_animal(hue: float, saturation: float, value: float) -> bool:
    return (
        (value > 0.55 and saturation < 0.36)
        or (10 <= hue < 58 and 0.10 < saturation < 0.74 and value > 0.18)
        or (hue > 330 and saturation > 0.22 and value > 0.30)
    )


def bubble_sprite(hue: float, saturation: float, value: float) -> bool:
    return (165 <= hue <= 235 and value > 0.62) or (value > 0.82 and saturation < 0.30)


def build(output_dir: Path, aquarium_bg: Path, garden_bg: Path, pasture_bg: Path) -> None:
    public = output_dir / "public" / "assets"
    client = output_dir / "src" / "plugin" / "client" / "assets"

    build_table_extension(public / "scene-base.png", public / "ecosystem-table-extension.png")

    backgrounds = {
        "ecosystem-aquarium-background-v2.png": (aquarium_bg, (180, 80, 1350, 860)),
        "ecosystem-garden-background-v2.png": (garden_bg, (145, 90, 1375, 910)),
        "ecosystem-pasture-background-v2.png": (pasture_bg, (185, 100, 1385, 900)),
    }
    for filename, (source, box) in backgrounds.items():
        crop_background(source, box, public / filename)

    with Image.open(public / "ecosystem-aquarium.png") as aquarium:
        aquarium = aquarium.convert("RGBA")
        extract_sprite(aquarium, (88, 128, 166, 193), public / "ecosystem-fish-gold.png", warm_sprite, dilation=3, remove_border=False, keep_largest=True)
        extract_sprite(aquarium, (181, 103, 264, 174), public / "ecosystem-fish-pearl.png", warm_sprite, dilation=3, remove_border=False, keep_largest=True)
        extract_sprite(
            aquarium,
            (242, 134, 337, 198),
            public / "ecosystem-fish-stripe.png",
            warm_sprite,
            dilation=3,
            remove_border=False,
            keep_largest=True,
            erase_boxes=((62, 52, 95, 64),),
        )
        extract_sprite(
            aquarium,
            (315, 105, 392, 236),
            public / "ecosystem-water-plant.png",
            green_sprite,
            dilation=3,
            remove_border=False,
            keep_largest=True,
        )
        extract_sprite(aquarium, (306, 88, 350, 133), public / "ecosystem-bubbles.png", bubble_sprite, dilation=3)

    with Image.open(public / "ecosystem-garden.png") as garden:
        garden = garden.convert("RGBA")
        extract_sprite(garden, (70, 79, 99, 148), public / "ecosystem-crop-carrot.png", green_orange_sprite, dilation=3, remove_border=False, keep_largest=True)
        extract_sprite(
            garden,
            (184, 24, 257, 145),
            public / "ecosystem-crop-tomato.png",
            tomato_sprite,
            dilation=3,
            remove_border=False,
            erase_boxes=((0, 112, 73, 121), (68, 0, 73, 121)),
        )
        extract_sprite(garden, (292, 64, 396, 147), public / "ecosystem-crop-cabbage.png", green_sprite, dilation=3, remove_border=False, keep_largest=True)
        extract_sprite(garden, (331, 151, 394, 243), public / "ecosystem-crop-onion.png", green_sprite, dilation=3, remove_border=False, keep_largest=True)
        extract_sprite(
            garden,
            (174, 148, 276, 247),
            public / "ecosystem-crop-pumpkin.png",
            green_orange_sprite,
            dilation=3,
            remove_border=False,
            keep_largest=True,
            erase_boxes=((80, 52, 102, 99),),
        )
        extract_sprite(garden, (56, 164, 160, 247), public / "ecosystem-crop-leafy.png", green_sprite, dilation=3, remove_border=False, keep_largest=True)

    with Image.open(public / "ecosystem-animals.png") as pasture:
        pasture = pasture.convert("RGBA")
        extract_sprite(pasture, (130, 126, 178, 190), public / "ecosystem-animal-chick.png", chick_sprite, dilation=3, remove_border=False, keep_largest=True)
        extract_sprite(pasture, (191, 109, 292, 203), public / "ecosystem-animal-rabbit.png", pale_animal, dilation=3, remove_border=False, keep_largest=True)
        extract_sprite(pasture, (271, 50, 383, 216), public / "ecosystem-animal-alpaca.png", pale_animal, dilation=3, remove_border=False, keep_largest=True)

    for source in public.glob("ecosystem-*-v2.png"):
        (client / source.name).write_bytes(source.read_bytes())
    for source in public.glob("ecosystem-fish-*.png"):
        (client / source.name).write_bytes(source.read_bytes())
    for source in public.glob("ecosystem-water-*.png"):
        (client / source.name).write_bytes(source.read_bytes())
    for source in public.glob("ecosystem-bubbles.png"):
        (client / source.name).write_bytes(source.read_bytes())
    for source in public.glob("ecosystem-crop-*.png"):
        (client / source.name).write_bytes(source.read_bytes())
    for source in public.glob("ecosystem-animal-*.png"):
        (client / source.name).write_bytes(source.read_bytes())
    (client / "ecosystem-table-extension.png").write_bytes(
        (public / "ecosystem-table-extension.png").read_bytes()
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path, required=True)
    parser.add_argument("--aquarium-background", type=Path, required=True)
    parser.add_argument("--garden-background", type=Path, required=True)
    parser.add_argument("--pasture-background", type=Path, required=True)
    args = parser.parse_args()
    build(
        args.project,
        args.aquarium_background,
        args.garden_background,
        args.pasture_background,
    )


if __name__ == "__main__":
    main()
