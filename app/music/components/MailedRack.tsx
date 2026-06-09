"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import { Doodle, HandNote } from "@/app/components/sketchbook";
import { chaosFor } from "@/app/lib/chaos";

type RecentSuggestion = {
  id: string;
  title: string;
  artist: string;
  created_at: string;
};

// The "recently mailed" rack — a thin shelf of cassette spines, the music-wall
// sibling to the Turtle Gallery. Anonymous, album-art-free, newest first.
export default function MailedRack() {
  const [items, setItems] = useState<RecentSuggestion[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/suggest/recent?limit=14", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { suggestions?: RecentSuggestion[] };
      setItems(data.suggestions ?? []);
    } catch {
      // Stay quiet — the rack is a bonus, not core function.
    }
  }, []);

  useEffect(() => {
    void load();
    // SideB dispatches this after a successful mail, mirroring TurtleGallery's
    // "turtle:new" listener, so a fresh spine appears without a reload.
    const onNew = () => void load();
    window.addEventListener("suggest:new", onNew);
    return () => window.removeEventListener("suggest:new", onNew);
  }, [load]);

  // Nothing yet (or the table is absent) → quiet empty state.
  if (items !== null && items.length === 0) {
    return (
      <div className="mt-6 flex items-center gap-2 border-t border-dashed border-line pt-4">
        <Doodle name="squiggle" tone="purple" className="h-3 w-12" strokeWidth={2} />
        <HandNote tone="rust" rotate={-1} className="text-base text-ink-faint">
          no suggestions yet — be the first to leave me one.
        </HandNote>
      </div>
    );
  }

  if (items === null) return null;

  return (
    <div className="mt-6 border-t border-dashed border-line pt-4">
      <div className="mb-2.5 flex items-center gap-2">
        <HandNote tone="purple" rotate={-2} className="text-base">
          recently suggested
        </HandNote>
        <Doodle name="squiggle" tone="purple" className="h-3 w-14" strokeWidth={2} />
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((s, i) => {
          const c = chaosFor(s.id);
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
              style={{ transform: `rotate(${c.rotate * 0.6}deg)` }}
              title={`${s.title} — ${s.artist}`}
              className="max-w-[10rem] rounded-[3px] border border-line bg-card px-2 py-1 shadow-paper"
            >
              <span className="block truncate font-hand text-sm leading-tight text-ink">
                {s.title}
              </span>
              <span className="block truncate font-mono text-[0.55rem] uppercase tracking-[0.12em] text-ink-faint">
                {s.artist}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
