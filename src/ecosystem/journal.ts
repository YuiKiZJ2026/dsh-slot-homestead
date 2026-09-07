import { z } from "zod";
import type { EcosystemState, GameState, HabitatId, HomesteadJournal } from "../domain/types";
import { localDateKey } from "../time/clock";
import { worldDate } from "./world-clock";

export const DAILY_QUEST_IDS = ["daily-care", "daily-round", "daily-harvest"] as const;
export const MILESTONE_IDS = ["first-adult", "green-fingers", "new-neighbors", "full-table", "harvest-ten"] as const;
const unique = <T extends string>(values: T[]) => new Set(values).size === values.length;
export const journalSchema: z.ZodType<HomesteadJournal> = z.object({
  day: z.iso.date(),
  care: z.array(z.enum(["aquarium", "garden", "animals"])).max(3).refine(unique),
  harvests: z.number().int().min(0).max(3),
  dailyClaimed: z.array(z.enum(DAILY_QUEST_IDS)).max(3).refine(unique),
  milestonesClaimed: z.array(z.enum(MILESTONE_IDS)).max(5).refine(unique),
  xp: z.number().int().min(0).max(1_000_000),
}).strict();

export interface JournalQuest {
  id: string; title: string; description: string; progress: number; target: number;
  xp: number; coins: number; supplies: Partial<EcosystemState["supplies"]>;
  claimed: boolean; daily: boolean;
}

export function journalForDay(ecosystem: EcosystemState, now: Date): HomesteadJournal {
  const today = journalDateKey(ecosystem, now);
  const existing = ecosystem.journal;
  if (existing && today <= existing.day) return structuredClone(existing);
  return { day: today, care: [], harvests: 0, dailyClaimed: [],
    milestonesClaimed: [...(existing?.milestonesClaimed ?? [])], xp: existing?.xp ?? 0 };
}

export function recordJournalCare(ecosystem: EcosystemState, habitat: HabitatId, now: Date): EcosystemState {
  const journal = journalForDay(ecosystem, now);
  if (journal.day !== journalDateKey(ecosystem, now)) return ecosystem;
  if (!journal.care.includes(habitat)) journal.care.push(habitat);
  return { ...ecosystem, journal };
}

export function recordJournalHarvest(ecosystem: EcosystemState, count: number, now: Date): EcosystemState {
  const journal = journalForDay(ecosystem, now);
  if (journal.day !== journalDateKey(ecosystem, now) || !Number.isSafeInteger(count) || count <= 0) return ecosystem;
  journal.harvests = Math.min(3, journal.harvests + count);
  return { ...ecosystem, journal };
}

export function getJournalQuests(state: GameState, now: Date): JournalQuest[] {
  const { ecosystem } = state;
  const journal = journalForDay(ecosystem, now);
  const harvested = Object.values(ecosystem.lifecycle.produce).reduce((sum, count) => sum + count, 0);
  const definitions = [
    { id: "daily-care", title: "给小邻居的早餐", description: "照料任意一处生态", progress: journal.care.length, target: 1, xp: 10, coins: 0, supplies: { fishFeed: 1 } },
    { id: "daily-round", title: "庄园巡游", description: "分别照料鱼缸、种植园和牧场", progress: journal.care.length, target: 3, xp: 20, coins: 3, supplies: {} },
    { id: "daily-harvest", title: "今天也有好收成", description: "收获 3 份蔬菜或鸡蛋", progress: journal.harvests, target: 3, xp: 15, coins: 0, supplies: { fertilizer: 2, animalFeed: 1 } },
    { id: "first-adult", title: "第一次长大", description: "养大一条鱼", progress: Object.values(ecosystem.lifecycle.fish).filter(f => f.growth >= 100).length, target: 1, xp: 30, coins: 3, supplies: { fishFeed: 2 } },
    { id: "green-fingers", title: "多彩菜园", description: "同时种下三种不同作物", progress: new Set(Object.values(ecosystem.lifecycle.plots).flatMap(p => p.seedId ? [p.seedId] : [])).size, target: 3, xp: 40, coins: 4, supplies: { fertilizer: 3 } },
    { id: "new-neighbors", title: "越来越热闹", description: "发现 6 种生态居民或种子", progress: ecosystem.discovered.length, target: 6, xp: 40, coins: 4, supplies: { animalFeed: 2 } },
    { id: "full-table", title: "慢慢变成家的样子", description: "拥有 6 件桌面收藏", progress: state.ownedCollectibles.length, target: 6, xp: 50, coins: 5, supplies: {} },
    { id: "harvest-ten", title: "装满第一只篮子", description: "累计收获 10 份产物", progress: harvested, target: 10, xp: 50, coins: 5, supplies: { fertilizer: 2 } },
  ];
  return definitions.map((quest, index) => ({ ...quest,
    progress: Math.min(quest.progress, quest.target), daily: index < 3,
    claimed: (index < 3 ? journal.dailyClaimed : journal.milestonesClaimed).includes(quest.id),
  }));
}

export function claimJournalReward(state: GameState, questId: string, now: Date):
  { ok: true; state: GameState } | { ok: false; reason: "quest-unavailable" | "clock-skew" } {
  const journal = journalForDay(state.ecosystem, now);
  if (journal.day !== journalDateKey(state.ecosystem, now)) return { ok: false, reason: "clock-skew" };
  const quest = getJournalQuests(state, now).find(q => q.id === questId);
  if (!quest || quest.claimed || quest.progress < quest.target) return { ok: false, reason: "quest-unavailable" };
  (quest.daily ? journal.dailyClaimed : journal.milestonesClaimed).push(quest.id);
  journal.xp = Math.min(1_000_000, journal.xp + quest.xp);
  const supplies = { ...state.ecosystem.supplies };
  for (const key of ["fishFeed", "fertilizer", "animalFeed"] as const) {
    supplies[key] = Math.min(999, supplies[key] + (quest.supplies[key] ?? 0));
  }
  return { ok: true, state: { ...state, wallet: state.wallet + quest.coins,
    ecosystem: { ...state.ecosystem, supplies, journal } } };
}

export function manorRank(xp: number): { level: number; title: string; progress: number; next: number | null } {
  const ranks = [{ xp: 0, title: "初来庄园" }, { xp: 50, title: "小小园丁" }, { xp: 150, title: "熟练庄主" },
    { xp: 350, title: "生态伙伴" }, { xp: 700, title: "繁盛家园" }, { xp: 1200, title: "庄园守护者" }];
  let index = ranks.length - 1;
  while (index > 0 && xp < ranks[index].xp) index--;
  const next = ranks[index + 1]?.xp ?? null;
  return { level: index + 1, title: ranks[index].title, progress: next === null ? 100 :
    Math.max(0, Math.min(100, (xp - ranks[index].xp) / (next - ranks[index].xp) * 100)), next };
}

export function journalDateKey(ecosystem: EcosystemState, now: Date): string {
  return ecosystem.world ? worldDate(ecosystem.world).toISOString().slice(0, 10) : localDateKey(now);
}
