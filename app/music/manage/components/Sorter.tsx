"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import type {
  Decision,
  DeckKind,
  DeckSnapshot,
  TrackCard,
} from "../lib/types";
import {
  Art,
  Button,
  Key,
  Label,
  Margin,
  Meter,
  Sheet,
  Tag,
  fetcher,
  formatDuration,
} from "./paper";
import { useDeckPlayer } from "./useDeckPlayer";

const FLUSH_AFTER_MS = 1200;
const FLUSH_AT = 8;
const SWIPE = 110;

type Verdict = { card: TrackCard; decision: Decision };

/**
 * The sorting table.
 *
 * Everything the old deck did on the server between two cards now happens
 * locally: the whole pile arrives in one request, the cursor moves on keypress,
 * and decisions drain to the server in the background in batches. A swipe never
 * waits on Spotify.
 */
export function Sorter() {
  const params = useSearchParams();
  const kind = (params.get("kind") || "unfiled") as DeckKind;
  const playlistId = params.get("playlist");

  const key = `/api/music/deck?kind=${kind}${playlistId ? `&playlist=${playlistId}` : ""}`;
  const { data, error, isLoading } = useSWR<DeckSnapshot>(key, fetcher, {
    revalidateOnFocus: false,
  });

  const [index, setIndex] = useState(0);
  const [filing, setFiling] = useState<string[]>([]);
  const [done, setDone] = useState<Verdict[]>([]);
  const [flushError, setFlushError] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(0);

  const queue = useRef<Decision[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardHeight, setCardHeight] = useState(200);

  const player = useDeckPlayer();
  const dragX = useMotionValue(0);
  const rotate = useTransform(dragX, [-260, 0, 260], [-7, 0, 7]);
  const keepInk = useTransform(dragX, [30, SWIPE], [0, 1]);
  const retireInk = useTransform(dragX, [-SWIPE, -30], [1, 0]);

  const cards = data?.cards || [];
  const card = cards[index] || null;
  const upcoming = cards.slice(index + 1, index + 3);

  // Pinned playlists get the low number keys; the rest follow.
  const chips = useMemo(() => {
    if (!data) return [];
    const pinned = new Set(data.pinned);
    return [
      ...data.playlists.filter((p) => pinned.has(p.id)),
      ...data.playlists.filter((p) => !pinned.has(p.id)),
    ];
  }, [data]);

  // ---- draining --------------------------------------------------------

  const flush = useCallback(async () => {
    if (queue.current.length === 0) return;
    const batch = queue.current;
    queue.current = [];
    setInFlight((n) => n + batch.length);

    try {
      const response = await fetch("/api/music/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions: batch }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "could not save");
      if (result.failures?.length) {
        setFlushError(
          `${result.failures.length} didn't save: ${result.failures[0].error}`
        );
      } else {
        setFlushError(null);
      }
    } catch (failure) {
      setFlushError(failure instanceof Error ? failure.message : "could not save");
      // Put them back so the next flush (or the unload handler) retries.
      queue.current = [...batch, ...queue.current];
    } finally {
      setInFlight((n) => Math.max(0, n - batch.length));
    }
  }, []);

  const enqueue = useCallback(
    (decision: Decision) => {
      queue.current.push(decision);
      if (timer.current) clearTimeout(timer.current);
      if (queue.current.length >= FLUSH_AT) {
        void flush();
      } else {
        timer.current = setTimeout(() => void flush(), FLUSH_AFTER_MS);
      }
    },
    [flush]
  );

  useEffect(() => {
    const onLeave = () => {
      if (queue.current.length === 0) return;
      navigator.sendBeacon?.(
        "/api/music/decisions",
        new Blob([JSON.stringify({ decisions: queue.current })], {
          type: "application/json",
        })
      );
      queue.current = [];
    };
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      onLeave();
    };
  }, []);

  // ---- moving through the pile ----------------------------------------

  useEffect(() => {
    setFiling(card?.playlistIds || []);
    dragX.set(0);
    if (card?.uri && !card.unavailable) player.play(card.uri);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id]);

  useEffect(() => {
    setIndex(0);
    setDone([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const decide = useCallback(
    (verb: Decision["verb"]) => {
      if (!card) return;
      player.activate();

      const decision: Decision =
        verb === "file"
          ? { trackId: card.id, verb: "file", playlistIds: filing }
          : { trackId: card.id, verb };

      enqueue(decision);
      setDone((list) => [...list, { card, decision }]);
      setIndex((i) => i + 1);
    },
    [card, filing, enqueue, player]
  );

  /** Enter means "keep", unless you changed the filing — then it means "file". */
  const commit = useCallback(() => {
    if (!card) return;
    const before = [...card.playlistIds].sort().join(",");
    const after = [...filing].sort().join(",");
    decide(before === after ? "keep" : "file");
  }, [card, filing, decide]);

  /**
   * Step back a card. If the decision hasn't drained yet it is pulled out of
   * the queue and never happens at all; once it has reached the server it
   * stands, and the UI says so rather than pretending otherwise.
   */
  const stepBack = useCallback(() => {
    if (index === 0) return;
    const last = done[done.length - 1];
    if (last) {
      const at = queue.current.findIndex(
        (pending) =>
          pending.trackId === last.decision.trackId && pending.verb === last.decision.verb
      );
      if (at >= 0) {
        queue.current.splice(at, 1);
        setFlushError(null);
      } else {
        setFlushError(
          `"${last.card.title}" was already saved — undo it from the graveyard or by filing it again.`
        );
      }
    }
    setIndex((i) => i - 1);
    setDone((list) => list.slice(0, -1));
  }, [index, done]);

  const toggleChip = useCallback((id: string) => {
    setFiling((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (event.key >= "1" && event.key <= "9") {
        const chip = chips[Number(event.key) - 1];
        if (chip) {
          event.preventDefault();
          toggleChip(chip.id);
        }
        return;
      }

      switch (event.key) {
        case "Enter":
        case "ArrowRight":
          event.preventDefault();
          commit();
          break;
        case "ArrowDown":
        case "d":
          event.preventDefault();
          decide("retire");
          break;
        case "ArrowLeft":
        case "Backspace":
          event.preventDefault();
          stepBack();
          break;
        case "s":
          event.preventDefault();
          setIndex((i) => Math.min(i + 1, cards.length));
          break;
        case " ":
          event.preventDefault();
          player.toggle();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chips, commit, decide, stepBack, cards.length, player, toggleChip]);

  // ---- render ----------------------------------------------------------

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Sheet className="p-6">
          <p className="text-sm text-ink-soft">{error.message}</p>
        </Sheet>
      </main>
    );
  }

  const finished = !isLoading && data && index >= cards.length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6" onClick={player.activate}>
      {/* ---- pile header ---- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl lowercase text-ink">
            {data?.label || "…"}
          </h1>
          <Margin>{data?.blurb}</Margin>
        </div>
        <div className="text-right">
          <p className="font-mono text-[11px] tabular-nums text-ink-soft">
            {Math.min(index, cards.length)} / {data?.total ?? "—"}
          </p>
          {inFlight > 0 && <Label>saving {inFlight}…</Label>}
          {inFlight === 0 && done.length > 0 && <Label>saved</Label>}
        </div>
      </div>

      <div className="mt-3">
        <Meter value={index} max={Math.max(cards.length, 1)} />
      </div>

      {flushError && (
        <p className="mt-3 rounded border border-accent-rust/40 bg-accent-rust/5 px-3 py-2 font-mono text-[11px] text-accent-rust">
          {flushError}
        </p>
      )}

      {/* ---- the card ---- */}
      {isLoading && (
        <Sheet className="mt-6 p-10">
          <Margin>dealing…</Margin>
        </Sheet>
      )}

      {finished && (
        <Sheet className="mt-6 p-10 text-center">
          <p className="font-serif text-xl text-ink">pile cleared</p>
          <p className="mt-2 text-sm text-ink-soft">
            {done.length} decision{done.length === 1 ? "" : "s"}
            {data && data.total > cards.length
              ? ` · ${data.total - cards.length} still waiting behind them`
              : ""}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/music/manage">
              <Button tone="ink">back to the desk</Button>
            </Link>
            {data && data.total > cards.length && (
              <Button onClick={() => window.location.reload()}>deal the rest</Button>
            )}
          </div>
        </Sheet>
      )}

      {card && (
        <div className="relative mt-6">
          {/* the pile underneath, so advancing reads as physical */}
          {upcoming.map((next, depth) => (
            <div
              key={next.id}
              aria-hidden
              className="absolute inset-x-0 top-0 rounded-lg border border-line bg-card"
              style={{
                height: cardHeight,
                transform: `translateY(${(depth + 1) * 7}px) scaleX(${1 - (depth + 1) * 0.016})`,
                zIndex: -depth - 1,
              }}
            />
          ))}

          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={card.id}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.7}
              style={{ x: dragX, rotate }}
              onDragEnd={(_, info) => {
                if (info.offset.x > SWIPE) commit();
                else if (info.offset.x < -SWIPE) decide("retire");
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: dragX.get() > 0 ? 320 : -320, transition: { duration: 0.16 } }}
              transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
              className="relative cursor-grab active:cursor-grabbing"
              ref={(node) => {
                cardRef.current = node;
                if (node) setCardHeight(node.offsetHeight);
              }}
            >
              <Sheet className="relative overflow-hidden p-4 sm:p-5">
                {/* swipe verdict, written in ink rather than a coloured overlay */}
                <motion.span
                  style={{ opacity: keepInk }}
                  className="pointer-events-none absolute right-5 top-4 font-hand text-2xl text-accent-orange"
                >
                  keep
                </motion.span>
                <motion.span
                  style={{ opacity: retireInk }}
                  className="pointer-events-none absolute left-5 top-4 font-hand text-2xl text-accent-purple"
                >
                  let go
                </motion.span>

                <div className="flex gap-4">
                  <Art src={card.art} alt={card.title} size={104} />

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-serif text-xl text-ink">{card.title}</h2>
                    <p className="truncate text-sm text-ink-soft">{card.artist}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-ink-faint">
                      {[card.album, card.releaseYear, formatDuration(card.durationMs)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {card.unavailable && <Tag tone="cool">delisted</Tag>}
                      {card.liked && <Tag tone="warm">liked</Tag>}
                      {card.notes.map((note) => (
                        <Tag key={note}>{note}</Tag>
                      ))}
                    </div>
                  </div>
                </div>

                {/* playhead */}
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={player.toggle}
                    disabled={player.status !== "ready"}
                    className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-ink text-ink transition hover:bg-ink hover:text-paper disabled:opacity-30"
                    aria-label={player.playing ? "pause" : "play"}
                  >
                    {player.playing ? (
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <svg className="ml-0.5 h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7 4v16l13-8z" />
                      </svg>
                    )}
                  </button>

                  <div
                    className="group relative h-4 flex-1 cursor-pointer"
                    onClick={(event) => {
                      if (!player.duration) return;
                      const rect = event.currentTarget.getBoundingClientRect();
                      player.seek(
                        ((event.clientX - rect.left) / rect.width) * player.duration
                      );
                    }}
                  >
                    <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
                    <div
                      className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-accent-orange"
                      style={{
                        width: player.duration
                          ? `${(player.position / player.duration) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>

                  <span className="flex-none font-mono text-[10px] tabular-nums text-ink-faint">
                    {player.status === "ready"
                      ? `${formatDuration(player.position)} / ${formatDuration(player.duration)}`
                      : player.status === "connecting"
                        ? "connecting"
                        : "no player"}
                  </span>

                  {card.songUrl && (
                    <a
                      href={card.songUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-none font-mono text-[10px] text-ink-faint transition-colors hover:text-accent-orange"
                    >
                      spotify ↗
                    </a>
                  )}
                </div>
              </Sheet>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* ---- filing ---- */}
      {card && (
        <Sheet className="mt-3 p-4">
          <div className="flex items-baseline justify-between">
            <Label>file it into</Label>
            <Label>
              {filing.length === 0 ? "nowhere yet" : `${filing.length} chosen`}
            </Label>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {chips.map((chip, position) => {
              const on = filing.includes(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => toggleChip(chip.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] transition ${
                    on
                      ? "border-accent-orange bg-accent-orange/10 text-ink"
                      : "border-line text-ink-faint hover:border-ink/30 hover:text-ink-soft"
                  }`}
                >
                  {position < 9 && (
                    <span className="font-mono text-[9px] text-ink-faint">
                      {position + 1}
                    </span>
                  )}
                  {chip.name}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={commit} tone="ink">
              keep <Key>↵</Key>
            </Button>
            <Button onClick={() => decide("retire")} tone="danger">
              let go <Key>↓</Key>
            </Button>
            <Button onClick={() => setIndex((i) => i + 1)}>
              skip <Key>S</Key>
            </Button>
            <Button onClick={stepBack} disabled={index === 0}>
              back <Key>←</Key>
            </Button>

            <span className="ml-auto font-mono text-[10px] text-ink-faint">
              <Key>1</Key>–<Key>9</Key> to file · <Key>space</Key> to listen
            </span>
          </div>
        </Sheet>
      )}

      {/* ---- what's coming, what just went ---- */}
      {card && (
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <Label>still to come</Label>
            <div className="mt-2 space-y-1">
              {cards.slice(index + 1, index + 7).map((next, offset) => (
                <div key={next.id} className="flex items-baseline gap-2.5 text-xs">
                  <span className="w-4 flex-none font-mono text-[10px] tabular-nums text-ink-faint">
                    {offset + 1}
                  </span>
                  <span className="truncate text-ink-soft">{next.title}</span>
                  <span className="truncate text-ink-faint">{next.artist}</span>
                </div>
              ))}
              {cards.length - index - 1 <= 0 && <Margin>that&rsquo;s the last one.</Margin>}
            </div>
          </div>

          <div>
            <Label>just now</Label>
            <div className="mt-2 space-y-1">
              {done.length === 0 && <Margin>nothing yet.</Margin>}
              {[...done]
                .slice(-6)
                .reverse()
                .map((verdict) => (
                  <div
                    key={`${verdict.card.id}-${verdict.decision.verb}`}
                    className="flex items-baseline gap-2.5 text-xs"
                  >
                    <span
                      className={`w-11 flex-none font-mono text-[10px] ${
                        verdict.decision.verb === "retire"
                          ? "text-accent-purple"
                          : verdict.decision.verb === "file"
                            ? "text-accent-orange"
                            : "text-ink-faint"
                      }`}
                    >
                      {verdict.decision.verb === "retire"
                        ? "let go"
                        : verdict.decision.verb === "file"
                          ? "filed"
                          : "kept"}
                    </span>
                    <span className="truncate text-ink-soft">{verdict.card.title}</span>
                    <span className="truncate text-ink-faint">{verdict.card.artist}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
