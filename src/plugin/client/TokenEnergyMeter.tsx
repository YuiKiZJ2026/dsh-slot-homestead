export interface TokenEnergyMeterProps {
  progress: number;
  dailyCoins: number;
}

const numberFormat = new Intl.NumberFormat("en-US");

export function TokenEnergyMeter({ progress, dailyCoins }: TokenEnergyMeterProps) {
  return (
    <div className="token-energy-meter">
      <label className="token-energy-meter__label">
        <span>实际 Token：{numberFormat.format(progress)} / 10,000</span>
        <progress
          value={progress}
          max={10_000}
          aria-label="实际 Token 进度"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={10_000}
        />
      </label>
      <span className="token-energy-meter__daily">今日 Token 奖励：{dailyCoins} / 8</span>
    </div>
  );
}
