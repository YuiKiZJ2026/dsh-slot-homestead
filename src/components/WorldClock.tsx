import type { EcosystemState } from "../domain/types";
import { worldView } from "../ecosystem/world-clock";
import { getMerchantView } from "../ecosystem/merchant";

export function WorldClock({ ecosystem, open, onOpen }: {
  ecosystem: EcosystemState; open: boolean; onOpen(): void;
}) {
  const clock = worldView(ecosystem.world);
  const merchant = getMerchantView(ecosystem);
  const time = `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`;
  return <button type="button" className="world-clock" data-merchant-present={merchant.present}
    aria-label={`打开庄园日历：第 ${clock.day} 天 ${time}${merchant.present ? "，旅行商人来访" : ""}`}
    aria-expanded={open} onClick={onOpen} title="现实 1 分钟 = 庄园 30 分钟 · 点击查看日历与旅行商人">
    <span className="world-clock__day">第 {clock.day} 天</span><strong>{time}</strong>
    {merchant.present ? <span className="world-clock__visitor">商人来访</span> : null}
  </button>;
}
