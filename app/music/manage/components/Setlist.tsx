"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Reorder } from "motion/react";
import {
  ARCS,
  ARC_BLURBS,
  ARC_LABELS,
  DEFAULT_SHAPE,
  type Arc,
  type Scorecard,
  type SeqTrack,
  type Setlist as SetlistSnapshot,
  type Shape,
  type Side,
} from "../lib/types";
import {
  Art,
  Button,
  Label,
  Margin,
  Rule,
  Sheet,
  Tag,
  fetcher,
  formatAgo,
  formatDuration,
} from "./paper";

type KnobKey = "shape" | "movement" | "discovery";

const KNOBS: Array<{ key: KnobKey; label: string; blurb: string }> = [
  {
    key: "shape",
    label: "how much arc",
    blurb: "How hard each side is pulled onto its contour — hot open, drift down, lift two thirds in.",
  },
  {
    key: "movement",
    label: "how much movement",
    blurb: "How much contrast is demanded between neighbours, and how much every four songs must move. This is the cure for bland.",
  },
  {
    key: "discovery",
    label: "how much discovery",
    blurb: "How many songs almost nobody knows a side can carry, and how early they are allowed in.",
  },
];

/**
 * The setlist.
 *
 * Other people press play on these from the top, so the room is built around
 * two things you can look at and disagree with: the shape of each side, drawn
 * as the arousal it actually has against the arousal the contour asked for, and
 * a scorecard of things that are true about the order rather than a readout of
 * the numbers the optimiser was minimising.
 */
export function Setlist({ playlistId }: { playlistId: string }) {
  const { data, error, isLoading, mutate } = useSWR<SetlistSnapshot>(
    `/api/music/playlist/${playlistId}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const [shape, setShape] = useState<Shape | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showBench, setShowBench] = useState(true);
  const reshapeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!data) return;
    setShape((current) => current ?? data.shape);
    setOrder((current) => current ?? data.order);
  }, [data]);

  const view = useMemo(() => {
    if (!data) return null;
    return { ...data, shape: shape ?? data.shape, order: order ?? data.order };
  }, [data, shape, order]);

  const byUid = useMemo(
    () => new Map((data?.tracks || []).map((track) => [track.uid, track])),
    [data]
  );

  /** Ask the server to re-run the sequencer; the browser never optimises. */
  const reshape = useCallback(
    async (nextShape: Shape, resequence: boolean) => {
      setBusy("shaping");
      setMessage(null);
      try {
        const response = await fetch(`/api/music/playlist/${playlistId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shape: nextShape, resequence, preview: true }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error);
        await mutate(payload, { revalidate: false });
        setOrder(payload.order);
        setShape(payload.shape);
        setDirty(true);
      } catch (failure) {
        setMessage(failure instanceof Error ? failure.message : "could not reshape");
      } finally {
        setBusy(null);
      }
    },
    [playlistId, mutate]
  );

  const nudge = useCallback(
    (next: Partial<Shape>) => {
      const merged = { ...(shape ?? DEFAULT_SHAPE), ...next };
      setShape(merged);
      if (reshapeTimer.current) clearTimeout(reshapeTimer.current);
      reshapeTimer.current = setTimeout(() => void reshape(merged, true), 320);
    },
    [shape, reshape]
  );

  async function save() {
    if (!view) return;
    setBusy("saving");
    try {
      const response = await fetch(`/api/music/playlist/${playlistId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shape: view.shape, order: view.order }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      await mutate(payload, { revalidate: false });
      setOrder(payload.order);
      setDirty(false);
      setMessage("kept");
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : "could not keep it");
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (!view) return;
    setBusy("applying");
    setMessage(null);
    try {
      const response = await fetch(`/api/music/playlist/${playlistId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: view.order }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setMessage(`moved ${payload.moved} on spotify`);
      setDirty(false);
      await mutate();
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : "spotify refused");
    } finally {
      setBusy(null);
    }
  }

  function move(uid: string, delta: number) {
    setOrder((current) => {
      if (!current) return current;
      const from = current.indexOf(uid);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, uid);
      return next;
    });
    setDirty(true);
  }

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <Sheet className="p-6">
          <p className="text-sm text-ink-soft">{error.message}</p>
          <Link
            href="/music/manage"
            className="mt-3 inline-block font-mono text-[11px] text-accent-orange"
          >
            back to the desk →
          </Link>
        </Sheet>
      </main>
    );
  }

  if (isLoading || !view || !shape) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <Margin>reading the playlist…</Margin>
      </main>
    );
  }

  const card = view.scorecard;
  const positions = new Map(view.order.map((uid, index) => [uid, index]));

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {/* ---- header ---- */}
      <div className="flex flex-wrap items-start gap-4">
        <Art src={view.playlist.imageUrl} alt="" size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-2xl lowercase text-ink">
            {view.playlist.name}
          </h1>
          <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
            {view.playlist.trackCount} songs · shaped {formatAgo(view.savedAt)} · applied{" "}
            {formatAgo(view.appliedAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {message && <Label>{message}</Label>}
          <Button onClick={save} disabled={Boolean(busy) || !dirty}>
            {busy === "saving" ? "keeping…" : "keep this order"}
          </Button>
          <Button
            onClick={apply}
            disabled={Boolean(busy) || card.moves === 0 || view.offline}
            tone="ink"
          >
            {busy === "applying"
              ? "writing…"
              : view.offline
                ? "spotify unreachable"
                : card.moves === 0
                  ? "spotify matches"
                  : `apply · ${card.moves} moves`}
          </Button>
        </div>
      </div>

      {view.offline && (
        <p className="mt-3 rounded border border-accent-rust/40 bg-accent-rust/5 px-3 py-2 text-xs text-ink-soft">
          Spotify wouldn&rsquo;t answer, so this is the copy of the playlist read at
          the last sync. You can still shape it and keep the order; applying is off,
          because an order is written as moves between live positions and these
          might not be them any more.
        </p>
      )}

      {!view.offline && card.requests > 40 && (
        <p className="mt-3 rounded border border-line bg-paper-2 px-3 py-2 text-xs text-ink-soft">
          That&rsquo;s {card.requests} requests to Spotify, one after another, so it will
          take a moment. Runs that are already in order move together.
        </p>
      )}

      <Ledger card={card} />

      <Sheet className="mt-3 p-4">
        <ul className="space-y-1">
          {view.notes.map((note) => (
            <li key={note} className="text-xs leading-relaxed text-ink-soft">
              {note}
            </li>
          ))}
        </ul>
        {(view.lyricsPending > 0 || view.feelPending > 0) && (
          <p className="mt-2.5 font-mono text-[10px] text-accent-rust">
            {view.feelPending > 0 && `${view.feelPending} never measured. `}
            {view.lyricsPending > 0 && `${view.lyricsPending} still need lyrics. `}
            Read and measure the library from the desk.
          </p>
        )}
      </Sheet>

      <Bench
        shape={shape}
        card={card}
        show={showBench}
        onToggle={() => setShowBench((v) => !v)}
        onNudge={nudge}
        onReshape={() => void reshape(shape, true)}
        busy={busy}
        trackCount={view.playlist.trackCount}
      />

      {/* ---- the running order, a side at a time ---- */}
      <div className="mt-8 flex items-baseline gap-3">
        <h2 className="font-serif text-lg text-ink">the running order</h2>
        <Margin>drag inside a side, or nudge with the arrows</Margin>
      </div>

      <div className="mt-3 space-y-7">
        {view.sides.map((side, index) => {
          const uids = side.uids.filter((uid) => positions.has(uid));
          return (
            <section key={side.id}>
              <SideHead side={side} index={index} total={view.sides.length} />
              <Reorder.Group
                axis="y"
                values={uids}
                onReorder={(next) => {
                  setOrder((current) => {
                    if (!current) return current;
                    const slot = current.findIndex((uid) => uids.includes(uid));
                    const rest = current.filter((uid) => !uids.includes(uid));
                    const merged = [...rest];
                    merged.splice(slot, 0, ...next);
                    return merged;
                  });
                  setDirty(true);
                }}
                className="mt-2 space-y-1"
              >
                {uids.map((uid) => {
                  const track = byUid.get(uid);
                  if (!track) return null;
                  return (
                    <Reorder.Item key={uid} value={uid} drag={!track.unavailable}>
                      <Row
                        track={track}
                        index={positions.get(uid)! + 1}
                        onMove={(delta) => move(uid, delta)}
                      />
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>
            </section>
          );
        })}
      </div>
    </main>
  );
}

/**
 * What is measurably true about the order.
 *
 * The first number is the one that matters: adjacent songs should be 5-15%
 * closer together than two songs picked at random from the same playlist, which
 * is what 704,166 real playlists do. Under 80 is the over-smoothed order that
 * reads as bland — it is the complaint, stated as a number.
 */
function Ledger({ card }: { card: Scorecard }) {
  const band = (value: number | null, lo: number, hi: number) =>
    value === null || (value >= lo && value <= hi);

  return (
    <Sheet className="mt-5 p-4">
      <div className="grid gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        <Score
          value={card.adjacency === null ? "—" : `${card.adjacency}`}
          name="how close neighbours sit"
          good={band(card.adjacency, 82, 97)}
          note="85–95 is where real playlists are; under 80 is bland"
        />
        <Score
          value={card.alternation === null ? "—" : `${card.alternation}%`}
          name="of steps change direction"
          good={band(card.alternation, 58, 78)}
          note="real albums sit at 66–70"
        />
        <Score
          value={`${card.restlessSides}/${card.sideCount}`}
          name="sides that never sit still"
          good={card.restlessSides === card.sideCount}
          note="four flat songs is fourteen minutes"
        />
        <Score
          value={card.discovery ? `${card.discovery[2]}%` : "—"}
          name="strangers by a side's last third"
          good={!card.discovery || card.discovery[2] >= card.discovery[0]}
          note={
            card.discovery
              ? `${card.discovery[0]}% → ${card.discovery[1]}% → ${card.discovery[2]}%`
              : "too few to shape"
          }
        />
        <Score
          value={card.unanchored}
          name="strangers left on their own"
          good={card.unanchored === 0}
          note={`of ${card.strangers}, and ${card.strangerPairs} back to back`}
        />
      </div>

      <Rule className="my-3.5" />

      <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[10px] text-ink-faint">
        <span>{card.abrupt} abrupt handovers</span>
        <span>{card.artistClumps} artists back to back</span>
        <span
          className={
            card.artistTriples > 0 && card.artistRunFloor <= 2 ? "text-accent-rust" : undefined
          }
          title={
            card.artistRunFloor > 2
              ? `with this few artists, ${card.artistRunFloor} in a row is the best anything could do`
              : undefined
          }
        >
          {card.artistTriples} three deep
          {card.artistRunFloor > 2 ? ` · ${card.artistRunFloor} is the floor here` : ""}
        </span>
        <span>longest one-way run {card.longestRun}</span>
        <span>longest language run {card.languageSlab}</span>
        <span>
          {card.heard} heard · {card.read} read · {card.felt} measured
        </span>
      </div>

      {card.suspended.length > 0 && (
        <p className="mt-2 font-mono text-[10px] text-accent-rust">
          switched off here — {card.suspended.join("; ")}
        </p>
      )}
    </Sheet>
  );
}

function Score({
  value,
  name,
  good,
  note,
}: {
  value: number | string;
  name: string;
  good: boolean;
  note?: string;
}) {
  return (
    <div>
      <p
        className={`font-serif text-xl leading-none tabular-nums ${good ? "text-ink" : "text-accent-rust"}`}
      >
        {value}
      </p>
      <Label className="mt-1 block">{name}</Label>
      {note && <p className="mt-0.5 text-[10px] leading-snug text-ink-faint/80">{note}</p>}
    </div>
  );
}

/**
 * The shape of one side, drawn.
 *
 * The solid line is the arousal the side actually has, song by song. The dashed
 * one behind it is what the contour asked for. They are not supposed to sit on
 * top of each other — the contour is fitted to a five-song moving average, so
 * the solid line ought to zig-zag across it. A solid line that hugs the dashed
 * one is a side with no local movement at all, which is the thing that reads as
 * lifeless.
 */
/**
 * The shape of one side, drawn.
 *
 * A column per song, standing up from the library average — above the line
 * drives harder than the library, below it drives softer. The dashed line is
 * what the contour asked for. The two are not supposed to sit on top of each
 * other: the contour is fitted to a five-song moving average, so the columns
 * ought to zig-zag across it. Columns that hug the dashed line are a side with
 * no local movement at all, which is the thing that reads as lifeless.
 */
function Sparkline({ side }: { side: Side }) {
  const values = side.arousal;
  if (values.length < 3) return null;
  const width = Math.max(values.length * 6, 60);
  const height = 40;

  // Symmetric around the library average so the zero line means something, and
  // never tighter than ±1.2 SD, so a genuinely flat side looks flat rather than
  // being stretched into a shape it does not have.
  const reach = Math.max(1.2, ...values.map(Math.abs), ...side.wanted.map(Math.abs)) + 0.25;
  const step = width / values.length;
  const x = (i: number) => (i + 0.5) * step;
  const y = (v: number) => height / 2 - (v / reach) * (height / 2);
  const peak = values.indexOf(Math.max(...values));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-10 w-full text-ink"
      role="img"
      aria-label={`how hard each song drives across the side, peaking at song ${peak + 1} of ${values.length}`}
    >
      <line
        x1={0}
        x2={width}
        y1={height / 2}
        y2={height / 2}
        stroke="currentColor"
        strokeOpacity="0.16"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      {values.map((v, i) => (
        <line
          key={i}
          x1={x(i)}
          x2={x(i)}
          y1={height / 2}
          y2={y(v)}
          stroke={i === peak ? "rgb(var(--accent-orange))" : "currentColor"}
          strokeOpacity={i === peak ? 0.95 : 0.4}
          strokeWidth={Math.max(1.4, step * 0.4)}
          strokeLinecap="butt"
        />
      ))}
      <path
        d={side.wanted
          .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`)
          .join(" ")}
        fill="none"
        stroke="rgb(var(--accent-purple))"
        strokeOpacity="0.8"
        strokeWidth="1.25"
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function SideHead({ side, index, total }: { side: Side; index: number; total: number }) {
  if (side.id === "gone") {
    return (
      <Sheet className="flex items-baseline gap-3 px-3 py-2">
        <span className="font-hand text-[17px] text-ink-faint">{side.label}</span>
        <span className="h-px flex-1 bg-line" />
        <Label>{side.reason}</Label>
      </Sheet>
    );
  }

  const readings: Array<{ text: string; off: boolean }> = [];
  if (side.ramp !== null) {
    readings.push({ text: `drifts ${side.ramp <= 0 ? "down" : "up"} ${Math.abs(side.ramp).toFixed(2)}`, off: side.ramp > -0.03 });
  }
  if (side.peakAt !== null) {
    readings.push({
      text: `peaks ${Math.round(side.peakAt * 100)}% in`,
      off: side.peakAt < 0.55 || side.peakAt > 0.8,
    });
  }
  if (side.peakLift !== null) {
    readings.push({ text: `lifts ${side.peakLift.toFixed(1)} SD`, off: side.peakLift < 0.8 });
  }
  if (!side.restless) readings.push({ text: "sits still somewhere", off: true });

  return (
    <Sheet className="px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-[10px] text-ink-faint">
          {index + 1}/{total}
        </span>
        <span className="font-hand text-[18px] leading-none text-accent-purple">
          {side.label}
        </span>
        <Label>
          {side.uids.length} songs · {side.minutes} min · {side.reason}
        </Label>
      </div>
      <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <Sparkline side={side} />
        </div>
        <ul className="flex flex-none flex-wrap gap-x-3 font-mono text-[10px] leading-snug sm:w-52 sm:flex-col sm:gap-x-0 sm:text-right">
          {readings.map((reading) => (
            <li
              key={reading.text}
              className={reading.off ? "text-accent-rust" : "text-ink-faint"}
            >
              {reading.text}
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}

function Bench({
  shape,
  card,
  show,
  onToggle,
  onNudge,
  onReshape,
  busy,
  trackCount,
}: {
  shape: Shape;
  card: Scorecard;
  show: boolean;
  onToggle: () => void;
  onNudge: (next: Partial<Shape>) => void;
  onReshape: () => void;
  busy: string | null;
  trackCount: number;
}) {
  return (
    <>
      <div className="mt-6 flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-lg text-ink">the bench</h2>
          <Margin>turn a knob, it re-shapes</Margin>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="font-mono text-[11px] text-ink-faint transition-colors hover:text-ink"
        >
          {show ? "fold away" : "open"}
        </button>
      </div>

      {show && (
        <Sheet className="mt-2 p-4">
          {/* the contour */}
          <div>
            <Label>the shape of a side</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ARCS.map((arc) => (
                <button
                  key={arc}
                  type="button"
                  onClick={() => onNudge({ arc })}
                  className={`rounded-md border px-2.5 py-1 text-[12px] transition ${
                    shape.arc === arc
                      ? "border-accent-orange bg-accent-orange/10 text-ink"
                      : "border-line text-ink-faint hover:border-ink/30 hover:text-ink-soft"
                  }`}
                >
                  {ARC_LABELS[arc as Arc]}
                </button>
              ))}
            </div>
            <p className="mt-1.5 max-w-lg text-xs leading-snug text-ink-faint">
              {ARC_BLURBS[shape.arc]}
            </p>
          </div>

          <Rule className="my-4" />

          {/* how long a side runs before the shape starts again */}
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink">how long a side runs</span>
              <span className="font-mono text-[10px] tabular-nums text-ink-faint">
                {shape.sideMinutes} min · {Math.max(1, Math.round((trackCount * 3.5) / shape.sideMinutes))} sides
              </span>
            </div>
            <input
              type="range"
              min={20}
              max={120}
              step={2}
              value={shape.sideMinutes}
              onChange={(event) => onNudge({ sideMinutes: Number(event.target.value) })}
              className="mt-1.5 w-full accent-[rgb(var(--accent-purple))]"
            />
            <p className="mt-1 text-xs leading-snug text-ink-faint">
              A twelve-hour playlist cannot have one arc, because nobody hears twelve hours.
              It gets an arc per side instead, so whenever someone gives up they have heard a
              whole shape. About an hour is a car ride.
            </p>
          </div>

          <Rule className="my-4" />

          <div className="grid gap-5 sm:grid-cols-3">
            {KNOBS.map((knob) => (
              <div key={knob.key}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-ink">{knob.label}</span>
                  <span className="font-mono text-[10px] tabular-nums text-ink-faint">
                    {Math.round(shape[knob.key] * 100)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(shape[knob.key] * 100)}
                  onChange={(event) =>
                    onNudge({ [knob.key]: Number(event.target.value) / 100 } as Partial<Shape>)
                  }
                  className="mt-1.5 w-full accent-[rgb(var(--accent-orange))]"
                />
                <p className="mt-1 text-xs leading-snug text-ink-faint">{knob.blurb}</p>
              </div>
            ))}
          </div>

          <Rule className="my-4" />

          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink">what counts as alike</span>
              <span className="font-mono text-[10px] tabular-nums text-ink-faint">
                {Math.round((1 - shape.alike) * 100)} sound / {Math.round(shape.alike * 100)} sense
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(shape.alike * 100)}
              onChange={(event) => onNudge({ alike: Number(event.target.value) / 100 })}
              className="mt-1.5 w-full accent-[rgb(var(--accent-purple))]"
            />
            <div className="mt-1 flex justify-between text-xs text-ink-faint">
              <span>how it sounds — loudness, brightness, timbre, tempo</span>
              <span>what it&rsquo;s about — an embedding of the words</span>
            </div>
          </div>

          <Rule className="my-4" />

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Toggle
              on={shape.openStrong}
              onClick={() => onNudge({ openStrong: !shape.openStrong })}
              label="hold slot one for something a stranger can walk into"
            />
            <span className="font-mono text-[10px] text-ink-faint">
              {card.felt} of {trackCount} measured
            </span>
            <div className="ml-auto">
              <Button onClick={onReshape} disabled={Boolean(busy)} tone="warm">
                {busy === "shaping" ? "shaping…" : "shape it again"}
              </Button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}

function Toggle({
  on,
  onClick,
  label,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 text-left text-[12px] text-ink-soft transition-colors hover:text-ink"
    >
      <span
        className={`flex h-3.5 w-3.5 flex-none items-center justify-center rounded-sm border ${
          on ? "border-accent-orange bg-accent-orange/15" : "border-line"
        }`}
      >
        {on && (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-accent-orange">
            <path
              d="M2 6.4 4.6 9 10 3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      {label}
    </button>
  );
}

/** A short inked column: how hard this one drives, against the library. */
function Drive({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="w-4 flex-none text-center font-mono text-[9px] text-ink-faint">?</span>;
  }
  const height = Math.max(2, Math.min(16, Math.round(((value + 2.2) / 4.4) * 16)));
  return (
    <span
      className="flex h-4 w-4 flex-none items-end justify-center"
      title={`${value >= 0 ? "+" : ""}${value.toFixed(2)} SD`}
    >
      <span
        className="w-[3px] rounded-t-[1px] bg-ink/45"
        style={{ height: `${height}px` }}
      />
    </span>
  );
}

function Row({
  track,
  index,
  onMove,
}: {
  track: SeqTrack;
  index: number;
  onMove: (delta: number) => void;
}) {
  if (track.unavailable) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-line bg-paper-2 px-3 py-2">
        <span className="w-6 flex-none text-right font-mono text-[10px] tabular-nums text-ink-faint">
          {index}
        </span>
        <span className="h-[34px] w-[34px] flex-none rounded border border-dashed border-line" />
        <span className="flex-1 truncate text-sm italic text-ink-faint">
          delisted by Spotify · {track.trackId}
        </span>
      </div>
    );
  }

  const facts: string[] = [];
  if (track.releaseYear) facts.push(String(track.releaseYear));
  if (track.bpm) facts.push(`${Math.round(track.bpm)} bpm`);
  if (track.instrumental) facts.push("instrumental");
  else if (track.wordsPerMin !== null) facts.push(`${Math.round(track.wordsPerMin)} wpm`);
  facts.push(formatDuration(track.durationMs));

  return (
    <div className="group flex cursor-grab items-center gap-3 rounded-lg border border-line bg-card px-3 py-2 shadow-paper transition-colors hover:border-ink/25 active:cursor-grabbing">
      <span className="w-6 flex-none text-right font-mono text-[10px] tabular-nums text-ink-faint">
        {index}
      </span>
      <Drive value={track.arousal} />
      <Art src={track.art} alt="" size={34} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm text-ink">{track.title}</span>
          {track.stranger && (
            <span
              className="flex-none font-mono text-[10px] text-accent-purple"
              title="in the least-known third of the library — a stranger to a visitor"
            >
              new to them
            </span>
          )}
          {track.anchor && (
            <span
              className="flex-none font-mono text-[10px] text-ink-faint"
              title="in the best-known quarter — this is what a stranger gets anchored to"
            >
              known
            </span>
          )}
        </div>
        <p className="truncate text-xs text-ink-faint">{track.artist}</p>
      </div>

      <div className="hidden flex-none items-center gap-1.5 sm:flex">
        {track.language && <Tag tone="cool">{track.language}</Tag>}
        {!track.felt && <Tag>not measured</Tag>}
        {track.kin.slice(0, 1).map((name) => (
          <Tag key={name}>also in {name}</Tag>
        ))}
      </div>

      <span className="hidden w-40 flex-none text-right font-mono text-[10px] text-ink-faint md:block">
        {facts.join(" · ")}
      </span>

      <div className="flex flex-none flex-col opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onMove(-1)}
          className="px-1 font-mono text-[9px] leading-tight text-ink-faint hover:text-ink"
          aria-label="move up"
        >
          ▲
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          className="px-1 font-mono text-[9px] leading-tight text-ink-faint hover:text-ink"
          aria-label="move down"
        >
          ▼
        </button>
      </div>
    </div>
  );
}
