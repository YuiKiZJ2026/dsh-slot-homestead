import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import type { AgentStatus, GameState } from "../domain/types";
import type { DshEvent } from "../dsh/events";
import type { OutcomeKind } from "../game/outcomes";

export interface DemoPanelProps {
  open: boolean;
  onClose(): void;
  onCompleteTask(): string;
  onVerifyTask(taskId: string): void;
  onAddFocusHour(): void;
  onSetStatus(status: AgentStatus): void;
  onAdvanceDay(): void;
  onReset(): void;
  onPresetNextOutcome?(outcome: OutcomeKind): void;
  stateSummary?: string;
  state?: GameState;
  dailyWorkCoins?: number;
  focusCoins?: number;
  focusMinutes?: number;
  pityMisses?: number;
  lastEvent?: DshEvent | null;
  mode?: "writer" | "readonly" | "unsupported";
}

const STATUS_ACTIONS: ReadonlyArray<{ label: string; status: AgentStatus }> = [
  { label: "状态：空闲", status: "idle" },
  { label: "状态：工作中", status: "working" },
  { label: "状态：完成", status: "completed" },
  { label: "状态：报错", status: "error" },
];

const OUTCOME_PRESET_LABEL = import.meta.env.DEV ? "预设下次结果" : "";
const OUTCOME_PRESETS: ReadonlyArray<{ value: "auto" | OutcomeKind; label: string }> =
  import.meta.env.DEV
    ? [
        { value: "auto", label: "自动" },
        { value: "none", label: "无奖励" },
        { value: "refund", label: "返还 1 枚" },
        { value: "five-coins", label: "获得 5 枚" },
        { value: "common", label: "普通收藏品" },
        { value: "rare", label: "稀有收藏品" },
        { value: "set", label: "套装收藏品" },
        { value: "robot-jackpot", label: "机器人大奖" },
      ]
    : [];

export function DemoPanel({
  open,
  onClose,
  onCompleteTask,
  onVerifyTask,
  onAddFocusHour,
  onSetStatus,
  onAdvanceDay,
  onReset,
  onPresetNextOutcome,
  stateSummary,
  state,
  dailyWorkCoins,
  focusCoins,
  focusMinutes,
  pityMisses,
  lastEvent = null,
  mode = "writer",
}: DemoPanelProps) {
  const [latestTaskId, setLatestTaskId] = useState<string | null>(null);
  const [outcomePreset, setOutcomePreset] = useState<"auto" | OutcomeKind>("auto");
  const [confirmingReset, setConfirmingReset] = useState(false);
  const resetTriggerRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const restoreResetFocusRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setConfirmingReset(false);
    }
  }, [open]);

  useEffect(() => {
    if (confirmingReset) {
      restoreResetFocusRef.current = true;
      confirmButtonRef.current?.focus();
      return;
    }

    if (restoreResetFocusRef.current) {
      if (open) {
        resetTriggerRef.current?.focus();
      }
      restoreResetFocusRef.current = false;
    }
  }, [confirmingReset, open]);

  if (!open) {
    return null;
  }

  const ledger = state?.lastAwardDate === null || state?.lastAwardDate === undefined
    ? undefined
    : state.dailyLedgers[state.lastAwardDate];
  const walletText = state === undefined ? (stateSummary ?? "0 枚") : `${state.wallet} 枚`;
  const shownWorkCoins = dailyWorkCoins ?? ledger?.workCoins ?? 0;
  const shownFocusCoins = focusCoins ?? ledger?.focusCoins ?? 0;
  const shownFocusMinutes = focusMinutes ?? ledger?.focusMinutes ?? 0;
  const shownPityMisses = pityMisses ?? state?.pityMisses ?? 0;
  const shownLastEvent = lastEvent === null ? "无" : `${lastEvent.type} · ${lastEvent.id}`;

  const completeTask = (): void => {
    setLatestTaskId(onCompleteTask());
  };
  const verifyLatestTask = (): void => {
    if (latestTaskId !== null) {
      onVerifyTask(latestTaskId);
    }
  };
  const confirmReset = (): void => {
    setLatestTaskId(null);
    setConfirmingReset(false);
    onReset();
  };
  const closePanel = (): void => {
    setConfirmingReset(false);
    onClose();
  };
  const cancelReset = (): void => {
    setConfirmingReset(false);
  };
  const handleConfirmationKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelReset();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    if (event.shiftKey && document.activeElement === confirmButtonRef.current) {
      event.preventDefault();
      cancelButtonRef.current?.focus();
    } else if (!event.shiftKey && document.activeElement === cancelButtonRef.current) {
      event.preventDefault();
      confirmButtonRef.current?.focus();
    }
  };
  const selectOutcomePreset = (event: ChangeEvent<HTMLSelectElement>): void => {
    const outcome = event.target.value as "auto" | OutcomeKind;
    if (outcome !== "auto") {
      onPresetNextOutcome?.(outcome);
    }
    setOutcomePreset("auto");
  };

  return (
    <section role="dialog" aria-label="DSH 演示控制台" aria-modal="false">
      <div inert={confirmingReset} aria-hidden={confirmingReset ? true : undefined}>
        <header>
          <h2>DSH 演示控制台</h2>
          <button
            type="button"
            onClick={closePanel}
            aria-label="关闭演示控制台"
            disabled={confirmingReset}
          >×</button>
        </header>

        <dl aria-label="原型状态">
          <div><dt>钱包</dt><dd>钱包：{walletText}</dd></div>
          <div><dt>每日工作币</dt><dd>每日工作币：{shownWorkCoins} / 25</dd></div>
          <div><dt>专注奖励币</dt><dd>专注奖励币：{shownFocusCoins} / 16</dd></div>
          <div><dt>有效专注</dt><dd>有效专注：{shownFocusMinutes} 分钟</dd></div>
          <div><dt>保底未命中</dt><dd>保底未命中：{shownPityMisses}</dd></div>
          <div><dt>最后事件</dt><dd>最后事件：{shownLastEvent}</dd></div>
          <div><dt>写入模式</dt><dd>写入模式：{mode}</dd></div>
        </dl>

        <div>
          <button type="button" onClick={completeTask} disabled={confirmingReset}>完成一个任务</button>
          <button
            type="button"
            onClick={verifyLatestTask}
            disabled={confirmingReset || latestTaskId === null}
          >验证最近任务</button>
          <button type="button" onClick={onAddFocusHour} disabled={confirmingReset}>
            增加 60 分钟有效专注
          </button>
        </div>

        {!import.meta.env.DEV || onPresetNextOutcome === undefined ? null : (
          <select
            aria-label={OUTCOME_PRESET_LABEL}
            value={outcomePreset}
            onChange={selectOutcomePreset}
            disabled={confirmingReset}
          >
            {OUTCOME_PRESETS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        )}

        <div>
          {STATUS_ACTIONS.map(({ label, status }) => (
            <button
              type="button"
              key={status}
              onClick={() => onSetStatus(status)}
              disabled={confirmingReset}
            >{label}</button>
          ))}
        </div>

        <div>
          <button type="button" onClick={onAdvanceDay} disabled={confirmingReset}>进入下一天</button>
          <button
            ref={resetTriggerRef}
            type="button"
            onClick={() => setConfirmingReset(true)}
            disabled={confirmingReset}
          >重置原型存档</button>
        </div>
      </div>

      {confirmingReset ? (
        <div
          role="alertdialog"
          aria-label="确认重置原型存档"
          aria-modal="true"
          onKeyDown={handleConfirmationKeyDown}
        >
          <p>这会清空当前原型进度。确定继续吗？</p>
          <button ref={confirmButtonRef} type="button" onClick={confirmReset}>确认重置原型存档</button>
          <button ref={cancelButtonRef} type="button" onClick={cancelReset}>取消</button>
        </div>
      ) : null}
    </section>
  );
}
