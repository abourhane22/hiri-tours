// Chart mensuel : barres colorées par performance vs N-1, tirets N-1,
// deltas %, trajectoire bezier, surlignage mois courant.
// Partagé entre le dashboard et les rapports analytiques.

export type TrendPoint = {
  label: string;
  current: number;
  previous: number;
  isCurrent: boolean;
};

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}

export function PerformanceTrendChart({
  trend,
  previousLabel = "N-1",
}: {
  trend: TrendPoint[];
  previousLabel?: string;
}) {
  const trendMax = Math.max(...trend.flatMap((t) => [t.current, t.previous]), 1);
  const trajectoryPoints = trend
    .map((t, i) => ({
      x: 79 + i * 56,
      y: 230 - (t.current / trendMax) * 180,
      isCurrent: t.isCurrent,
      hasData: t.current > 0,
    }))
    .filter((p) => p.hasData);
  const currentMonthIndex = trend.findIndex((t) => t.isCurrent);
  const considered = trend.filter((t) => t.previous > 0 || t.current > 0);
  const progressingMonths = considered.filter((t) => t.current >= t.previous).length;
  const retreatingMonths = considered.filter((t) => t.current < t.previous).length;
  const maxLabel = trendMax >= 1000 ? `${Math.round(trendMax / 1000)}k` : String(Math.round(trendMax));
  const trajectoryPath = (() => {
    const pts = trajectoryPoints;
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dx = (p2.x - p1.x) * 0.3;
      d += ` C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
    }
    return d;
  })();

  return (
    <div>
      {/* Synthèse + échelle */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 mb-2 text-[12px] text-[#6B6862]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#0C6B8A" }} />
            {progressingMonths} mois en progression
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#D98324" }} />
            {retreatingMonths} mois en retrait
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden>
              <line x1="0" y1="3" x2="18" y2="3" stroke="#968F84" strokeWidth="2" strokeDasharray="4 3" />
            </svg>
            Niveau {previousLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 rounded-full" style={{ background: "#1A1F2E" }} />
            Trajectoire
          </span>
        </div>
        <span className="text-[#968F84]">Échelle max · {maxLabel} MAD</span>
      </div>

      <svg
        viewBox="0 0 760 285"
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Revenu mensuel : performance de chaque mois comparée au même mois de l'année précédente"
      >
        {currentMonthIndex >= 0 && (
          <rect x={47 + currentMonthIndex * 56} y="30" width="64" height="200" fill="#FAECE7" opacity="0.5" rx="6" />
        )}

        <line x1="40" y1="50" x2="720" y2="50" stroke="#F5F5F4" strokeWidth="1" />
        <line x1="40" y1="110" x2="720" y2="110" stroke="#F5F5F4" strokeWidth="1" />
        <line x1="40" y1="170" x2="720" y2="170" stroke="#F5F5F4" strokeWidth="1" />
        <line x1="40" y1="230" x2="720" y2="230" stroke="#E7E5E4" strokeWidth="1" />

        {trend.map((t, i) => {
          const cx = 79 + i * 56;
          const barW = 24;
          const hCur = (t.current / trendMax) * 180;
          const hPrev = (t.previous / trendMax) * 180;
          const bothZero = t.current <= 0 && t.previous <= 0;
          const up = t.previous === 0 ? t.current > 0 : t.current >= t.previous;

          const fill = bothZero ? "#E0DACF" : up ? "#0C6B8A" : "#D98324";
          const barH = bothZero ? 4 : hCur;
          const barY = 230 - barH;
          const prevY = 230 - hPrev;

          let deltaText: string | null = null;
          let deltaColor = "#0C6B8A";
          if (t.previous === 0) {
            if (t.current > 0) deltaText = "new";
          } else {
            const pct = Math.round(((t.current - t.previous) / t.previous) * 100);
            if (pct >= 0) {
              deltaText = `+${pct} %`;
              deltaColor = "#0C6B8A";
            } else {
              deltaText = `−${Math.abs(pct)} %`;
              deltaColor = "#B25F0B";
            }
          }
          const topRef = t.previous > 0 ? Math.min(barY, prevY) : barY;
          const deltaY = Math.max(14, topRef - 6);

          return (
            <g key={i}>
              <rect x={cx - barW / 2} y={barY} width={barW} height={barH} rx="3" fill={fill}>
                <title>
                  {`${t.label} : ${fmt(t.current)} MAD${
                    t.previous > 0 ? ` (${previousLabel} ${fmt(t.previous)} MAD)` : ""
                  }`}
                </title>
              </rect>

              {t.previous > 0 && (
                <line
                  x1={cx - barW / 2 - 4}
                  y1={prevY}
                  x2={cx + barW / 2 + 4}
                  y2={prevY}
                  stroke="#968F84"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
              )}

              {deltaText && (
                <text x={cx} y={deltaY} fontSize="9.5" fontWeight={500} fill={deltaColor} textAnchor="middle">
                  {deltaText}
                </text>
              )}

              <text
                x={cx}
                y="250"
                fontSize="11"
                fill={t.isCurrent ? "#712B13" : "#A8A29E"}
                textAnchor="middle"
                fontWeight={t.isCurrent ? 500 : 400}
              >
                {t.label}
              </text>
              {t.isCurrent && (
                <text x={cx} y="263" fontSize="8.5" fill="#712B13" textAnchor="middle">
                  mois en cours
                </text>
              )}
            </g>
          );
        })}

        {trajectoryPoints.length > 1 && (
          <>
            <path
              d={trajectoryPath}
              fill="none"
              stroke="#1A1F2E"
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {trajectoryPoints.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={p.isCurrent ? 6 : 2.5}
                fill="#1A1F2E"
                stroke={p.isCurrent ? "white" : "none"}
                strokeWidth={p.isCurrent ? 2.5 : 0}
              />
            ))}
          </>
        )}
      </svg>
    </div>
  );
}
