import { ImageResponse } from "next/og";

export const alt = "Undercard: who opens for this room?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Soft graph nodes: position and radius only. No labels, no fake data. */
const NODES: { x: number; y: number; r: number; a: number }[] = [
  { x: 920, y: 140, r: 5, a: 0.45 },
  { x: 1040, y: 180, r: 4, a: 0.35 },
  { x: 980, y: 260, r: 6, a: 0.5 },
  { x: 1080, y: 300, r: 3.5, a: 0.3 },
  { x: 880, y: 320, r: 4.5, a: 0.4 },
  { x: 1000, y: 400, r: 5, a: 0.35 },
  { x: 1100, y: 420, r: 3, a: 0.25 },
  { x: 940, y: 480, r: 4, a: 0.3 },
  { x: 820, y: 200, r: 3, a: 0.25 },
  { x: 1060, y: 500, r: 4, a: 0.28 },
];

const EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 2],
  [2, 3],
  [2, 4],
  [4, 5],
  [3, 5],
  [5, 6],
  [5, 7],
  [0, 8],
  [5, 9],
];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 80px",
          background: "linear-gradient(145deg, #0c0c10 0%, #14121a 55%, #0e1016 100%)",
          color: "#f5f5f7",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
          position: "relative",
        }}
      >
        {/* Taste-graph accent: muted nodes and edges in the upper right */}
        <svg
          width="1200"
          height="630"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          {EDGES.map(([a, b], i) => (
            <line
              key={`e-${i}`}
              x1={NODES[a].x}
              y1={NODES[a].y}
              x2={NODES[b].x}
              y2={NODES[b].y}
              stroke="rgba(232, 160, 74, 0.18)"
              strokeWidth="1.25"
            />
          ))}
          {NODES.map((n, i) => (
            <circle
              key={`n-${i}`}
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={`rgba(232, 160, 74, ${n.a})`}
            />
          ))}
        </svg>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxWidth: 720,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 22,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(232, 160, 74, 0.85)",
              fontWeight: 500,
            }}
          >
            Undercard
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 64,
              lineHeight: 1.12,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#f5f5f7",
            }}
          >
            Who opens for this room?
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              lineHeight: 1.4,
              color: "rgba(245, 245, 247, 0.55)",
              fontWeight: 400,
              maxWidth: 560,
            }}
          >
            Taste-graph openers for one show. Calm, ranked, shareable.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
