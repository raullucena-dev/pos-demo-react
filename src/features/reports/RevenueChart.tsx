import { formatShortDay } from "@/lib/dates";
import { formatPYG } from "@/lib/money";

export interface DailyPoint {
  day: string;
  revenue: number;
  salesCount: number;
}

const WIDTH = 1000;
const HEIGHT = 280;
const PAD = { top: 28, right: 12, bottom: 32, left: 12 };

/** Dependency-free SVG bar chart; the same data is exposed as a table for screen readers. */
export function RevenueChart({ points }: { points: DailyPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.revenue));
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(points.length, 1);
  const barW = Math.max(2, slot * 0.7);
  const labelEvery = Math.ceil(points.length / 10);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby="revenue-chart-title revenue-chart-desc"
        className="h-auto w-full"
      >
        <title id="revenue-chart-title">Ingresos por día</title>
        <desc id="revenue-chart-desc">
          Barras con los ingresos diarios del período; el detalle está en la tabla siguiente.
        </desc>
        <text x={PAD.left} y={14} className="fill-muted text-[13px]">
          Máximo: {formatPYG(max)}
        </text>
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={PAD.top}
          y2={PAD.top}
          strokeDasharray="4 4"
          className="stroke-border"
        />
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={PAD.top + innerH}
          y2={PAD.top + innerH}
          className="stroke-border"
        />
        {points.map((point, index) => {
          const h = (point.revenue / max) * innerH;
          const x = PAD.left + index * slot + (slot - barW) / 2;
          return (
            <g key={point.day}>
              <rect
                x={x}
                y={PAD.top + innerH - h}
                width={barW}
                height={h}
                rx={2}
                className="fill-primary"
              >
                <title>{`${formatShortDay(point.day)}: ${formatPYG(point.revenue)} (${point.salesCount} ventas)`}</title>
              </rect>
              {index % labelEvery === 0 && (
                <text
                  x={x + barW / 2}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-muted text-[13px]"
                >
                  {formatShortDay(point.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">
        <table>
          <thead>
            <tr>
              <th>Día</th>
              <th>Ingresos</th>
              <th>Ventas</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.day}>
                <td>{p.day}</td>
                <td>{formatPYG(p.revenue)}</td>
                <td>{p.salesCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
