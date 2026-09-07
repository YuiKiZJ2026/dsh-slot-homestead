import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ECOSYSTEM_RESIDENTS } from "../ecosystem/catalog";
import { ItemPortrait } from "./ItemPortrait";

afterEach(cleanup);

describe("ItemPortrait", () => {
  it("maps every resident to its own mature atlas cell without stretching or flipping", () => {
    const { container } = render(<>{ECOSYSTEM_RESIDENTS.map(item => <ItemPortrait key={item.id} itemId={item.id} />)}</>);
    expect(container.querySelectorAll("[data-item-portrait]")).toHaveLength(12);
    expect(container.querySelector("[data-item-portrait=goldfish]")).toHaveAttribute("data-sprite-cell", "0:3");
    expect(container.querySelector("[data-item-portrait=moon-carp]")).toHaveAttribute("data-sprite-cell", "2:3");
    expect(container.querySelector("[data-item-portrait=onion-seed]")).toHaveAttribute("data-sprite-cell", "5:3");
    expect(container.querySelector("[data-item-portrait=alpaca]")).toHaveAttribute("data-sprite-cell", "2:2");
    expect(container.querySelector("[data-item-portrait=goldfish]")).toHaveStyle({ imageRendering: "pixelated", backgroundSize: "400% 300%", backgroundPosition: "100% 0%" });
  });

  it("can describe a custom lifecycle frame and use a host-resolved URL", () => {
    const { rerender } = render(<ItemPortrait itemId="carrot-seed" frame={0} size={40} label="一号田，胡萝卜萌芽" decorative={false} assetUrls={{ cropCarrot: "/resolved/carrot.svg" }} />);
    expect(screen.getByRole("img", { name: "一号田，胡萝卜萌芽" })).toHaveAttribute("data-sprite-cell", "0:0");
    expect(screen.getByRole("img")).toHaveStyle({ width: "40px", height: "40px", backgroundImage: 'url("/resolved/carrot.svg")' });
    rerender(<ItemPortrait itemId="chick" decorative={false} frame={999} />);
    expect(screen.getByRole("img", { name: "小鸡" })).toHaveAttribute("data-sprite-cell", "0:2");
    rerender(<ItemPortrait itemId="rabbit" decorative={false} frame={Number.NaN} />);
    expect(screen.getByRole("img", { name: "垂耳兔" })).toHaveAttribute("data-sprite-cell", "1:2");
  });

  it("does not invent a portrait for an unsupported item", () => {
    const { container } = render(<ItemPortrait itemId="not-a-resident" />);
    expect(container).toBeEmptyDOMElement();
  });
});
