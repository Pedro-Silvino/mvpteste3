// SVG ring: the arc length is the score, the color is the maturity band.
export function ScoreRing({ score, color, size = 120, stroke = 12 }: { score: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E1E8ED" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, score)) / 100)}
          style={{ transition: "stroke-dashoffset 900ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-[family-name:var(--font-archivo)] font-extrabold leading-none text-n1" style={{ fontSize: size * 0.3 }}>
            {score}
          </div>
          <div className="mt-0.5 text-[10px] text-muted">de 100</div>
        </div>
      </div>
    </div>
  );
}
