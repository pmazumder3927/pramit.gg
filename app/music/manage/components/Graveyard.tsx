"use client";

import { useState } from "react";
import useSWR from "swr";
import { AnimatePresence, motion } from "motion/react";
import type { GraveyardSnapshot } from "../lib/types";
import { Art, Button, Empty, Figure, Label, Margin, Sheet, Tag, fetcher, formatAgo } from "./paper";

/**
 * The archive.
 *
 * Retirement is terminal here. Postgres owns the list; the year playlists on
 * Spotify are a one-way mirror of it. Previously the mirror was read back as an
 * ordinary playlist, so every retired song re-entered triage as a filed track,
 * disappeared from this page the moment it did, and could only be got rid of by
 * liking it again — the exact opposite of what retiring means.
 */
export function Graveyard() {
  const { data, isLoading, mutate } = useSWR<GraveyardSnapshot>(
    "/api/music/graveyard",
    fetcher,
    { revalidateOnFocus: false }
  );

  const [mirroring, setMirroring] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ added: number; removed: number } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [reviving, setReviving] = useState<string | null>(null);

  const years = data?.years || [];
  const activeYear = open ?? years[0]?.year ?? null;
  const unmirrored = years.filter((year) => !year.mirrored).length;

  /**
   * Mirroring removes as well as adds — the year playlists carry leftovers from
   * when a retired song could wander back into a playlist — so it says what it
   * would do and waits for a second press.
   */
  async function mirror(commit: boolean) {
    setMirroring(true);
    setResult(null);
    try {
      const response = await fetch("/api/music/graveyard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: !commit }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);

      if (!commit) {
        if (!payload.added && !payload.removed) {
          setResult("Spotify already matches");
          setPlan(null);
        } else {
          setPlan({ added: payload.added, removed: payload.removed });
        }
      } else {
        setResult(`added ${payload.added}, removed ${payload.removed}`);
        setPlan(null);
        await mutate();
      }
    } catch (failure) {
      setResult(failure instanceof Error ? failure.message : "failed");
      setPlan(null);
    } finally {
      setMirroring(false);
    }
  }

  async function revive(trackId: string) {
    setReviving(trackId);
    try {
      await fetch("/api/music/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions: [{ trackId, verb: "revive" }] }),
      });
      await mutate();
    } finally {
      setReviving(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl lowercase text-ink">graveyard</h1>
          <Margin>songs that stopped being yours</Margin>
        </div>

        <div className="flex items-end gap-8">
          <Figure value={isLoading ? "—" : data!.total} name="at rest" tone="cool" />
          <Figure value={isLoading ? "—" : years.length} name="years" />
          <div className="flex flex-col items-end gap-1.5">
            <Button
              onClick={() => mirror(false)}
              disabled={mirroring || Boolean(plan)}
              tone={unmirrored > 0 ? "warm" : "plain"}
            >
              {mirroring ? "checking…" : "mirror to spotify"}
            </Button>
            {result && <Label>{result}</Label>}
          </div>
        </div>
      </div>

      {plan && (
        <Sheet className="mt-6 border-accent-orange/40 p-4">
          <p className="text-sm text-ink">
            This would add {plan.added} and{" "}
            <span className="text-accent-rust">remove {plan.removed}</span> from the
            year playlists on Spotify.
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Removals are songs sitting in a graveyard playlist that aren&rsquo;t
            retired any more — usually because you put them back somewhere.
          </p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => mirror(true)} disabled={mirroring} tone="ink">
              {mirroring ? "writing…" : "do it"}
            </Button>
            <Button onClick={() => setPlan(null)}>leave it</Button>
          </div>
        </Sheet>
      )}

      <Sheet className="mt-6 p-4">
        <p className="text-xs leading-relaxed text-ink-soft">
          Nothing leaves this page on its own. A song comes back only if you
          revive it here, or if you put it back in a playlist yourself in
          Spotify — and then it&rsquo;s gone from here for good.
        </p>
      </Sheet>

      {isLoading && <Empty>counting the departed…</Empty>}
      {!isLoading && years.length === 0 && <Empty>nobody&rsquo;s here yet.</Empty>}

      <div className="mt-6 space-y-2">
        {years.map((year) => {
          const expanded = activeYear === year.year;
          return (
            <div key={year.year}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? -1 : year.year)}
                className="flex w-full items-center gap-4 rounded-lg border border-line bg-card px-4 py-3 text-left shadow-paper transition-colors hover:border-ink/25"
              >
                <span className="font-serif text-xl tabular-nums text-ink">{year.year}</span>
                <span className="h-px flex-1 bg-line" />
                <span className="font-mono text-[11px] tabular-nums text-ink-faint">
                  {year.tracks.length}
                </span>
                {!year.mirrored && <Tag tone="warm">no playlist yet</Tag>}
                {year.playlistUrl && (
                  <a
                    href={year.playlistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="font-mono text-[10px] text-ink-faint transition-colors hover:text-accent-orange"
                  >
                    spotify ↗
                  </a>
                )}
                <span
                  className={`font-mono text-[11px] text-ink-faint transition-transform ${expanded ? "rotate-90" : ""}`}
                >
                  ›
                </span>
              </button>

              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 divide-y divide-line/60 rounded-lg border border-line bg-card px-2 shadow-paper">
                      {year.tracks.map((track) => (
                        <div
                          key={track.id}
                          className="group flex flex-wrap items-center gap-3 px-2 py-2"
                        >
                          <Art
                            src={track.art}
                            alt=""
                            size={34}
                            className="opacity-60 transition-opacity group-hover:opacity-100"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-ink-soft">{track.title}</p>
                            <p className="truncate text-xs text-ink-faint">{track.artist}</p>
                          </div>
                          <span className="flex-none font-mono text-[10px] text-ink-faint">
                            {formatAgo(track.retiredAt)}
                          </span>
                          <div className="flex w-full flex-none justify-end gap-2 transition-opacity sm:w-auto sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                            <Button
                              onClick={() => revive(track.id)}
                              disabled={reviving === track.id}
                            >
                              {reviving === track.id ? "…" : "bring back"}
                            </Button>
                            {track.songUrl && (
                              <a
                                href={track.songUrl}
                                aria-label={`Open ${track.title} in Spotify`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-line px-2 py-1.5 font-mono text-xs text-ink-faint transition-colors hover:text-accent-orange"
                              >
                                ↗
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </main>
  );
}
