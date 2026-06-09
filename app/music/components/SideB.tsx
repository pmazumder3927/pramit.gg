"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import {
  Doodle,
  HandNote,
  PaperClip,
  RuledPaper,
  Stamp,
  Tape,
  TornEdge,
} from "@/app/components/sketchbook";
import CassetteReels from "@/app/music/components/CassetteReels";
import MailedRack from "@/app/music/components/MailedRack";
import SideBResultRow, {
  type SideBTrack,
} from "@/app/music/components/SideBResultRow";

type Phase = "idle" | "posting" | "filed" | "received";
type StampKind = "filed" | "duplicate" | null;

const DEBOUNCE_MS = 250;
const MIN_POSTING_MS = 1_400;
const FILED_HOLD_MS = 1_700;
const RECEIVED_HOLD_MS = 3_400;
const NOTE_MAX = 140;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function SideB() {
  const reduce = useReducedMotion();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SideBTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const [chosen, setChosen] = useState<SideBTrack | null>(null);
  const [note, setNote] = useState("");

  const [phase, setPhase] = useState<Phase>("idle");
  const [stampKind, setStampKind] = useState<StampKind>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const [dropDistance, setDropDistance] = useState(420);

  const busy = phase !== "idle";

  // ── preview audio (single clip at a time) ──────────────────────────
  useEffect(() => {
    const audio = new Audio();
    audio.addEventListener("ended", () => setPreviewingId(null));
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, []);

  const stopPreview = () => {
    audioRef.current?.pause();
    setPreviewingId(null);
  };

  const togglePreview = (track: SideBTrack) => {
    const audio = audioRef.current;
    if (!audio || !track.previewUrl) return;
    if (previewingId === track.id) {
      audio.pause();
      setPreviewingId(null);
      return;
    }
    audio.src = track.previewUrl;
    void audio.play().then(
      () => setPreviewingId(track.id),
      () => setPreviewingId(null)
    );
  };

  // ── debounced, abortable search (only while no track is chosen) ─────
  useEffect(() => {
    if (chosen) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/spotify/suggest/search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = (await res.json()) as { tracks?: SideBTrack[] };
        setResults(data.tracks ?? []);
        setActiveIndex(0);
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") setResults([]);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, chosen]);

  const selectTrack = (track: SideBTrack) => {
    stopPreview();
    setChosen(track);
    setResults([]);
    setQuery("");
    setErrorMsg(null);
  };

  const pickDifferent = () => {
    setChosen(null);
    setNote("");
    setErrorMsg(null);
  };

  const reset = () => {
    setChosen(null);
    setNote("");
    setQuery("");
    setResults([]);
    setStampKind(null);
    setErrorMsg(null);
    setPhase("idle");
  };

  const handleSearchKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = results[activeIndex] ?? results[0];
      if (pick) selectTrack(pick);
    }
  };

  const submit = async () => {
    if (!chosen || busy) return;
    stopPreview();
    setErrorMsg(null);
    setStampKind(null);
    setDropDistance(cardRef.current?.offsetHeight ?? 420);
    setPhase("posting");

    const floor = sleep(MIN_POSTING_MS);
    let outcome: "filed" | "duplicate" | "error" = "error";
    try {
      const res = await fetch("/api/spotify/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: chosen.id,
          note: note.trim() || undefined,
        }),
      });
      if (res.ok) outcome = "filed";
      else if (res.status === 409) outcome = "duplicate";
      else outcome = "error";
    } catch {
      outcome = "error";
    }

    await floor;

    if (outcome === "error") {
      setPhase("idle"); // card springs back up, track preserved
      setErrorMsg("the mailbox jammed — try once more?");
      return;
    }

    setStampKind(outcome === "duplicate" ? "duplicate" : "filed");
    setPhase("filed");
    if (outcome === "filed") {
      window.dispatchEvent(new CustomEvent("suggest:new"));
    }

    await sleep(FILED_HOLD_MS);
    setPhase("received");
    await sleep(RECEIVED_HOLD_MS);
    reset();
  };

  const cardDown = !reduce && (phase === "posting" || phase === "filed");
  const tooLong = chosen
    ? `${chosen.artist} · ${chosen.title}`.length > 38
    : false;

  return (
    <div className="relative">
      {/* ── header (matches confessional / turtle headers) ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex items-center gap-2">
          <HandNote tone="purple" rotate={-3} className="text-2xl">
            make me a one-track mixtape
          </HandNote>
          <Doodle name="arrow" tone="purple" className="h-5 w-10" strokeWidth={3} />
        </div>
        <h2 className="mt-1 font-serif text-2xl font-medium text-ink md:text-3xl">
          leave a song on side b
        </h2>
        <p className="mt-1.5 max-w-md font-serif text-sm italic text-ink-soft">
          every visitor gets one song. search for it, watch it get written onto
          the tape, and i&apos;ll find it in my playlist &lsquo;beloved user
          suggestions&rsquo;. no skips, no takebacks.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <AnimatePresence mode="wait">
          {phase === "received" ? (
            <motion.div
              key="received"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative -rotate-[0.4deg] rounded-[3px] border border-line bg-card p-10 text-center shadow-paper-lg"
            >
              <Tape tone="purple" rotate={-4} className="-top-3 left-1/2 -translate-x-1/2" width={90} />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                className="mx-auto mb-3 w-fit"
              >
                <Stamp tone="rust" rotate={-6}>
                  {stampKind === "duplicate"
                    ? "already on side b"
                    : "filed · beloved user suggestions"}
                </Stamp>
              </motion.div>
              <h3 className="font-serif text-lg font-medium text-ink">
                {stampKind === "duplicate"
                  ? "great minds"
                  : "side b is in my hands now"}
              </h3>
              <p className="mt-1 font-hand text-lg text-accent-rust">
                {stampKind === "duplicate"
                  ? "i’ve already got this one. you’ve got taste."
                  : "thank you for the song. i’ll hear you in it."}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="cassette"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative overflow-hidden rounded-[3px]"
            >
              {/* the cassette J-card */}
              <motion.div
                ref={cardRef}
                animate={{ y: cardDown ? dropDistance : 0 }}
                transition={
                  cardDown
                    ? { duration: MIN_POSTING_MS / 1000, ease: [0.4, 0, 0.6, 1] }
                    : { type: "spring", stiffness: 220, damping: 22 }
                }
                className="relative -rotate-[0.6deg] rounded-[3px] border border-line bg-card shadow-paper-lg"
              >
                <Tape tone="purple" rotate={-3} className="-top-3 left-10" width={90} />
                <Tape tone="orange" rotate={4} className="-top-3 right-10" width={90} />
                <PaperClip
                  className="-top-4 right-1/2 translate-x-1/2 md:right-16 md:translate-x-0"
                  rotate={8}
                  tone="ink"
                />
                <TornEdge position="bottom" />

                <div className="p-5 md:p-7">
                  {/* top strip — labels + reels */}
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <Stamp tone="ink" rotate={-3}>
                      side b · for pramit
                    </Stamp>
                    <CassetteReels spinning={previewingId !== null} />
                    <Stamp tone="rust" rotate={3} className="hidden sm:inline-flex">
                      c-60
                    </Stamp>
                  </div>

                  {/* tracklist surface */}
                  <RuledPaper
                    variant="ruled"
                    margin
                    className="rounded-[3px] border border-line bg-paper-2/50 px-4 py-4 pl-12 sm:pl-16"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="shrink-0 font-mono text-xs text-ink-faint">
                        A1.
                      </span>

                      {chosen ? (
                        <div className="min-w-0 flex-1">
                          <motion.div
                            key={chosen.id}
                            initial={{ clipPath: "inset(0 100% 0 0)" }}
                            animate={{ clipPath: "inset(0 0% 0 0)" }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className={`relative block truncate ${
                              tooLong
                                ? "font-serif text-base text-ink"
                                : "font-hand text-xl text-accent-rust"
                            }`}
                          >
                            {chosen.artist} · {chosen.title}
                          </motion.div>
                          <Doodle
                            key={`u-${chosen.id}`}
                            name="underline"
                            tone="rust"
                            draw
                            strokeWidth={3}
                            className="mt-0.5 block h-2 w-full max-w-[16rem]"
                          />
                        </div>
                      ) : (
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          onKeyDown={handleSearchKeys}
                          disabled={busy}
                          placeholder="hum it, name it, paste it — what's on side b?"
                          autoComplete="off"
                          aria-label="search for a song to suggest"
                          className="min-w-0 flex-1 border-0 bg-transparent p-0 font-hand text-lg text-ink placeholder:text-ink-faint focus:outline-none focus:ring-0"
                        />
                      )}
                    </div>

                    {/* prompt / caret state */}
                    {!chosen && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Doodle name="arrow" tone="rust" className="h-3 w-6 rotate-[8deg]" strokeWidth={2.5} />
                        <HandNote tone="rust" rotate={-1} className="text-base text-ink-faint">
                          {searching
                            ? "rummaging through the crate..."
                            : "what should i put on side b?"}
                        </HandNote>
                      </div>
                    )}
                    {chosen && (
                      <div className="mt-2 flex items-center gap-3">
                        <HandNote tone="purple" rotate={-1} className="text-base text-ink-faint">
                          one song. make it count.
                        </HandNote>
                        <button
                          type="button"
                          onClick={pickDifferent}
                          disabled={busy}
                          className="font-hand text-base text-ink-faint underline decoration-dashed decoration-line underline-offset-4 transition-colors hover:text-accent-orange disabled:opacity-40"
                        >
                          pick a different one
                        </button>
                      </div>
                    )}
                  </RuledPaper>

                  {/* the tucked album art (the pick, clipped into the card) */}
                  <AnimatePresence>
                    {chosen?.albumImageUrl && (
                      <motion.div
                        key={`art-${chosen.id}`}
                        initial={{ opacity: 0, scale: 0.6, rotate: 10 }}
                        animate={{ opacity: 1, scale: 1, rotate: -3 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        transition={{ type: "spring", stiffness: 180, damping: 16 }}
                        className="pointer-events-none absolute right-4 top-16 z-10 h-14 w-14 sm:right-6"
                      >
                        <Tape tone="orange" rotate={-12} width={26} className="-top-1.5 left-1/2 -translate-x-1/2" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={chosen.albumImageUrl}
                          alt=""
                          className="h-full w-full border border-ink/10 bg-paper-2 object-cover shadow-paper"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* result stack (only while searching, no pick yet) */}
                  {!chosen && results.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                      {results.map((track, i) => (
                        <SideBResultRow
                          key={track.id}
                          track={track}
                          index={i}
                          active={i === activeIndex}
                          previewing={previewingId === track.id}
                          onSelect={() => selectTrack(track)}
                          onTogglePreview={() => togglePreview(track)}
                        />
                      ))}
                    </div>
                  )}

                  {/* optional liner note */}
                  {chosen && (
                    <div className="mt-4">
                      <HandNote tone="rust" rotate={-1} className="mb-1 block text-base">
                        a line about why? (optional · only i&apos;ll read it)
                      </HandNote>
                      <input
                        value={note}
                        onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
                        disabled={busy}
                        placeholder="it reminds me of..."
                        className="w-full rounded-[3px] border-[1.4px] border-line bg-paper-2/50 px-3 py-2 font-serif text-sm text-ink placeholder:text-ink-faint focus:border-accent-rust/50 focus:outline-none"
                      />
                    </div>
                  )}

                  {errorMsg && (
                    <p className="mt-3 font-hand text-base text-accent-rust">
                      {errorMsg}
                    </p>
                  )}

                  {/* the mailbox slot + submit */}
                  <div className="mt-5">
                    <motion.button
                      onClick={submit}
                      disabled={!chosen || busy}
                      whileHover={{ scale: chosen && !busy ? 1.01 : 1 }}
                      whileTap={{ scale: chosen && !busy ? 0.99 : 1 }}
                      className="btn-sketch btn-sketch-solid w-full justify-center !py-3 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {chosen ? "drop it in the mailbox ↓" : "pick a song first"}
                    </motion.button>
                    {/* slot mouth */}
                    <div className="mt-2 flex items-center justify-center gap-1.5">
                      <span className="h-px w-10 bg-line" />
                      <span className="h-[3px] w-24 rounded-full bg-ink/25" />
                      <span className="h-px w-10 bg-line" />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* FILED / dupe stamp — thunks in once the card is through the slot */}
              <AnimatePresence>
                {phase === "filed" && stampKind && (
                  <motion.div
                    key="stamp"
                    initial={{ scale: 0, rotate: -6, opacity: 0 }}
                    animate={{ scale: 1, rotate: -6, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 12 }}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                  >
                    <Stamp tone="rust" rotate={-6} className="!text-xs">
                      {stampKind === "duplicate"
                        ? "already on side b"
                        : "filed · beloved user suggestions"}
                    </Stamp>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <MailedRack />
    </div>
  );
}
