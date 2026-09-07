import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createInitialState } from "../domain/types";
import { getMerchantView } from "../ecosystem/merchant";
import { MerchantPanel } from "./MerchantPanel";
afterEach(cleanup);
function setup(present = false) {
  const state = createInitialState();
  state.wallet = 50;
  state.ecosystem.world = { elapsedMs:0,lastRealAt:"2026-09-07T00:00:00.000Z",seed:42 };
  if (present) {
    const day = getMerchantView(state.ecosystem).nextArrivalDay;
    state.ecosystem.world.elapsedMs = ((day-1)*24+2)*3600000;
  }
  return {open:true,state,disabled:false,error:null,onClose:vi.fn(),onBuy:vi.fn(),onSell:vi.fn()};
}
describe("庄园日历与商人", () => {
  it("keeps unavailable purchases disabled and restores focus on escape", () => {
    const props=setup(true);
    const {rerender}=render(<><button>日历入口</button><MerchantPanel {...props} open={false}/></>);
    screen.getByRole("button",{name:"日历入口"}).focus();
    rerender(<><button>日历入口</button><MerchantPanel {...props} disabled initialTab="buy" error="inventory-full"/></>);
    for(const button of screen.getAllByRole("button",{name:/向商人购买/})) expect(button).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("交易没有扣款");
    fireEvent.keyDown(document,{key:"Escape"});
    expect(props.onClose).toHaveBeenCalledOnce();
    rerender(<><button>日历入口</button><MerchantPanel {...props} open={false}/></>);
    expect(screen.getByRole("button",{name:"日历入口"})).toHaveFocus();
  });
  it("explains rate, arrivals and offline behavior without a permanent large panel", () => {
    const props=setup();
    const {rerender}=render(<MerchantPanel {...props} />);
    expect(screen.getByRole("dialog", {name:"庄园日历与旅行商人"})).toBeVisible();
    expect(screen.getByText(/现实 48 分钟/)).toBeVisible();
    expect(screen.getByText(/24 小时/)).toBeVisible();
    expect(screen.getByText(/还在路上/)).toBeVisible();
    rerender(<MerchantPanel {...props} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("buys only a catalog offer with its displayed visit id", () => {
    const props=setup(true);
    const view=getMerchantView(props.state.ecosystem);
    render(<MerchantPanel {...props} initialTab="buy" />);
    const offer=view.offers.find(item=>item.kind === "supply")!;
    fireEvent.click(screen.getByRole("button", {name:`向商人购买 ${offer.name}`}));
    expect(props.onBuy).toHaveBeenCalledWith(offer.itemId,view.visitId);
  });
  it("quotes mature crops and requires confirmation before selling", () => {
    const props=setup(true);
    props.state.ecosystem.lifecycle.plots["1"].growth=100;
    props.state.ecosystem.lifecycle.plots["1"].readyYield=1;
    render(<MerchantPanel {...props} initialTab="sell" />);
    fireEvent.click(screen.getByRole("button", {name:"出售菜园成熟收成"}));
    expect(props.onSell).not.toHaveBeenCalled();
    expect(screen.getByRole("button",{name:/确认出售.*4 枚/})).toBeVisible();
    fireEvent.click(screen.getByRole("button",{name:/确认出售.*4 枚/}));
    expect(props.onSell).toHaveBeenCalledWith("garden",getMerchantView(props.state.ecosystem).visitId);
  });
  it("departure cancels a pending sale and disables trading", () => {
    const props=setup(true);
    props.state.ecosystem.lifecycle.plots["1"].growth=100;
    props.state.ecosystem.lifecycle.plots["1"].readyYield=1;
    const {rerender}=render(<MerchantPanel {...props} initialTab="sell" />);
    fireEvent.click(screen.getByRole("button",{name:"出售菜园成熟收成"}));
    const state=structuredClone(props.state); state.ecosystem.world!.elapsedMs+=12*3600000;
    rerender(<MerchantPanel {...props} state={state} initialTab="sell" />);
    expect(screen.queryByRole("button",{name:/确认出售/})).not.toBeInTheDocument();
    expect(screen.getByRole("button",{name:"出售菜园成熟收成"})).toBeDisabled();
  });
});
