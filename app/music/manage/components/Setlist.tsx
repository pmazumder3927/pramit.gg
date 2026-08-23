"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Reorder } from "motion/react";
import {
  DEFAULT_SHAPE,
  WORD_CURVES,
  WORD_CURVE_BLURBS,
  WORD_CURVE_LABELS,
  type SeqTrack,
  type Setlist as SetlistSnapshot,
  type Shape,
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

type KnobKey = "flow" | "leadWithNew" | "spreadArtists" | "spreadFavorites";

const KNOBS: Array<{ key: KnobKey; label: string; blurb: string }> = [
  {
    key: "flow",
    label: "keep neighbours alike",
    blurb: "How much each song should resemble the one after it.",
  },
  {
    key: "leadWithNew",
    label: "lead with the new",
    blurb: "Pull what's new to you, and newly released, toward the front.",
  },
  {
    key: "spreadArtists",
    label: "spread the artists",
    blurb: "Keep the same name from turning up twice in a row.",
  },
  {
    key: "spreadFavorites",
    label: "deal the favourites",
    blurb: "Spread the ones you actually play across the whole run.",
  },
];

/**
 * The setlist.
 *
 * Every rule here is one sentence and checkable by eye. Nothing claims to know
 * how a song sounds: Spotify's audio-features, recommendations and
 * related-artists endpoints all answer 403/404 now, and /artists returns empty
 * genres, so the old engine's "energy" and "emotional tone" were regexes over
 * song titles. What's left is real — who made it, what language it's in, how
 * many words a minute, what year, and how often you play it.
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
      reshapeTimer.current = setTimeout(() => void reshape(merged, true), 260);
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
          <Link href="/music/manage" className="mt-3 inline-block font-mono text-[11px] text-accent-orange">
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
  const sectionStarts = new Map(
    view.sections.map((section) => [section.uids[0], section])
  );

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
            disabled={Boolean(busy) || card.moves === 0}
            tone="ink"
          >
            {busy === "applying"
              ? "writing…"
              : card.moves === 0
                ? "spotify matches"
                : `apply · ${card.moves} moves`}
          </Button>
        </div>
      </div>

      {card.requests > 40 && (
        <p className="mt-3 rounded border border-line bg-paper-2 px-3 py-2 text-xs text-ink-soft">
          That&rsquo;s {card.requests} requests to Spotify, one after another, so
          it will take a moment. Runs that are already in order move together.
        </p>
      )}

      {/* ---- what's true about this order ---- */}
      <Sheet className="mt-5 p-4">
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
          <Score
            value={card.flow === null ? "—" : `${card.flow}%`}
            name="handed to a near neighbour"
            good={card.flow === null || card.flow >= 50}
            note="a shuffle scores about 25"
          />
          <Score
            value={card.newUpFront === null ? "—" : `${card.newUpFront}%`}
            name="where the newest quarter sits"
            good={card.newUpFront === null || card.newUpFront <= 40}
            note="50 is scattered evenly"
          />
          <Score
            value={card.artistClumps}
            name="artists back to back"
            good={card.artistClumps === 0}
          />
          <Score
            value={card.favoriteSpread === null ? "—" : `${card.favoriteSpread}%`}
            name="favourites evenly dealt"
            good={card.favoriteSpread === null || card.favoriteSpread >= 60}
          />
          <Score
            value={card.wordFit === null ? "—" : `${card.wordFit}%`}
            name={`follows "${WORD_CURVE_LABELS[view.shape.wordCurve]}"`}
            good={card.wordFit === null || card.wordFit >= 60}
          />
        </div>

        <Rule className="my-3.5" />

        <ul className="space-y-1">
          {view.notes.map((note) => (
            <li key={note} className="text-xs leading-relaxed text-ink-soft">
              {note}
            </li>
          ))}
        </ul>

        {view.lyricsPending > 0 && (
          <p className="mt-2.5 font-mono text-[10px] text-accent-rust">
            {view.lyricsPending} song{view.lyricsPending === 1 ? "" : "s"} still need lyrics
            — read them from the desk to sharpen the language and word rules.
          </p>
        )}
      </Sheet>

      {/* ---- the bench ---- */}
      <div className="mt-6 flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-lg text-ink">the bench</h2>
          <Margin>turn a knob, it re-shapes</Margin>
        </div>
        <button
          type="button"
          onClick={() => setShowBench((v) => !v)}
          className="font-mono text-[11px] text-ink-faint transition-colors hover:text-ink"
        >
          {showBench ? "fold away" : "open"}
        </button>
      </div>

      {showBench && (
        <Sheet className="mt-2 p-4">
          <div className="grid gap-5 sm:grid-cols-2">
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
                    nudge({ [knob.key]: Number(event.target.value) / 100 } as Partial<Shape>)
                  }
                  className="mt-1.5 w-full accent-[rgb(var(--accent-orange))]"
                />
                <p className="mt-1 text-xs leading-snug text-ink-faint">{knob.blurb}</p>
              </div>
            ))}
          </div>

          <Rule className="my-4" />

          {/* what "alike" means */}
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink">what counts as alike</span>
              <span className="font-mono text-[10px] tabular-nums text-ink-faint">
                {Math.round((1 - shape.likeness) * 100)} sound / {Math.round(shape.likeness * 100)} sense
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(shape.likeness * 100)}
              onChange={(event) => nudge({ likeness: Number(event.target.value) / 100 })}
              className="mt-1.5 w-full accent-[rgb(var(--accent-purple))]"
            />
            <div className="mt-1 flex justify-between text-xs text-ink-faint">
              <span>how it sounds — tempo, loudness, brightness, timbre</span>
              <span>what it&rsquo;s about — an embedding of the lyrics</span>
            </div>
            <p className="mt-2 font-mono text-[10px] text-ink-faint">
              {card.heard} of {view.playlist.trackCount} listened to ·{" "}
              {card.read} embedded
            </p>
          </div>

          <Rule className="my-4" />

          <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
            <div>
              <Label>wordiness across the run</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {WORD_CURVES.map((curve) => (
                  <button
                    key={curve}
                    type="button"
                    onClick={() => nudge({ wordCurve: curve })}
                    className={`rounded-md border px-2.5 py-1 text-[12px] transition ${
                      shape.wordCurve === curve
                        ? "border-accent-orange bg-accent-orange/10 text-ink"
                        : "border-line text-ink-faint hover:border-ink/30 hover:text-ink-soft"
                    }`}
                  >
                    {WORD_CURVE_LABELS[curve]}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 max-w-xs text-xs leading-snug text-ink-faint">
                {WORD_CURVE_BLURBS[shape.wordCurve]}
              </p>
            </div>

            <div>
              <Label>ends</Label>
              <div className="mt-1.5 flex flex-col gap-1.5">
                <Toggle
                  on={shape.openStrong}
                  onClick={() => nudge({ openStrong: !shape.openStrong })}
                  label="open on one you play"
                />
                <Toggle
                  on={shape.landSoft}
                  onClick={() => nudge({ landSoft: !shape.landSoft })}
                  label="land on something long and sparse"
                />
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button onClick={() => reshape(shape, true)} disabled={Boolean(busy)} tone="warm">
                {busy === "shaping" ? "shaping…" : "shape it again"}
              </Button>
            </div>
          </div>
        </Sheet>
      )}

      {/* ---- the running order ---- */}
      <div className="mt-8 flex items-baseline gap-3">
        <h2 className="font-serif text-lg text-ink">running order</h2>
        <Margin>drag inside a stretch, or nudge with the arrows</Margin>
      </div>

      <div className="mt-3 space-y-6">
        {view.sections.map((section) => {
          const uids = section.uids.filter((uid) => positions.has(uid));
          return (
            <div key={section.id}>
              <div className="flex items-baseline gap-3 px-1">
                <span className="font-hand text-[17px] text-accent-purple">
                  {section.label}
                </span>
                <span className="h-px flex-1 bg-line" />
                <Label>{section.reason}</Label>
              </div>

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
                className="mt-1.5 space-y-1"
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
                        startsSection={sectionStarts.has(uid)}
                      />
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>
            </div>
          );
        })}
      </div>
    </main>
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
      {note && <p className="mt-0.5 text-[10px] text-ink-faint/80">{note}</p>}
    </div>
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

function Row({
  track,
  index,
  onMove,
  startsSection,
}: {
  track: SeqTrack;
  index: number;
  onMove: (delta: number) => void;
  startsSection: boolean;
}) {
  const facts: string[] = [];
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
  if (track.releaseYear) facts.push(String(track.releaseYear));
  if (track.bpm) facts.push(`${Math.round(track.bpm)} bpm`);
  if (track.instrumental) facts.push("instrumental");
  else if (track.wordsPerMin !== null) facts.push(`${Math.round(track.wordsPerMin)} wpm`);
  facts.push(formatDuration(track.durationMs));

  return (
    <div
      className={`group flex cursor-grab items-center gap-3 rounded-lg border bg-card px-3 py-2 shadow-paper transition-colors active:cursor-grabbing ${
        startsSection ? "border-accent-purple/30" : "border-line"
      } hover:border-ink/25`}
    >
      <span className="w-6 flex-none text-right font-mono text-[10px] tabular-nums text-ink-faint">
        {index}
      </span>
      <Art src={track.art} alt="" size={34} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm text-ink">{track.title}</span>
          {(track.affinity ?? 0) >= 0.45 && (
            <span className="flex-none text-[11px] text-accent-orange" title="one you actually play">
              ★
            </span>
          )}
          {track.freshness >= 0.7 && (
            <span
              className="flex-none font-mono text-[10px] text-accent-purple"
              title="new to you, or newly out"
            >
              new
            </span>
          )}
        </div>
        <p className="truncate text-xs text-ink-faint">{track.artist}</p>
      </div>

      <div className="hidden flex-none items-center gap-1.5 sm:flex">
        {track.language && <Tag tone="cool">{track.language}</Tag>}
        {!track.heard && <Tag>not listened to</Tag>}
        {track.kin.slice(0, 1).map((name) => (
          <Tag key={name}>also in {name}</Tag>
        ))}
      </div>

      <span className="hidden w-40 flex-none text-right font-mono text-[10px] text-ink-faint md:block">
        {facts.join(" · ")}
      </span>

      <div className="flex flex-none flex-col opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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
