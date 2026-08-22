"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Reorder } from "motion/react";
import type { DeckSummary, DeskSnapshot, ManagedPlaylist } from "../lib/types";
import {
  Art,
  Button,
  Empty,
  Figure,
  Label,
  Margin,
  Meter,
  Sheet,
  Tag,
  fetcher,
  formatAgo,
} from "./paper";

function deckHref(deck: DeckSummary) {
  const params = new URLSearchParams({ kind: deck.kind });
  if (deck.playlistId) params.set("playlist", deck.playlistId);
  return `/music/manage/sort?${params}`;
}

/**
 * One page that answers "what is there to do", and gets you into the room that
 * does it. The old manager split this across an Overview, a Status page and a
 * Graveyard tab that each re-fetched the whole library and disagreed with each
 * other about the numbers.
 */
export function Desk() {
  const { data, error, isLoading, mutate } = useSWR<DeskSnapshot>(
    "/api/music/desk",
    fetcher,
    { revalidateOnFocus: false }
  );

  const [syncing, setSyncing] = useState(false);
  const [enriching, setEnriching] = useState<string | null>(null);
  const [arranging, setArranging] = useState(false);
  const [draft, setDraft] = useState<ManagedPlaylist[]>([]);
  const [saving, setSaving] = useState(false);

  const playlists =
    data?.playlists.filter((p) => p.role === "shelf" || p.role === "inbox") || [];
  const publicPlaylists = playlists.filter((p) => p.isPublic && !p.hidden);
  const total = data?.counts.analysable || 0;

  async function resync() {
    setSyncing(true);
    try {
      await mutate(fetcher<DeskSnapshot>("/api/music/desk?sync=1"), {
        revalidate: false,
      });
    } finally {
      setSyncing(false);
    }
  }

  /** Walk a chunked enrichment endpoint until it says there is nothing left. */
  async function runPass(path: string, limit: number, done: (r: any) => boolean) {
    setEnriching("starting");
    try {
      for (let pass = 0; pass < 60; pass++) {
        const response = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setEnriching(`${result.remaining} to go`);
        if (done(result)) break;
      }
      await mutate();
    } catch (failure) {
      setEnriching(failure instanceof Error ? failure.message : "failed");
      return;
    }
    setEnriching(null);
  }

  async function saveArrangement() {
    setSaving(true);
    try {
      await fetch("/api/music/playlists", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: draft.map((p) => p.id) }),
      });
      await mutate();
      setArranging(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleHidden(playlist: ManagedPlaylist) {
    await fetch("/api/music/playlists", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hidden: { [playlist.id]: !playlist.hidden } }),
    });
    await mutate();
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <Sheet className="p-6">
          <h1 className="font-serif text-xl text-ink">Spotify isn&rsquo;t answering</h1>
          <p className="mt-2 text-sm text-ink-soft">{error.message}</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block font-mono text-[11px] text-accent-orange"
          >
            reconnect →
          </Link>
        </Sheet>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* ---- the ledger ---- */}
      <Sheet className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-wrap gap-x-10 gap-y-5">
            <Figure value={isLoading ? "—" : data!.counts.tracks} name="songs" />
            <Figure value={isLoading ? "—" : data!.counts.liked} name="liked" />
            <Figure
              value={isLoading ? "—" : data!.counts.unfiled}
              name="unfiled"
              tone="warm"
            />
            <Figure
              value={isLoading ? "—" : data!.counts.retired}
              name="retired"
              tone="cool"
            />
          </div>

          <div className="flex flex-col items-end gap-2">
            <Button onClick={resync} disabled={syncing}>
              {syncing ? "pulling…" : "re-read spotify"}
            </Button>
            <Label>synced {formatAgo(data?.syncedAt)}</Label>
          </div>
        </div>

        {data?.error && (
          <p className="mt-4 rounded border border-accent-rust/40 bg-accent-rust/5 px-3 py-2 font-mono text-[11px] text-accent-rust">
            {data.error}
          </p>
        )}

        {/* What the sequencer actually knows. It says so plainly, because
            every one of these is a real measurement and the gaps are real
            gaps. */}
        {total > 0 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Coverage
              name="lyrics read"
              known={data!.counts.lyricsKnown}
              total={total}
              blurb="language and words a minute, from synced lyrics"
              action="read them"
              busy={enriching}
              onRun={() =>
                runPass("/api/music/enrich", 60, (r) => r.remaining === 0 || r.processed === 0)
              }
            />
            <Coverage
              name="lyrics embedded"
              known={data!.counts.senseKnown}
              total={total}
              blurb="what a song is about, as a vector"
              action="embed them"
              busy={enriching}
              onRun={() =>
                runPass("/api/music/embed", 300, (r) => r.remaining === 0 || r.embedded === 0)
              }
            />
            <Coverage
              name="listened to"
              known={data!.counts.soundKnown}
              total={total}
              blurb="tempo, loudness, brightness, timbre — off a real preview"
              hint="npm run music:audio"
            />
          </div>
        )}
      </Sheet>

      {/* ---- piles to work ---- */}
      <div className="mt-10 flex items-baseline gap-3">
        <h2 className="font-serif text-lg text-ink">piles</h2>
        <Margin>finite. you can finish them.</Margin>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {(data?.decks || [])
          .filter((deck) => deck.kind !== "playlist")
          .map((deck) => (
            <Link key={deck.kind} href={deckHref(deck)}>
              <Sheet className="group flex items-center gap-4 p-4 transition-colors hover:border-ink/30">
                <span className="font-serif text-2xl tabular-nums text-accent-orange">
                  {deck.count}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">{deck.label}</span>
                  <span className="block text-xs text-ink-faint">{deck.blurb}</span>
                </span>
                <span className="font-mono text-[11px] text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
                  sort →
                </span>
              </Sheet>
            </Link>
          ))}
        {data && data.decks.filter((d) => d.kind !== "playlist").length === 0 && (
          <Sheet className="p-4 sm:col-span-2">
            <Margin>nothing loose. the whole library is filed.</Margin>
          </Sheet>
        )}
      </div>

      {/* ---- the shelf ---- */}
      <div className="mt-10 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-lg text-ink">the shelf</h2>
          <Margin>{playlists.length} playlists</Margin>
        </div>

        {arranging ? (
          <div className="flex items-center gap-2">
            <Label>drag to set the order on /music</Label>
            <Button onClick={saveArrangement} disabled={saving} tone="ink">
              {saving ? "saving…" : "keep this order"}
            </Button>
            <Button onClick={() => setArranging(false)}>cancel</Button>
          </div>
        ) : (
          <Button
            onClick={() => {
              setDraft(publicPlaylists);
              setArranging(true);
            }}
          >
            arrange the public page
          </Button>
        )}
      </div>

      {arranging ? (
        <Reorder.Group
          axis="y"
          values={draft}
          onReorder={setDraft}
          className="mt-3 space-y-1.5"
        >
          {draft.map((playlist, index) => (
            <Reorder.Item key={playlist.id} value={playlist}>
              <Sheet className="flex cursor-grab items-center gap-3 p-2.5 active:cursor-grabbing">
                <span className="w-5 text-center font-mono text-[11px] tabular-nums text-ink-faint">
                  {index + 1}
                </span>
                <Art src={playlist.imageUrl} alt="" size={32} />
                <span className="flex-1 truncate text-sm text-ink">{playlist.name}</span>
                <span className="font-mono text-[10px] text-ink-faint">
                  {playlist.trackCount}
                </span>
              </Sheet>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      ) : (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {isLoading && <Empty>reading the shelf…</Empty>}
          {playlists.map((playlist) => (
            <PlaylistRow
              key={playlist.id}
              playlist={playlist}
              onToggleHidden={() => toggleHidden(playlist)}
            />
          ))}
        </div>
      )}

    </main>
  );
}

function Coverage({
  name,
  known,
  total,
  blurb,
  action,
  busy,
  onRun,
  hint,
}: {
  name: string;
  known: number;
  total: number;
  blurb: string;
  action?: string;
  busy?: string | null;
  onRun?: () => void;
  hint?: string;
}) {
  const complete = known >= total;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <Label>{name}</Label>
        <span className="font-mono text-[10px] tabular-nums text-ink-faint">
          {known}/{total}
        </span>
      </div>
      <div className="mt-1.5">
        <Meter value={known} max={total || 1} />
      </div>
      <p className="mt-1.5 text-xs leading-snug text-ink-faint">{blurb}</p>
      {!complete && action && onRun && (
        <Button onClick={onRun} disabled={Boolean(busy)} tone="warm" className="mt-2">
          {busy ? `working… ${busy}` : action}
        </Button>
      )}
      {!complete && hint && (
        <p className="mt-2 font-mono text-[10px] text-ink-faint">
          needs ffmpeg — run <span className="text-accent-orange">{hint}</span>
        </p>
      )}
    </div>
  );
}

function PlaylistRow({
  playlist,
  onToggleHidden,
}: {
  playlist: ManagedPlaylist;
  onToggleHidden: () => void;
}) {
  return (
    <Sheet className="group flex items-center gap-3 p-3 transition-colors hover:border-ink/25">
      <Art src={playlist.imageUrl} alt="" size={44} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <Link
            href={`/music/manage/playlist/${playlist.id}`}
            className="truncate text-sm text-ink transition-colors hover:text-accent-orange"
          >
            {playlist.name}
          </Link>
          {playlist.role === "inbox" && <Tag tone="cool">suggestions</Tag>}
          {!playlist.isPublic && <Tag>private</Tag>}
          {playlist.hidden && <Tag tone="cool">off /music</Tag>}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-ink-faint">
          <span className="tabular-nums">{playlist.trackCount} songs</span>
          {playlist.sequencedAt ? (
            <span>
              shaped {formatAgo(playlist.sequencedAt)}
              {playlist.drift ? ` · ${playlist.drift} adrift` : " · applied"}
            </span>
          ) : (
            <span className="text-ink-faint/70">never shaped</span>
          )}
        </div>
      </div>

      <div className="flex flex-none items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {playlist.isPublic && (
          <Button onClick={onToggleHidden} title="show or hide on the public /music page">
            {playlist.hidden ? "show" : "hide"}
          </Button>
        )}
        <Link href={`/music/manage/sort?kind=playlist&playlist=${playlist.id}`}>
          <Button>sort</Button>
        </Link>
        <Link href={`/music/manage/playlist/${playlist.id}`}>
          <Button tone="warm">shape</Button>
        </Link>
      </div>
    </Sheet>
  );
}
