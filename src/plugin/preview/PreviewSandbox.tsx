import { useRef, useState } from "react";
import type { EcosystemState } from "../../domain/types";
import { getHabitatLifecycleView, getHabitatReadyProduce } from "../../ecosystem/lifecycle";
import {
  animalVisualStageLabel,
  cropVisualStageLabel,
  fishVisualStageLabel,
} from "../../ecosystem/visual-stage";
import { PluginApp } from "../client/PluginApp";
import { InMemoryGameApi } from "./InMemoryGameApi";

const PREVIEW_ASSETS = {
  scene: "/assets/scene-base.png",
  reels: "/assets/reel-symbols-runtime.png",
  collectibles: "/assets/collectibles.png",
};

interface PreviewSandboxState {
  api: InMemoryGameApi;
  version: number;
  refreshToken: number;
}

interface PreviewEcosystemSettlement {
  sequence: number;
  lines: readonly string[];
  note: string;
}

export function PreviewSandbox() {
  const [sandbox, setSandbox] = useState<PreviewSandboxState>(() => createSandbox(0));
  const [status, setStatus] = useState("每个预览页使用独立测试数据");
  const [settlement, setSettlement] = useState<PreviewEcosystemSettlement | null>(null);
  const settlementSequence = useRef(0);

  const refill = (): void => {
    sandbox.api.refillTestResources();
    setSandbox((current) => ({ ...current, refreshToken: current.refreshToken + 1 }));
    setSettlement(null);
    setStatus("测试资源已补满：硬币 99，三类养成资源各 9");
  };
  const advanceEcosystem = (): void => {
    const snapshot = sandbox.api.advanceTestEcosystem(6);
    setSandbox((current) => ({ ...current, refreshToken: current.refreshToken + 1 }));
    settlementSequence.current += 1;
    setSettlement(describeEcosystemSettlement(snapshot.ecosystem, settlementSequence.current));
    const progress = (["aquarium", "garden", "animals"] as const).map((habitat) => (
      Math.round(getHabitatLifecycleView(snapshot.ecosystem, habitat).progress)
    ));
    setStatus(
      `已快进 6 小时：鱼缸 ${progress[0]}% · 种植园 ${progress[1]}% · 牧场 ${progress[2]}%｜成熟与产出已结算`,
    );
  };
  const reset = (): void => {
    settlementSequence.current = 0;
    setSettlement(null);
    setSandbox((current) => createSandbox(current.version + 1));
    setStatus("测试沙盒已恢复初始状态：硬币 8，三类养成资源各 1");
  };

  return (
    <>
      <PreviewSandboxControls
        status={status}
        onRefill={refill}
        onAdvanceEcosystem={advanceEcosystem}
        onReset={reset}
      />
      {settlement === null ? null : (
        <aside
          key={`ecosystem-settlement-${settlement.sequence}`}
          className="preview-ecosystem-settlement"
          data-settlement-sequence={settlement.sequence}
          role="status"
          aria-live="polite"
        >
          <strong className="preview-ecosystem-settlement__title">生态结算 +6 小时</strong>
          <div className="preview-ecosystem-settlement__lines">
            {settlement.lines.map((line) => <span key={line}>{line}</span>)}
          </div>
          <small className="preview-ecosystem-settlement__note">{settlement.note}</small>
        </aside>
      )}
      <PluginApp
        key={`preview-runtime-${sandbox.version}`}
        api={sandbox.api}
        sessionId="native-preview"
        assetUrls={PREVIEW_ASSETS}
        refreshToken={sandbox.refreshToken}
      />
    </>
  );
}

export function PreviewSandboxControls({
  status,
  onRefill,
  onAdvanceEcosystem,
  onReset,
}: {
  status: string;
  onRefill(): void;
  onAdvanceEcosystem(): void;
  onReset(): void;
}) {
  return (
    <section className="preview-sandbox" role="region" aria-label="预览测试沙盒">
      <strong className="preview-sandbox__title">测试沙盒</strong>
      <div className="preview-sandbox__actions">
        <button type="button" onClick={onRefill}>补满测试资源</button>
        <button type="button" onClick={onAdvanceEcosystem}>生态快进 6 小时</button>
        <button type="button" onClick={onReset}>重置测试沙盒</button>
      </div>
      <p className="preview-sandbox__status" role="status" aria-live="polite">{status}</p>
    </section>
  );
}

function createSandbox(version: number): PreviewSandboxState {
  return { api: new InMemoryGameApi(), version, refreshToken: 0 };
}

function describeEcosystemSettlement(
  ecosystem: EcosystemState,
  sequence: number,
): PreviewEcosystemSettlement {
  const aquarium = getHabitatLifecycleView(ecosystem, "aquarium");
  const garden = getHabitatLifecycleView(ecosystem, "garden");
  const animals = getHabitatLifecycleView(ecosystem, "animals");
  const gardenProduce = getHabitatReadyProduce(ecosystem, "garden");
  const animalProduce = getHabitatReadyProduce(ecosystem, "animals");
  const gardenReady = gardenProduce.length > 0;
  const animalsReady = animalProduce.length > 0;
  const allComplete = aquarium.progress >= 100 && gardenReady && animalsReady;

  return {
    sequence,
    lines: [
      aquarium.progress >= 100
        ? "鱼缸：成鱼 · 成长完成"
        : `鱼缸：${fishVisualStageLabel(aquarium.progress)} · 成长 ${Math.round(aquarium.progress)}%`,
      gardenReady
        ? `种植园：成熟 · ${formatReadyProduce(gardenProduce)} · 可收获`
        : `种植园：${cropVisualStageLabel(garden.progress, garden.readyCount)} · 成长 ${Math.round(garden.progress)}%`,
      animalsReady
        ? `牧场：成年 · ${formatReadyProduce(animalProduce)} · 待领取`
        : animals.adults > 0
          ? `牧场：成年 · ${animals.productName ?? "产出"}生产中 ${Math.round(animals.progress)}%`
          : `牧场：${animalVisualStageLabel({
            adults: animals.adults,
            juvenileGrowth: animals.progress,
          })} · 成长 ${Math.round(animals.progress)}%`,
    ],
    note: allComplete
      ? "收获产物或重置沙盒后，可重新观察成长过程"
      : animals.adults > 0
        ? "幼崽已经成年；继续快进可看到产出，场景模型会同步更新"
        : "成长数值与场景模型已同步更新",
  };
}

function formatReadyProduce(
  produce: ReturnType<typeof getHabitatReadyProduce>,
): string {
  return produce.map((item) => `${item.name} ×${item.count}`).join("、");
}
