// Nighttime sketch — dark-mode only.
// Concept: a *toned sketchbook page* (black paper, pale silver pencil). The one
// drawing on the page is a layered mountain ridgeline along the bottom —
// silhouettes receding into haze, each topped by a moonlit ridge stroke that
// draws itself in and then gently "boils" like a living hand-drawn line.
// One calm gesture, anchored low so it never competes with content.
// Pure SVG + CSS (server component); deterministic so SSR/CSR match.

const W = 1600;
const H = 900;

// small deterministic PRNG (mulberry32)
function mkRand(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Layer = {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeOpacity: number;
  strokeWidth: number;
  top: string; // polyline points for the ridge
  area: string; // closed path for the silhouette
  len: number;
  drawDelay: string;
};

// Build one ridge: a sum of a few seeded sine waves so it reads as a natural
// skyline. `peak` biases toward sharper alpine peaks; the roughen filter adds
// the hand-drawn wobble on top.
function buildRidge(
  seed: number,
  baseY: number,
  amp: number,
  peak: number,
  style: Omit<Layer, "top" | "area" | "len">
): Layer {
  const r = mkRand(seed);
  const ph1 = r() * 6.28;
  const ph2 = r() * 6.28;
  const ph3 = r() * 6.28;
  const steps = 52;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (W / steps) * i;
    const t = i / steps;
    const y =
      baseY -
      Math.sin(t * 3.1 + ph1) * amp * 0.5 -
      Math.sin(t * 7.4 + ph2) * amp * (0.26 + peak * 0.2) -
      Math.sin(t * 14.3 + ph3) * amp * (0.13 + peak * 0.22);
    pts.push([x, +y.toFixed(1)]);
  }
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  const top = pts.map((p) => `${p[0]},${p[1]}`).join(" ");
  const area =
    `M0 ${H} ` + pts.map((p) => `L${p[0]} ${p[1]}`).join(" ") + ` L${W} ${H} Z`;
  return { ...style, top, area, len: Math.round(len) };
}

// far (hazy, light) → near (dark, sharp). Atmospheric perspective: distant
// ridges sit lighter/cooler, the near ridge is the darkest silhouette.
const LAYERS: Layer[] = [
  buildRidge(771, 512, 52, 0.1, {
    fill: "rgb(28 28 42)",
    fillOpacity: 0.4,
    stroke: "rgb(176 188 224)",
    strokeOpacity: 0.12,
    strokeWidth: 1,
    drawDelay: "0.3s",
  }),
  buildRidge(305, 604, 78, 0.45, {
    fill: "rgb(14 13 22)",
    fillOpacity: 0.66,
    stroke: "rgb(190 200 232)",
    strokeOpacity: 0.18,
    strokeWidth: 1.1,
    drawDelay: "0.7s",
  }),
  buildRidge(948, 712, 104, 0.85, {
    fill: "rgb(7 6 12)",
    fillOpacity: 0.94,
    stroke: "rgb(205 213 240)",
    strokeOpacity: 0.27,
    strokeWidth: 1.3,
    drawDelay: "1.1s",
  }),
];

export default function NightSketch() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 opacity-0 transition-opacity duration-700 dark:opacity-100"
    >
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMax slice"
        fill="none"
      >
        <defs>
          {/* hand-drawn roughen with a slow living boil */}
          <filter id="nb-live" x="-5%" y="-10%" width="110%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="5" result="n">
              <animate attributeName="baseFrequency" dur="11s" values="0.011;0.016;0.011" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="8" />
          </filter>
        </defs>

        <g filter="url(#nb-live)">
          {LAYERS.map((l, i) => (
            <g key={i} className={i === 0 ? "nb-drift" : undefined}>
              {/* silhouette */}
              <path d={l.area} fill={l.fill} fillOpacity={l.fillOpacity} />
              {/* moonlit ridge stroke, draws itself in */}
              <polyline
                className="nb-line"
                points={l.top}
                stroke={l.stroke}
                strokeOpacity={l.strokeOpacity}
                strokeWidth={l.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ "--len": l.len, "--delay": l.drawDelay } as React.CSSProperties}
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
