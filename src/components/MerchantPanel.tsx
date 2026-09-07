import { useEffect, useRef, useState } from "react";
import type { GameState } from "../domain/types";
import { worldView, WORLD_TIME_RATE } from "../ecosystem/world-clock";
import { getMerchantView, getMerchantSaleQuote } from "../ecosystem/merchant";
import { PanelHeader } from "./CollectionPanel";
import { ItemPortrait } from "./ItemPortrait";
import type { EcosystemAssetUrls } from "./EcosystemScene";

type Tab = "calendar" | "buy" | "sell";
type SaleHabitat = "garden" | "animals";
const TABS = [{id:"calendar",label:"日历"},{id:"buy",label:"买入"},{id:"sell",label:"出售"}] as const;
const ERRORS: Record<string,string> = {
  "merchant-away":"商人已经收摊，下次来访时再交易吧。", "stale-visit":"这份货单已经过期，请按当前货单重新选择。",
  "out-of-stock":"这件货品本次已售罄，下次来访会补货。", "trade-limit":"这批收成超过商人剩余收购额度。可以普通收获，或等下次来访。",
  "insufficient-coins":"硬币不足，交易没有扣款。", "already-owned":"已经拥有这个居民或种子。", "inventory-full":"补给没有足够空间，交易没有扣款。",
  "nothing-to-harvest":"没有可以出售的成熟收成。", "revision-conflict":"庄园状态刚更新，请核对货单后再试一次。",
  "locked-spin-reward":"这个物品正在老虎机结算中，请稍后再买。", "invalid-state":"庄园状态暂时无法交易，请重新连接。",
};

export function MerchantPanel({open,state,disabled,error,onClose,onBuy,onSell,assetUrls,initialTab="calendar"}: {
  open:boolean; state:GameState; disabled:boolean; error:string|null; onClose():void;
  onBuy(itemId:string,visitId:string):void; onSell(habitat:SaleHabitat,visitId:string):void;
  assetUrls?:Partial<EcosystemAssetUrls>; initialTab?:Tab;
}) {
  const [tab,setTab]=useState<Tab>(initialTab);
  const [pendingSale,setPendingSale]=useState<{habitat:SaleHabitat;signature:string}|null>(null);
  const ref=useRef<HTMLElement>(null);
  const closeRef=useRef(onClose); closeRef.current=onClose;
  useEffect(()=> {setTab(initialTab);setPendingSale(null);},[open,initialTab]);
  useEffect(()=> {
    if (!open) return;
    const opener=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const escape=(event:KeyboardEvent)=> {if(event.key === "Escape") {event.stopPropagation();closeRef.current();}};
    document.addEventListener("keydown",escape);
    return ()=> {document.removeEventListener("keydown",escape);if(opener?.isConnected) opener.focus();};
  },[open]);
  if(!open) return null;
  const clock=worldView(state.ecosystem.world);
  const merchant=getMerchantView(state.ecosystem);
  const time=`${String(clock.hour).padStart(2,"0")}:${String(clock.minute).padStart(2,"0")}`;
  return <section ref={ref} className="utility-panel merchant-panel" data-tab={tab} role="dialog" aria-label="庄园日历与旅行商人">
    <PanelHeader title="庄园日历" closeLabel="合上庄园日历" onClose={onClose}/>
    <div className="merchant-summary">
      <div className="merchant-calendar-day"><small>庄园历</small><strong>{clock.day}</strong><span>天</span></div>
      <div className="merchant-summary__body"><strong>{time} <span>{clock.hour>=20 || clock.hour<5 ? "夜深了" : clock.hour<8 ? "晨光初起" : clock.hour<17 ? "白日时光" : "日暮将至"}</span></strong>
        <p>现实 1 分钟 = 庄园 {WORLD_TIME_RATE} 分钟</p><small>现实 48 分钟，庄园走过一天</small></div>
    </div>
    <nav className="journal-tabs" aria-label="日历章节">{TABS.map(item=><button type="button" key={item.id} aria-pressed={tab===item.id} onClick={()=>{setTab(item.id);setPendingSale(null);}}>{item.label}</button>)}</nav>
    <div className="merchant-visit" data-present={merchant.present}>
      <span className="merchant-visit__seal" aria-hidden="true">✦</span>
      <div><strong>{merchant.present ? "旅行商人 · 正在摆摊" : "旅行商人 · 还在路上"}</strong>
        <p>{merchant.present ? `今天 20:00 收摊 · 已收购 ${merchant.soldCount} / ${merchant.sellLimit} 份` : `预计第 ${merchant.nextArrivalDay} 天 08:00 来访`}</p></div>
    </div>
    {tab === "calendar" ? <div className="merchant-calendar-details">
      <div className="merchant-day-strip" aria-label="庄园未来五日">{Array.from({length:5},(_,i)=>clock.day+i).map(day=><div key={day} data-today={day===clock.day} data-arrival={day===(merchant.present ? merchant.arrivalDay : merchant.nextArrivalDay)}><span>第 {day} 天</span><strong>{day===(merchant.present ? merchant.arrivalDay : merchant.nextArrivalDay) ? "商人" : day===clock.day ? "今天" : "·"}</strong></div>)}</div>
      <p>商人每 3 天选择一天来访，08:00 开市，20:00 离开。每次货品和库存固定，不会因为重开窗口改变。</p>
      <dl className="merchant-rules"><div><dt>庄园昼夜</dt><dd>跟着庄园时钟变化，植物与动物也按游戏时间成长。</dd></div><div><dt>离线回来</dt><dd>时钟最多补算现实 24 小时。重启延续天数，系统时间回退不会倒退。</dd></div><div><dt>工作奖励</dt><dd>Token 奖励的每日上限仍按现实日期，不随游戏加速。</dd></div></dl>
      <button type="button" className="pixel-button merchant-primary" onClick={()=>setTab("buy")}>{merchant.present ? "看看商人的货物" : "查看下次货单"}</button>
    </div> : tab === "buy" ? <>
      <div className="merchant-wallet"><span>现有硬币 <strong>{state.wallet}</strong></span><small>{merchant.present ? "本次货单" : "预告货单 · 到访后开放"}</small></div>
      <ul className="merchant-offers">{merchant.offers.map(offer=> {
        const blocked=disabled || !merchant.present || offer.remaining===0 || offer.owned || state.wallet<offer.price;
        return <li key={offer.itemId}>
          {offer.kind === "resident" ? <ItemPortrait itemId={offer.itemId} assetUrls={assetUrls} size={36}/> : <span className="merchant-supply-mark" aria-hidden="true">{offer.habitat==="aquarium" ? "鱼" : offer.habitat==="garden" ? "肥" : "粮"}</span>}
          <div className="merchant-offer__body"><strong>{offer.name}{offer.quantity>1 ? ` ×${offer.quantity}` : ""}</strong><small>{offer.owned ? "已经拥有" : `余 ${offer.remaining} / ${offer.limit} ${offer.kind==="supply" ? "包" : "份"}`}</small></div>
          <button type="button" className="pixel-button" aria-label={`向商人购买 ${offer.name}`} disabled={blocked} onClick={()=>{if(merchant.visitId) onBuy(offer.itemId,merchant.visitId);}}>{offer.owned ? "已拥有" : offer.remaining===0 ? "售罄" : `${offer.price} 枚`}</button>
        </li>;
      })}</ul><p className="merchant-fineprint">补给每包 3 份。种子和居民购买后永久解锁；住进庄园后仍需照料成长。</p>
    </> : <>
      <p className="merchant-fineprint">商人只收当前未收获的成熟蔬菜、鸡蛋，每份比普通收获多 1 枚。累计历史不能重复出售，不出售活体居民。</p>
      {(["garden","animals"] as const).map(habitat=> {
        const quote=getMerchantSaleQuote(state.ecosystem,habitat);
        const label=habitat==="garden" ? "菜园成熟收成" : "牧场鸡蛋";
        const signature=`${merchant.visitId}:${merchant.present}:${quote.quantity}:${quote.totalCoins}:${quote.remainingQuota}`;
        const confirming=pendingSale?.habitat===habitat && pendingSale.signature===signature && merchant.present;
        const blocked=disabled || !merchant.present || quote.quantity===0 || !quote.withinLimit;
        return <div className="merchant-sale" key={habitat}>
          <strong>{label}<span>{quote.quantity} 份</span></strong>
          <p>{quote.collected.length ? quote.collected.map(item=>`${item.name} ×${item.count}`).join("、") : "尚无成熟产物，照料之后再来看看。"}</p>
          <small>收购价 {quote.totalCoins} 枚{quote.quantity ? `（含加价 ${quote.bonusCoins} 枚）` : ""} · 本次剩余额度 {quote.remainingQuota} 份</small>
          {confirming ? <div className="merchant-sale__confirm"><span>确认收走以上产物？出售后不能再普通收获。</span><button type="button" className="pixel-button" disabled={blocked} onClick={()=>{if(merchant.visitId) onSell(habitat,merchant.visitId);setPendingSale(null);}}>确认出售 · {quote.totalCoins} 枚</button><button type="button" className="merchant-cancel" onClick={()=>setPendingSale(null)}>暂不出售</button></div>
            : <button type="button" className="pixel-button" aria-label={`出售${label}`} disabled={blocked} onClick={()=>setPendingSale({habitat,signature})}>{quote.quantity ? `出售 · ${quote.totalCoins} 枚` : "等待收成"}</button>}
          {quote.quantity>0 && !quote.withinLimit ? <p className="merchant-fineprint">本批超过剩余额度，可普通收获或等下次来访。</p> : null}
        </div>;
      })}
    </>}
    {error ? <p className="journal-error" role="alert">{ERRORS[error] ?? "交易暂未完成，请检查连接后再试。"}</p> : null}
  </section>;
}
