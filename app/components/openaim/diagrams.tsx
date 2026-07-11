"use client";

// Theme-aware, responsive diagrams for the OpenAim essay. These replace the old
// hardcoded-hex inline SVGs (which broke in dark mode and overlapped text).
// Box / arrow / timeline layouts are HTML+flex so labels wrap and scale; only
// the genuinely chart-shaped ones stay SVG, coloured from CSS-var tokens.

import { C, VizCard } from "./kit";

/* ------------------------------------------------------------------ shared */

function StepArrow() {
  // horizontal on wide, points down when the flex row wraps on mobile
  return (
    <div className="flex items-center justify-center text-accent-orange/70">
      <span className="hidden text-xl leading-none sm:inline">→</span>
      <span className="text-xl leading-none sm:hidden">↓</span>
    </div>
  );
}

function Box({
  n,
  title,
  sub,
  tone = "line",
}: {
  n?: string;
  title: string;
  sub?: string;
  tone?: "line" | "accent";
}) {
  return (
    <div
      className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-center ${
        tone === "accent"
          ? "border-accent-orange/50 bg-accent-orange/[0.08]"
          : "border-line bg-paper-2/50"
      }`}
    >
      {n ? <div className="font-mono text-xs text-ink-faint">{n}</div> : null}
      <div className="font-serif text-sm font-medium leading-tight text-ink">{title}</div>
      {sub ? <div className="mt-1 font-sans text-xs leading-snug text-ink-faint">{sub}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------ 1 · submovement fig */

export function SubmovementFig() {
  const W = 640;
  return (
    <VizCard
      title="one flick, decomposed"
      hint="anatomy of a shot"
      caption={
        <>
          fig — every engagement splits into a ballistic primary submovement plus
          optional corrections. a miss is blamed on whichever phase failed — a
          bad launch and a shaky settle need different drills.
        </>
      }
    >
      <svg viewBox={`0 0 ${W} 300`} className="w-full font-sans" fontWeight={500} role="img" aria-label="Top: mouse speed profile with a large ballistic primary hump and two small corrective humps. Bottom: crosshair error overshooting then settling into the hit window.">
        {/* top: speed */}
        <text x="22" y="90" fill={C.faint} transform="rotate(-90 22 90)" textAnchor="middle" className="text-[20px] sm:text-[12px]">mouse speed</text>
        <line x1="60" y1="40" x2="60" y2="150" stroke={C.lineA(0.8)} />
        <line x1="60" y1="150" x2={W - 20} y2="150" stroke={C.lineA(0.8)} />
        <path d="M60,150 C110,150 150,54 176,50 C205,46 250,142 280,144 C305,146 320,104 330,104 C345,104 372,143 388,144 C408,145 428,120 438,120 C455,120 480,146 496,146 L620,147" fill="none" stroke={C.acc} strokeWidth="2.6" />
        <circle cx="176" cy="50" r="5" fill={C.acc} />
        <text x="176" y="34" fill={C.acc} textAnchor="middle" className="text-[20px] sm:text-[12px]">primary — ballistic launch</text>
        <circle cx="330" cy="104" r="4" fill={C.pur} />
        <circle cx="438" cy="120" r="4" fill={C.pur} />
        <text x="384" y="90" fill={C.pur} textAnchor="middle" className="text-[20px] sm:text-[12px]">corrective submovements</text>

        {/* bottom: error */}
        <text x="22" y="235" fill={C.faint} transform="rotate(-90 22 235)" textAnchor="middle" className="text-[20px] sm:text-[12px]">crosshair error</text>
        <line x1="60" y1="185" x2="60" y2="285" stroke={C.lineA(0.8)} />
        <line x1="60" y1="285" x2={W - 20} y2="285" stroke={C.lineA(0.8)} />
        <rect x="60" y="256" width={W - 80} height="22" fill={C.hitA(0.12)} />
        <line x1="60" y1="267" x2={W - 20} y2="267" stroke={C.hit} strokeDasharray="5 4" opacity="0.8" />
        <text x={W - 24} y="251" fill={C.hit} textAnchor="end" className="text-[18px] sm:text-[11px]">target hit window</text>
        <path d="M60,196 C120,200 150,282 180,285 C220,289 250,286 280,283 C310,280 320,271 330,270 C360,268 380,267 400,267 L620,267" fill="none" stroke={C.pur} strokeWidth="2.6" />
        <circle cx="180" cy="285" r="4" fill={C.pur} />
        <text x="196" y="281" fill={C.pur} className="text-[18px] sm:text-[12px]">overshoot — signal-dependent noise</text>
        <text x={(W + 40) / 2} y="299" fill={C.faint} textAnchor="middle" className="text-[18px] sm:text-[11px]">time after target appears →</text>
      </svg>
    </VizCard>
  );
}

/* ------------------------------------------------------------- 2 · the loop */

export function LoopFig() {
  return (
    <VizCard
      title="one player model, one loop"
      hint="① → ② → ③ → ④, forever"
      caption={
        <>
          fig — telemetry → diagnosis updates the model and names your limiting
          sub-skill → the coach picks what to train → the drill engine generates
          and simulates it → back to telemetry. sensitivity rides the same
          submovement stream. diagnosis and prescription are the same math.
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Box n="1" title="telemetry" sub="raw mouse ~2 kHz" />
          <Box n="2" title="diagnosis" sub="why you missed" tone="accent" />
          <Box n="3" title="the coach" sub="what to train next" />
          <Box n="4" title="drill engine" sub="generate + simulate" />
        </div>
        <div className="rounded-xl border border-accent-orange/40 bg-accent-orange/[0.06] px-4 py-2.5 text-center">
          <div className="font-serif text-sm font-medium text-ink">the shared player model</div>
          <div className="mt-1 font-sans text-sm text-ink-faint">σᵥ · 14 demand axes · pace budget · gain curve — every stage reads and writes it</div>
        </div>
        <p className="text-center font-sans text-sm leading-relaxed text-ink-faint">
          the loop never stops turning — each drill sharpens the model, which reshapes the next drill.
        </p>
      </div>
    </VizCard>
  );
}

/* ------------------------------------------------- 3 · coalesced input recovery */

export function InputRecoveryFig() {
  const W = 640;
  const ticks = Array.from({ length: 30 }, (_, i) => 250 + i * 6);
  return (
    <VizCard
      title="what getCoalescedEvents() gives back"
      hint="~33 raw samples per frame"
      caption={
        <>
          fig — one 60 Hz render frame is 16.7 ms and hides ~33 raw mouse samples.
          the normal event gives you one; getCoalescedEvents() returns every
          underlying sample, timestamped. the whole diagnostic premise rides on this.
        </>
      }
    >
      <svg viewBox={`0 0 ${W} 150`} className="w-full font-sans" fontWeight={500} role="img" aria-label="A middle render frame expanded to show ~33 raw sample ticks, versus one sample per frame in the neighbouring frames.">
        <rect x="60" y="55" width="170" height="56" rx="4" fill={C.purA(0.06)} stroke={C.purA(0.5)} strokeDasharray="4 3" />
        <rect x="240" y="55" width="180" height="56" rx="4" fill={C.accA(0.08)} stroke={C.acc} strokeDasharray="4 3" />
        <rect x="430" y="55" width="170" height="56" rx="4" fill={C.purA(0.06)} stroke={C.purA(0.5)} strokeDasharray="4 3" />
        <text x="145" y="46" fontSize="11" fill={C.faint} textAnchor="middle">frame n</text>
        <text x="330" y="46" fontSize="11" fill={C.acc} textAnchor="middle">frame n+1 (expanded)</text>
        <text x="515" y="46" fontSize="11" fill={C.faint} textAnchor="middle">frame n+2</text>
        {ticks.map((x) => (
          <line key={x} x1={x} y1="63" x2={x} y2="103" stroke={C.acc} strokeWidth="1" />
        ))}
        <line x1="145" y1="63" x2="145" y2="103" stroke={C.pur} strokeWidth="2.5" />
        <line x1="515" y1="63" x2="515" y2="103" stroke={C.pur} strokeWidth="2.5" />
        <text x="145" y="130" fontSize="11" fill={C.faint} textAnchor="middle">1 sample / frame</text>
        <text x="330" y="130" fontSize="11" fill={C.acc} textAnchor="middle">every underlying sample, timestamped</text>
        <text x="515" y="130" fontSize="11" fill={C.faint} textAnchor="middle">1 sample / frame</text>
      </svg>
    </VizCard>
  );
}

/* ------------------------------------------------ 4 · miss-mechanism fingerprints */

export function MissFingerprintsFig() {
  const items = [
    { c: C.pur, k: "perception", d: "reaction > ~350 ms" },
    { c: C.acc, k: "planning", d: "primary lands off-target" },
    { c: C.rust, k: "correction", d: "2+ shaky corrections" },
    { c: C.hit, k: "timing", d: "on target, wrong instant" },
  ];
  return (
    <VizCard
      title="five ways to miss, five fingerprints"
      hint="each breaks at a different moment"
      caption={
        <>
          fig — perception, planning, correction and timing each fail at a
          distinct point in the movement; tracking accrues error the whole time a
          target moves. the app scores all five and blames the dominant one.
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {items.map((it) => (
            <div key={it.k} className="rounded-xl border border-line bg-paper-2/50 p-3">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: it.c }} />
                <span className="font-mono text-sm" style={{ color: it.c }}>{it.k}</span>
              </div>
              <div className="mt-1 font-sans text-xs leading-snug text-ink-faint">{it.d}</div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-dashed border-line bg-paper-2/30 px-4 py-2.5 text-center">
          <span className="font-mono text-sm text-ink-soft">tracking</span>
          <span className="ml-2 font-sans text-sm text-ink-faint">— error accrues the whole time the target moves →</span>
        </div>
      </div>
    </VizCard>
  );
}

/* ----------------------------------------------------------- 5 · session plan */

export function SessionPlanFig() {
  const blocks: { label: string; grow: number; tone: string }[] = [
    { label: "warm-up", grow: 1.1, tone: C.hitA(0.5) },
    { label: "probe", grow: 0.8, tone: C.purA(0.5) },
    { label: "focus ×3", grow: 2, tone: C.accA(0.35) },
    { label: "focus ×3", grow: 2, tone: C.accA(0.35) },
    { label: "stretch", grow: 0.8, tone: C.purA(0.35) },
    { label: "focus ×3", grow: 2, tone: C.accA(0.35) },
    { label: "sens ladder", grow: 1.3, tone: C.purA(0.4) },
  ];
  return (
    <VizCard
      title="a session is a plan, not a bag of picks"
      hint="warm-up → probe → blocks → sens ladder"
      caption={
        <>
          fig — progressive overload made explicit: inside a themed block the
          difficulty rung ratchets up on success (×1.18) and down on fail (×0.92),
          carrying into that axis's next block. it looks like a curated playlist —
          it's generated for you, today.
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-1.5">
          {blocks.map((b, i) => (
            <div
              key={i}
              className="flex items-center justify-center rounded-md border border-line/70 px-1 py-3 text-center"
              style={{ flexGrow: b.grow, flexBasis: 0, background: b.tone }}
            >
              <span className="font-sans text-xs font-medium leading-tight text-ink sm:text-sm">{b.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-end gap-1.5 pl-1">
          <span className="font-sans text-xs font-medium text-ink-faint">rung ↑</span>
          <span className="inline-block h-2 w-6 rounded-sm" style={{ background: C.acc }} />
          <span className="inline-block h-3.5 w-6 rounded-sm" style={{ background: C.acc }} />
          <span className="inline-block h-5 w-6 rounded-sm" style={{ background: C.acc }} />
          <span className="font-sans text-xs text-ink-faint">— overload within &amp; across blocks</span>
        </div>
      </div>
    </VizCard>
  );
}

/* --------------------------------------------------- 6 · the commons prior */

function Blob({ kind }: { kind: "wide" | "manifold" | "tight" }) {
  return (
    <svg viewBox="0 0 160 120" className="w-full" aria-hidden>
      {kind === "wide" && (
        <>
          <circle cx="80" cy="60" r="46" fill={C.purA(0.1)} />
          <circle cx="80" cy="60" r="28" fill={C.purA(0.12)} />
          <circle cx="80" cy="60" r="4" fill={C.pur} />
        </>
      )}
      {kind === "manifold" && (
        <g transform="translate(80 60) rotate(-28)">
          <ellipse rx="60" ry="19" fill={C.accA(0.12)} />
          <ellipse rx="38" ry="11" fill={C.accA(0.14)} />
        </g>
      )}
      {kind === "tight" && (
        <g transform="translate(80 60) rotate(-28)">
          <ellipse rx="40" ry="12" fill={C.accA(0.16)} stroke={C.acc} />
          <circle cx="0" cy="0" r="4" fill={C.acc} />
        </g>
      )}
    </svg>
  );
}

export function CommonsFig() {
  return (
    <VizCard
      title="a correlated prior beats a lonely guess"
      hint="n = 1 → the population manifold"
      caption={
        <>
          fig — a newcomer is cold-started on the population manifold; once ≥25
          contributors exist, ratings and weakness get renormalized against the
          crowd. difficulty stays absolute — a hard drill is hard for everyone.
        </>
      }
    >
      <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <figure className="text-center">
          <Blob kind="wide" />
          <figcaption className="font-sans text-xs leading-snug text-ink-faint">you, session 1 — wide, uncorrelated</figcaption>
        </figure>
        <div className="text-center text-accent-orange/70"><span className="hidden text-xl sm:inline">→</span><span className="text-xl sm:hidden">↓</span></div>
        <figure className="text-center">
          <Blob kind="manifold" />
          <figcaption className="font-sans text-xs leading-snug text-ink-faint">population manifold — Σ = LLᵀ + diag(ψ)</figcaption>
        </figure>
        <div className="text-center text-accent-orange/70"><span className="hidden text-xl sm:inline">→</span><span className="text-xl sm:hidden">↓</span></div>
        <figure className="text-center">
          <Blob kind="tight" />
          <figcaption className="font-sans text-xs leading-snug text-ink-faint">your estimate — correlated, tighter</figcaption>
        </figure>
      </div>
    </VizCard>
  );
}

/* ------------------------------------------------------------- 7 · the ledger */

export function LedgerFig() {
  return (
    <VizCard
      title="one fact stream, one fold, one spec"
      hint="the rewrite, in one picture"
      caption={
        <>
          fig — every target engagement becomes a durable fact row (timeouts
          included). your skill estimate isn&apos;t stored anywhere — it&apos;s
          re-computed by folding the facts, and the identical fold code runs in
          your browser (live, offline) and on the server (canonical, for
          leaderboards). only facts ever cross the wire, so there is no skill
          number a tampered client could forge.
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <Box title="engine" sub="one target closes…" />
          <Box title="engagement row" sub="realized geometry · outcome · every shot" tone="accent" />
          <Box title="the ledger" sub="append-only facts, on your device" />
        </div>
        <div className="grid grid-cols-1 items-stretch gap-2.5 sm:grid-cols-[1fr_auto_1fr]">
          <div className="rounded-xl border border-line bg-paper-2/50 px-3 py-2.5 text-center">
            <div className="font-serif text-sm font-medium text-ink">fold(facts) — in your browser</div>
            <div className="mt-1 font-sans text-xs leading-snug text-ink-faint">the live model the coach plays against</div>
          </div>
          <div className="flex items-center justify-center px-1 text-center font-mono text-xs font-medium leading-tight text-accent-purple">
            same code
          </div>
          <div className="rounded-xl border border-line bg-paper-2/50 px-3 py-2.5 text-center">
            <div className="font-serif text-sm font-medium text-ink">fold(facts) — on the server</div>
            <div className="mt-1 font-sans text-xs leading-snug text-ink-faint">the canonical one behind leaderboards</div>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-accent-purple/40 bg-accent-purple/[0.05] px-4 py-2 text-center font-sans text-xs leading-relaxed text-ink-soft">
          facts sync up — never a skill estimate. ratings, weaknesses, the mastered band: all readouts of the fold, none stored where they can drift.
        </div>
      </div>
    </VizCard>
  );
}

/* -------------------------------------------------------------- 8 · timeline */

export function TimelineFig() {
  const phases = [
    { day: "jul 6", name: "the toy", note: "canvas renderer + analysis + replay, on commit one" },
    { day: "jul 6", name: "the engine", note: "a drill becomes a point in a parameter space, not a named scenario" },
    { day: "jul 7", name: "unified + profile", note: "one engine, a real 3D room, the whole viz layer" },
    { day: "jul 8", name: "the commons", note: "backend, population model, determinism verifier" },
    { day: "jul 8", name: "the replay lab", note: "the text report dies; interactive diagnosis dashboard" },
    { day: "jul 9", name: "the coach, rewritten", note: "hand-weighted heuristics → one value function under a Thompson draw" },
    { day: "jul 9", name: "one fitter", note: "the in-browser Python engine deleted; ~950 lines gone, on purpose" },
    { day: "jul 10", name: "the heist", note: "adversarial bots audit the scoring — every exploitable family found and closed" },
    { day: "jul 10", name: "the ledger", note: "the self-audit becomes a defect register becomes a ground-up rewrite" },
  ];
  return (
    <VizCard
      title="empty repo → trainer → teardown, in 5 days"
      hint="jul 6–10"
      caption={
        <>
          fig — the git history. three days to build it, one to rewrite its
          judgment, one to audit it like a hostile reviewer and start rebuilding
          its brain.
        </>
      }
    >
      <ol className="relative ml-2 border-l border-line pl-5">
        {phases.map((p, i) => (
          <li key={i} className="relative mb-3.5 last:mb-0">
            <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-accent-orange bg-paper" />
            <div className="flex flex-wrap items-baseline gap-x-2.5">
              <span className="font-serif text-sm font-medium text-ink">{p.name}</span>
              <span className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-2xs text-ink-faint">{p.day}</span>
            </div>
            <div className="mt-0.5 font-sans text-sm leading-snug text-ink-faint">{p.note}</div>
          </li>
        ))}
      </ol>
    </VizCard>
  );
}
