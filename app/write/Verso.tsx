"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { format } from "date-fns";
import {
  CardSize,
  Post,
  analyzeContent,
  generateSlug,
} from "@/app/lib/supabase";
import { POST_TYPE_META } from "@/app/lib/postTypes";
import { Stamp, HandNote } from "@/app/components/sketchbook";
import { useUpload } from "@/app/lib/use-upload";
import SealButton from "./SealButton";
import { Caps, Working } from "./lib/types";

const SIZES: { value: "" | CardSize; label: string }[] = [
  { value: "", label: "random" },
  { value: "massive", label: "massive" },
  { value: "hero", label: "hero" },
  { value: "large", label: "large" },
  { value: "medium", label: "medium" },
  { value: "small", label: "small" },
  { value: "tiny", label: "tiny" },
  { value: "micro", label: "micro" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-ink-faint">
      {children}
    </p>
  );
}

const inputCls =
  "w-full rounded-md border border-line bg-paper-2/60 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent-rust focus:outline-none focus-visible:ring-0";

// The back of the page: everything readers never see on the sheet itself —
// shelf presence, link-preview blurb, soundtrack, the url — plus the seal.
export default function Verso({
  open,
  onClose,
  working,
  setField,
  post,
  caps,
  isPublished,
  differs,
  busy,
  tagVocabulary,
  onPublish,
  onSetPage,
  onUnpublish,
  onRecutSlug,
  onRefusePublish,
}: {
  open: boolean;
  onClose: () => void;
  working: Working;
  setField: <K extends keyof Working>(key: K, value: Working[K]) => void;
  post: Post | null;
  caps: Caps;
  isPublished: boolean;
  differs: boolean;
  busy: boolean;
  tagVocabulary: string[];
  onPublish: () => void;
  onSetPage: () => void;
  onUnpublish: () => void;
  onRecutSlug: (slug: string) => void;
  onRefusePublish: () => void;
}) {
  const { upload, uploading } = useUpload();
  const metaFileRef = useRef<HTMLInputElement>(null);
  const [recutOpen, setRecutOpen] = useState(false);
  const [recutValue, setRecutValue] = useState("");

  // ------------------------------------------------- the ghost fills the back
  // One press: the ghost reads the entry and inks in the blurb, tags and a
  // cover pick. Everything it touches is held for "put it back" — the press
  // is the owner's hand, the undo keeps it honest.
  const [ghostBusy, setGhostBusy] = useState(false);
  const [ghostErr, setGhostErr] = useState<string | null>(null);
  const [ghostFill, setGhostFill] = useState<{
    prev: Pick<Working, "description" | "tags" | "meta_image">;
    added: string[];
  } | null>(null);
  const ghostAbort = useRef<AbortController | null>(null);
  // the fields stay editable while the ghost reads — the async closure must
  // see the freshest ink, not the render it was born in
  const workingNow = useRef(working);
  useEffect(() => {
    workingNow.current = working;
  }, [working]);

  // tuck the slip away → the offer stands as accepted; transient state rests
  useEffect(() => {
    if (!open) {
      ghostAbort.current?.abort();
      setGhostBusy(false);
      setGhostErr(null);
      setGhostFill(null);
    }
  }, [open]);

  const summonVerso = async () => {
    if (ghostBusy) return;
    setGhostErr(null);
    setGhostBusy(true);
    const controller = new AbortController();
    ghostAbort.current = controller;
    try {
      const res = await fetch("/api/write/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          kind: "verso",
          title: working.title,
          type: working.type,
          tags: working.tags,
          content: working.content,
          tagVocabulary,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error || "the ghost lost its train of thought — try again"
        );
      }
      const now = workingNow.current;
      const prev = {
        description: now.description,
        tags: now.tags,
        meta_image: now.meta_image,
      };
      if (typeof data.description === "string" && data.description.trim()) {
        setField("description", data.description.trim());
      }
      // the owner's own tags stand; the ghost's only join the end
      const incoming: string[] = Array.isArray(data.tags) ? data.tags : [];
      const merged = [...now.tags];
      const added: string[] = [];
      for (const t of incoming) {
        if (typeof t === "string" && t && !merged.includes(t)) {
          merged.push(t);
          added.push(t);
        }
      }
      if (added.length) setField("tags", merged);
      // never stomp a cover the owner chose — only fill an empty frame
      if (!now.meta_image && typeof data.imageUrl === "string" && data.imageUrl) {
        setField("meta_image", data.imageUrl);
      }
      setGhostFill({ prev, added });
    } catch (err) {
      if (!controller.signal.aborted) {
        setGhostErr(
          err instanceof Error
            ? err.message
            : "the ghost lost its train of thought — try again"
        );
      }
    } finally {
      setGhostBusy(false);
    }
  };

  const putBack = () => {
    if (!ghostFill) return;
    setField("description", ghostFill.prev.description);
    setField("tags", ghostFill.prev.tags);
    setField("meta_image", ghostFill.prev.meta_image);
    setGhostFill(null);
  };

  const slugPreview = isPublished
    ? post?.slug
    : post && !/^untitled-/.test(post.slug || "")
      ? post.slug
      : generateSlug(working.title) || "…";

  const preview = analyzeContent(working.content || "");
  const blurb = working.description || preview.previewText || "…";
  const typeMeta = POST_TYPE_META[working.type] ?? POST_TYPE_META.note;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6"
          style={{ background: "rgb(var(--bg) / 0.72)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 48, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-lg border border-line bg-card px-5 py-6 shadow-paper-lg sm:max-w-2xl sm:rounded-md sm:px-8 sm:py-8"
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Stamp tone="ink" rotate={-3}>
                  verso
                </Stamp>
                <HandNote tone="purple" rotate={-2} className="text-xl">
                  the back of the page —
                </HandNote>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="font-hand text-xl text-ink-faint transition-colors hover:text-accent-rust"
              >
                tuck it away
              </button>
            </div>

            <div className="space-y-6">
              {/* the ghost fills this side — blurb, tags, a cover pick */}
              <div className="-mt-1">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <button
                    type="button"
                    onClick={() => void summonVerso()}
                    disabled={ghostBusy}
                    className="font-hand text-lg text-ink-soft transition-colors hover:text-accent-orange disabled:opacity-60"
                  >
                    {ghostBusy
                      ? "the ghost is reading the entry…"
                      : "let the ghost fill this side ✦"}
                  </button>
                  {ghostFill && !ghostBusy && (
                    <button
                      type="button"
                      onClick={putBack}
                      className="font-hand text-lg text-ink-faint transition-colors hover:text-accent-rust"
                    >
                      put it back ↩
                    </button>
                  )}
                </div>
                {ghostErr && (
                  <p className="mt-1 font-hand text-lg text-accent-rust">
                    {ghostErr}
                  </p>
                )}
                {ghostFill && !ghostBusy && ghostFill.added.length > 0 && (
                  <p className="mt-1 font-hand text-base text-ink-faint">
                    it also picked up{" "}
                    <span className="text-accent-purple">
                      {ghostFill.added.map((t) => `#${t}`).join(" ")}
                    </span>{" "}
                    for the entry&apos;s header
                  </p>
                )}
              </div>

              {/* blurb + live shelf ghost */}
              <div>
                <FieldLabel>the blurb — cards &amp; link previews</FieldLabel>
                <textarea
                  rows={2}
                  value={working.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="a line or two for the shelf and link unfurls…"
                  className={`${inputCls} resize-none`}
                />
                <div className="mt-3 flex justify-center">
                  <div
                    className="sketch-card w-64 p-4"
                    style={{ transform: "rotate(-1.2deg)" }}
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${typeMeta.badge}`}
                      >
                        {typeMeta.label}
                      </span>
                      <span className="font-hand text-sm text-ink-faint">
                        {format(
                          new Date(post?.created_at ?? Date.now()),
                          "MMM ''yy"
                        ).toLowerCase()}
                      </span>
                    </div>
                    <p className="font-serif text-base font-medium leading-snug text-ink line-clamp-2">
                      {working.title || "untitled, for now"}
                    </p>
                    <p className="mt-1 font-serif text-xs italic leading-snug text-ink-soft line-clamp-2">
                      {blurb}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-center font-hand text-base text-ink-faint">
                  ↑ how it sits on the shelf
                </p>
              </div>

              {/* size */}
              <div>
                <FieldLabel>card size on the front page</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {SIZES.map((s) => {
                    const active = working.display_size === s.value;
                    return (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => setField("display_size", s.value)}
                        className={`rounded-full border px-3.5 py-1 text-xs transition-colors ${
                          active
                            ? "border-ink bg-ink text-paper"
                            : "border-line text-ink-soft hover:border-ink/40"
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* pin */}
              <div className="flex items-center justify-between">
                <FieldLabel>pinned to the front</FieldLabel>
                <button
                  type="button"
                  role="switch"
                  aria-checked={working.is_pinned}
                  onClick={() => setField("is_pinned", !working.is_pinned)}
                  className="flex items-center gap-2"
                >
                  <svg
                    width="20"
                    height="34"
                    viewBox="0 0 40 68"
                    fill="none"
                    className="transition-transform duration-300"
                    style={{
                      transform: working.is_pinned
                        ? "rotate(12deg)"
                        : "rotate(-4deg)",
                    }}
                  >
                    <path
                      d="M27 12v34a9 9 0 1 1-18 0V14a6 6 0 0 1 12 0v30a3 3 0 1 1-6 0V18"
                      stroke={
                        working.is_pinned
                          ? "rgb(var(--accent-orange))"
                          : "rgb(var(--fg-faint) / 0.6)"
                      }
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span
                    className={`font-hand text-lg ${
                      working.is_pinned ? "text-accent-orange" : "text-ink-faint"
                    }`}
                  >
                    {working.is_pinned ? "clipped on" : "not clipped"}
                  </span>
                </button>
              </div>

              {/* soundtrack */}
              <div>
                <FieldLabel>soundtrack / embed — youtube or soundcloud</FieldLabel>
                <input
                  type="text"
                  value={working.media_url}
                  onChange={(e) => setField("media_url", e.target.value)}
                  placeholder="https://…"
                  className={inputCls}
                />
              </div>

              {/* meta image */}
              <div>
                <FieldLabel>cover for link previews</FieldLabel>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={working.meta_image}
                    onChange={(e) => setField("meta_image", e.target.value)}
                    placeholder="https://… (or upload)"
                    className={inputCls}
                  />
                  <input
                    ref={metaFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      try {
                        const up = await upload(file);
                        setField("meta_image", up.url);
                      } catch {
                        /* the input keeps its old value; nothing lost */
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => metaFileRef.current?.click()}
                    className="shrink-0 rounded-md border border-line px-3 py-2 text-xs text-ink-soft transition-colors hover:border-ink/40"
                  >
                    {uploading ? "inking…" : "upload"}
                  </button>
                </div>
              </div>

              {/* the url */}
              <div>
                <FieldLabel>lives at</FieldLabel>
                <p className="font-mono text-sm text-ink-soft">
                  /post/<span className="text-ink">{slugPreview}</span>
                  {!isPublished && (
                    <span className="ml-2 font-hand text-base text-ink-faint">
                      — set in ink at first publish
                    </span>
                  )}
                </p>
                {isPublished && (
                  <div className="mt-2">
                    {!recutOpen ? (
                      <button
                        type="button"
                        onClick={() => {
                          setRecutValue(post?.slug || "");
                          setRecutOpen(true);
                        }}
                        className="font-hand text-base text-ink-faint transition-colors hover:text-accent-rust"
                      >
                        re-cut the url ✂
                      </button>
                    ) : (
                      <div className="rounded-md border border-dashed border-accent-rust/50 bg-accent-rust/[0.06] p-3">
                        <p className="mb-2 font-hand text-lg text-accent-rust">
                          this breaks the old link. people may be holding it.
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={recutValue}
                            onChange={(e) => setRecutValue(e.target.value)}
                            className={inputCls}
                          />
                          <button
                            type="button"
                            disabled={
                              !generateSlug(recutValue) ||
                              generateSlug(recutValue) === post?.slug
                            }
                            onClick={() => {
                              onRecutSlug(generateSlug(recutValue));
                              setRecutOpen(false);
                            }}
                            className="shrink-0 rounded-md border border-accent-rust px-3 py-2 text-xs text-accent-rust transition-colors hover:bg-accent-rust/10 disabled:opacity-40"
                          >
                            re-cut
                          </button>
                          <button
                            type="button"
                            onClick={() => setRecutOpen(false)}
                            className="shrink-0 rounded-md border border-line px-3 py-2 text-xs text-ink-soft"
                          >
                            leave it
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* the seal */}
              <div className="border-t border-dashed border-line pt-6">
                {!isPublished ? (
                  <div className="flex flex-col items-center gap-2">
                    <SealButton
                      label="publish this entry"
                      disabled={!working.title.trim()}
                      busy={busy}
                      onSealed={onPublish}
                      onRefused={onRefusePublish}
                    />
                    <HandNote tone="rust" rotate={-2} className="text-base">
                      {working.title.trim()
                        ? "hold the stamp down — let the ink take"
                        : "give it a title first ✎"}
                    </HandNote>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <SealButton
                      label="set the page"
                      disabled={!differs}
                      busy={busy}
                      onSealed={onSetPage}
                      onRefused={() => {}}
                    />
                    <HandNote tone="rust" rotate={-2} className="text-base">
                      {differs
                        ? caps.draft
                          ? "your kept changes go to print"
                          : "presses everything on this device into print"
                        : "the print already matches"}
                    </HandNote>
                    <button
                      type="button"
                      onClick={onUnpublish}
                      className="font-hand text-base text-ink-faint transition-colors hover:text-accent-rust"
                    >
                      pull it back to drafts
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
