"use client";

// DEV-ONLY preview harness for the CoverReveal painterly song-switch repaint.
// Visit /dev/cover-paint. Drives the REAL engine (app/lib/painterly.ts) so what you
// see here is exactly what ships. Replay on demand, toggle the paper theme, paste a
// cover URL (CORS-permitting; Spotify i.scdn.co works), tune the brush speed.
// Not linked anywhere; safe to delete.

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeCover, planPainting, animatePainting, type PaintController } from "@/app/lib/painterly";

const HOLD = 1.6;
const FADE = 8.5;

export default function CoverPaintPreview() {
  const groupRef = useRef<HTMLDivElement | null>(null);
  const dryRef = useRef<HTMLCanvasElement | null>(null);
  const wetRef = useRef<HTMLCanvasElement | null>(null);
  const ctrlRef = useRef<PaintController | null>(null);
  const [dark, setDark] = useState(true);
  const [url, setUrl] = useState("/me.jpg");
  const [speed, setSpeed] = useState(900);
  const [info, setInfo] = useState("");
  const seedRef = useRef(1);

  const paint = useCallback(() => {
    const group = groupRef.current;
    const dryCanvas = dryRef.current;
    const wetCanvas = wetRef.current;
    if (!group || !dryCanvas || !wetCanvas) return;
    ctrlRef.current?.cancel();
    seedRef.current += 1;

    const dryDpr = Math.min(2, window.devicePixelRatio || 1);
    const wetDpr = Math.min(1, dryDpr);
    const w = dryCanvas.clientWidth;
    const h = dryCanvas.clientHeight;
    dryCanvas.width = Math.round(w * dryDpr);
    dryCanvas.height = Math.round(h * dryDpr);
    wetCanvas.width = Math.round(w * wetDpr);
    wetCanvas.height = Math.round(h * wetDpr);
    group.style.transition = "none";
    group.style.opacity = String(dark ? 0.55 : 0.72);
    const dctx = dryCanvas.getContext("2d");
    const wctx = wetCanvas.getContext("2d");
    if (!dctx || !wctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const t = performance.now();
      const an = analyzeCover(img, img.naturalWidth || 640, img.naturalHeight || 640, w, h, 240);
      if (!an) {
        setInfo("could not read pixels (CORS) — try another URL");
        return;
      }
      const painting = planPainting(an.rgb, an.AW, an.AH, w, h, { dark, seed: seedRef.current, speed });
      const planMs = Math.round(performance.now() - t);
      setInfo(`${painting.strokes.length} strokes · plan ${planMs}ms · paint ${painting.paintDur.toFixed(1)}s · dry ${FADE}s`);
      ctrlRef.current = animatePainting(
        { dry: dctx, dryDpr, wet: wctx, wetDpr },
        painting,
        () => performance.now(),
        () => {
          group.style.transition = `opacity ${FADE}s ease-in ${HOLD}s`;
          group.style.opacity = "0";
        },
      );
    };
    img.onerror = () => setInfo("image failed to load");
    img.src = url;
  }, [dark, url, speed]);

  // repaint on first mount + whenever theme changes
  useEffect(() => {
    const id = setTimeout(paint, 60);
    return () => {
      clearTimeout(id);
      ctrlRef.current?.cancel();
    };
  }, [paint]);

  const paper = dark ? "#0c0c13" : "#f4ecd8";
  const ink = dark ? "#e8e0d0" : "#2a241c";

  return (
    <div style={{ minHeight: "100vh", background: paper, color: ink, font: "13px ui-sans-serif, system-ui" }}>
      <div style={{ position: "relative", height: "78vh", overflow: "hidden", background: paper }}>
        {/* a few fake doodles so you can confirm the paint sits BEHIND the ink */}
        <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 2 }}>
          <g fill="none" stroke={ink} strokeWidth={3} opacity={0.55} strokeLinecap="round">
            <path d="M300 240 q70 -90 140 -10 q45 50 -15 100 q-80 65 -130 -15 q-30 -45 5 -75 z" />
            <path d="M1180 650 q-55 -75 30 -120 q75 -32 110 45 q22 64 -55 96 q-65 28 -85 -21" />
            <path d="M840 470 q35 -65 95 -22 q45 33 0 86 q-55 55 -98 0 q-26 -38 3 -64" />
          </g>
        </svg>
        <div ref={groupRef}
          style={{ position: "absolute", inset: 0, zIndex: 1, isolation: "isolate",
            mixBlendMode: dark ? "screen" : "multiply" }}>
          <canvas ref={dryRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
          <canvas ref={wetRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", padding: "12px 16px" }}>
        <button onClick={paint} style={btn}>▶ Replay paint</button>
        <label style={lbl}><input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} /> night sheet</label>
        <label style={lbl}>speed
          <input type="range" min={400} max={1600} step={50} value={speed} onChange={(e) => setSpeed(+e.target.value)} />
          {speed}px/s
        </label>
        <label style={lbl}>cover
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/me.jpg or a CORS cover URL"
            style={{ ...inp, width: 320 }} />
        </label>
        <span style={{ opacity: 0.7 }}>{info}</span>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = { font: "inherit", padding: "6px 12px", borderRadius: 6, border: "1px solid #8884", background: "#8882", color: "inherit", cursor: "pointer" };
const lbl: React.CSSProperties = { display: "inline-flex", gap: 6, alignItems: "center" };
const inp: React.CSSProperties = { font: "inherit", padding: "4px 8px", borderRadius: 6, border: "1px solid #8884", background: "#8881", color: "inherit" };
