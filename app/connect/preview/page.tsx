"use client";

// TEMPORARY preview route used while iterating on the cat council scene.
// Safe to delete once design work lands.

import { useState } from "react";
import CatCouncil, { type Verdict } from "@/app/connect/components/CatCouncil";
import type { DrawingStroke } from "@/app/lib/confessional-captcha";

const SAMPLE_STROKES: DrawingStroke[] = [
  {
    color: "#f8a4c8",
    width: 6,
    points: [
      { x: 120, y: 90 },
      { x: 150, y: 70 },
      { x: 200, y: 65 },
      { x: 250, y: 75 },
      { x: 300, y: 95 },
      { x: 330, y: 130 },
      { x: 320, y: 170 },
      { x: 280, y: 200 },
      { x: 220, y: 215 },
      { x: 160, y: 200 },
      { x: 130, y: 170 },
      { x: 120, y: 130 },
      { x: 130, y: 100 },
    ],
  },
  {
    color: "#ffd36d",
    width: 5,
    points: [
      { x: 170, y: 130 },
      { x: 180, y: 130 },
      { x: 190, y: 135 },
    ],
  },
  {
    color: "#ffd36d",
    width: 5,
    points: [
      { x: 250, y: 130 },
      { x: 260, y: 130 },
      { x: 270, y: 135 },
    ],
  },
  {
    color: "#b7ffca",
    width: 4,
    points: [
      { x: 195, y: 165 },
      { x: 220, y: 175 },
      { x: 245, y: 165 },
    ],
  },
  {
    color: "#9df4f2",
    width: 3,
    points: [
      { x: 80, y: 250 },
      { x: 130, y: 255 },
      { x: 200, y: 260 },
      { x: 280, y: 258 },
      { x: 360, y: 252 },
    ],
  },
];

export default function CouncilPreviewPage() {
  const [verdict, setVerdict] = useState<Verdict>("judging");

  return (
    <div className="min-h-screen bg-[#0a0610] text-white/80 px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-extralight mb-4">cat council preview</h1>
        <div className="flex gap-2 mb-8">
          {(["judging", "approve", "reject"] as Verdict[]).map((v) => (
            <button
              key={v}
              onClick={() => setVerdict(v)}
              className={`rounded-xl border px-4 py-2 text-sm font-light transition-colors ${
                verdict === v
                  ? "bg-white/10 border-white/40 text-white"
                  : "border-white/10 text-white/60 hover:text-white/90"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8">
          <CatCouncil verdict={verdict} strokes={SAMPLE_STROKES} />
        </div>
      </div>
    </div>
  );
}
