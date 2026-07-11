"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HARNESS_FIXTURE } from "./openaimHarnessFixture";
import { C, Stat, VizCard } from "./kit";

type Target = readonly [id: number, yaw: number, pitch: number, radius: number];
type Frame = readonly [timeMs: number, targets: readonly Target[]];
type ReplayEvent = readonly [timeMs: number, kind: "hit" | "miss" | "kill"];
type Clip = {
  id: string;
  scenario: string;
  player: string;
  strategy: string;
  durationMs: number;
  stats: {
    score: number;
    shots: number;
    hits: number;
    kills: number;
    hitRate: number;
    medianKillMs: number | null;
    onTargetMs: number;
    travelDeg: number;
  };
  frames: readonly Frame[];
  events: readonly ReplayEvent[];
};

const clips = HARNESS_FIXTURE.clips as unknown as readonly Clip[];

const GROUPS = [
  {
    id: "flick",
    label: "reactive flick",
    clips: [
      ["flick-novice", "novice"],
      ["flick-advanced", "advanced"],
    ],
  },
  {
    id: "track",
    label: "strafe track",
    clips: [
      ["track-novice", "novice"],
      ["track-advanced", "advanced"],
    ],
  },
  {
    id: "audit",
    label: "exploit audit",
    clips: [
      ["tap-honest", "honest"],
      ["tap-camper", "camper"],
      ["tap-sprayer", "sprayer"],
    ],
  },
] as const;

const W = 640;
const H = 360;
const CX = W / 2;
const CY = H / 2;
const PX_PER_DEG = W / 70;

function point(target: Target): [number, number] {
  return [CX + target[1] * PX_PER_DEG, CY - target[2] * PX_PER_DEG];
}

function fmtMs(value: number | null) {
  if (value == null) return "--";
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
}

export default function HarnessReplay() {
  const [clipId, setClipId] = useState("flick-advanced");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timeRef = useRef(0);
  const clip = clips.find((item) => item.id === clipId) ?? clips[0]!;
  const group = GROUPS.find((item) => item.clips.some(([id]) => id === clip.id)) ?? GROUPS[0];

  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  useEffect(() => {
    if (!playing) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPlaying(false);
      return;
    }
    const epoch = performance.now() - timeRef.current;
    let raf = 0;
    const tick = (now: number) => {
      const next = (now - epoch) % clip.durationMs;
      timeRef.current = next;
      setTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clip.durationMs, clip.id, playing]);

  const switchClip = (id: string) => {
    setClipId(id);
    timeRef.current = 0;
    setTime(0);
    setPlaying(true);
  };

  const frameIndex = Math.min(
    clip.frames.length - 1,
    Math.max(0, Math.floor((time / clip.durationMs) * clip.frames.length)),
  );
  const frame = clip.frames[frameIndex] ?? clip.frames[0]!;
  const recentEvent = [...clip.events]
    .reverse()
    .find(([eventTime]) => eventTime <= time && time - eventTime < 130);

  const trail = useMemo(() => {
    const current = clip.frames[frameIndex]?.[1]?.[0];
    if (!current) return "";
    const points: string[] = [];
    for (let i = Math.max(0, frameIndex - 24); i <= frameIndex; i += 2) {
      const target = clip.frames[i]?.[1].find((item) => item[0] === current[0]);
      if (!target) continue;
      const [x, y] = point(target);
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return points.join(" ");
  }, [clip, frameIndex]);

  const setGroup = (id: string) => {
    const next = GROUPS.find((item) => item.id === id);
    if (next) switchClip(next.clips[next.id === "audit" ? 0 : 1][0]);
  };

  const exploit = HARNESS_FIXTURE.exploit;
  const auditRows = [exploit.honest, ...exploit.degenerate];
  const maxAuditScore = Math.max(...auditRows.map((row) => row.score));

  return (
    <VizCard
      title="the test harness, caught in the act"
      hint="real engine · real .oar replay"
      caption={
        <>
          fig — these are not hand-animated paths. each clip was produced by
          OpenAim&apos;s synthetic player driving the real engine, then sampled back
          out of the replay file. pick a weak hand, a stronger one, or one of the
          deliberately bad strategies used to attack the score.
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1 border-b border-line/70 pb-3" role="tablist" aria-label="Replay test">
          {GROUPS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={group.id === item.id}
              onClick={() => setGroup(item.id)}
              className="border px-3 py-1.5 font-mono text-xs transition-colors"
              style={{
                borderColor: group.id === item.id ? C.acc : C.lineA(0.8),
                color: group.id === item.id ? C.acc : C.faint,
                background: group.id === item.id ? C.accA(0.1) : "transparent",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1" aria-label="Synthetic player">
            {group.clips.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => switchClip(id)}
                aria-pressed={clip.id === id}
                className="border px-3 py-1 font-hand text-lg leading-none transition-colors"
                style={{
                  borderColor: clip.id === id ? C.pur : C.lineA(0.8),
                  color: clip.id === id ? C.pur : C.faint,
                  background: clip.id === id ? C.purA(0.08) : "transparent",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="font-mono text-xs text-ink-faint">
            {clip.scenario} · {clip.strategy}
          </span>
        </div>

        <div className="overflow-hidden border border-line bg-paper-2/40">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block aspect-video w-full"
            role="img"
            aria-label={`${clip.player} synthetic player running ${clip.scenario}`}
          >
            <defs>
              <pattern id="harness-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke={C.lineA(0.35)} strokeWidth="1" />
              </pattern>
              <clipPath id="harness-stage-clip">
                <rect width={W} height={H} />
              </clipPath>
            </defs>
            <rect width={W} height={H} fill={C.lineA(0.08)} />
            <rect width={W} height={H} fill="url(#harness-grid)" />
            <g clipPath="url(#harness-stage-clip)">
              {trail ? (
                <polyline
                  points={trail}
                  fill="none"
                  stroke={C.pur}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.4"
                />
              ) : null}
              {frame[1].map((target) => {
                const [x, y] = point(target);
                const radius = Math.max(7, target[3] * PX_PER_DEG);
                return (
                  <g key={target[0]} transform={`translate(${x} ${y})`}>
                    <circle r={radius + 5} fill={C.hitA(0.1)} stroke={C.hitA(0.4)} strokeWidth="1" />
                    <circle r={radius} fill={C.hitA(0.82)} stroke={C.ink} strokeWidth="1.5" />
                    <circle cx={-radius * 0.3} cy={-radius * 0.3} r={Math.max(1.5, radius * 0.18)} fill="white" opacity="0.35" />
                  </g>
                );
              })}
            </g>

            <g transform={`translate(${CX} ${CY})`}>
              <circle
                r={recentEvent?.[1] === "hit" || recentEvent?.[1] === "kill" ? 16 : 0}
                fill="none"
                stroke={C.hit}
                strokeWidth="2"
                opacity="0.8"
              />
              <line x1="-15" x2="-5" stroke={recentEvent?.[1] === "miss" ? C.rust : C.acc} strokeWidth="2" />
              <line x1="5" x2="15" stroke={recentEvent?.[1] === "miss" ? C.rust : C.acc} strokeWidth="2" />
              <line y1="-15" y2="-5" stroke={recentEvent?.[1] === "miss" ? C.rust : C.acc} strokeWidth="2" />
              <line y1="5" y2="15" stroke={recentEvent?.[1] === "miss" ? C.rust : C.acc} strokeWidth="2" />
              <circle r="1.8" fill={recentEvent?.[1] === "miss" ? C.rust : C.acc} />
            </g>

            <g fontFamily="var(--font-mono), monospace" fontSize="12">
              <text x="14" y="22" fill={C.soft}>{clip.player.toUpperCase()} MODEL</text>
              <text x={W - 14} y="22" textAnchor="end" fill={C.faint}>seed {clip.id.includes("tap") ? 13 : clip.id.includes("track") ? 11 : 7}</text>
              <text x="14" y={H - 14} fill={C.faint}>{(time / 1000).toFixed(1)} / {(clip.durationMs / 1000).toFixed(0)}s</text>
              {recentEvent ? (
                <text x={W - 14} y={H - 14} textAnchor="end" fill={recentEvent[1] === "miss" ? C.rust : C.hit}>
                  {recentEvent[1].toUpperCase()}
                </text>
              ) : null}
            </g>
          </svg>

          <div className="flex items-center gap-3 border-t border-line px-3 py-2">
            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              aria-label={playing ? "Pause replay" : "Play replay"}
              title={playing ? "Pause replay" : "Play replay"}
              className="grid h-8 w-8 shrink-0 place-items-center border border-accent-orange/50 font-mono text-sm text-accent-orange"
            >
              {playing ? "Ⅱ" : "▶"}
            </button>
            <input
              type="range"
              min={0}
              max={clip.durationMs}
              step={10}
              value={time}
              onChange={(event) => {
                const value = Number(event.target.value);
                timeRef.current = value;
                setTime(value);
              }}
              aria-label="Replay position"
              className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-line"
              style={{ accentColor: C.acc }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-y border-line/70 py-3 sm:grid-cols-4">
          <Stat value={String(clip.stats.score)} label="raw score" color={C.acc} />
          <Stat
            value={clip.stats.shots ? `${Math.round(clip.stats.hitRate * 100)}%` : `${Math.round((clip.stats.onTargetMs / clip.durationMs) * 100)}%`}
            label={clip.stats.shots ? `${clip.stats.hits}/${clip.stats.shots} shots` : "time on target"}
            color={C.hit}
          />
          <Stat value={String(clip.stats.kills)} label="kills" color={C.pur} />
          <Stat value={fmtMs(clip.stats.medianKillMs)} label="median kill" color={C.faint} />
        </div>

        {group.id === "audit" ? (
          <div className="space-y-2 pt-1">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-serif text-sm text-ink">three-seed exploit check</span>
              <span className="font-hand text-lg text-ink-faint">shipped grader · 8s runs</span>
            </div>
            {auditRows.map((row) => (
              <div key={row.strategy} className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-2">
                <span className="font-mono text-xs text-ink-soft">{row.strategy}</span>
                <span className="h-2 overflow-hidden bg-line/50">
                  <span
                    className="block h-full"
                    style={{
                      width: `${(row.score / maxAuditScore) * 100}%`,
                      background: row.strategy === "honest" ? C.hit : row.strategy === "sprayer" ? C.rust : C.pur,
                    }}
                  />
                </span>
                <span className="text-right font-mono text-xs tabular-nums text-ink-faint">{Math.round(row.score)}</span>
              </div>
            ))}
            <p className="font-hand text-lg leading-snug text-ink-faint">
              the camper does about {Math.round(exploit.minTravelRatio * 100)}% of the honest crosshair travel; the score still keeps both attacks below {Math.round(exploit.worstScoreRatio * 100)}% of the honest run.
            </p>
          </div>
        ) : null}
      </div>
    </VizCard>
  );
}
