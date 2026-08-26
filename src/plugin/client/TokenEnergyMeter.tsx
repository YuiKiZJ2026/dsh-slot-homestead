export interface TokenEnergyMeterProps {
  progress: number;
  dailyCoins: number;
}

const numberFormat = new Intl.NumberFormat("en-US");

export function TokenEnergyMeter({ progress, dailyCoins }: TokenEnergyMeterProps) {
  return (
    <div className="token-energy-meter">
      <label className="token-energy-meter__label">
        <span>Token 能量：{numberFormat.format(progress)} / 3,000</span>
        <progress
          value={progress}
          max={3_000}
          aria-label="Token 能量进度"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={3_000}
        />
      </label>
      <span className="token-energy-meter__daily">今日 Token 奖励：{dailyCoins} / 8</span>
    </div>
  );
}
