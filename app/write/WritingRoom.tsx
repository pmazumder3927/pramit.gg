"use client";

// the writing room — "ghost light"
//
// House dark, one warm sheet lit. The owner types directly on the journal
// page readers will hold (same measure, same paper, same stamps); everything
// around the sheet — chrome, save status, field notes, the verso — stays
// backstage: mono, terse, ink-faint. Preview is a proof of the REAL page
// (PostContent), publishing is a press-and-hold seal and a wet-ink ceremony.
//
// Saving: localStorage on every change, server autosave ~2.5s after the pen
// rests. Published posts never autosave into the live row — changes go to the
// posts.draft working copy (or stay on this device if the migration hasn't
// been applied) until "set the page".

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { format, formatDistanceToNow } from "date-fns";
import { Post } from "@/app/lib/supabase";
import { POST_TYPES, POST_TYPE_META } from "@/app/lib/postTypes";
import {
  Doodle,
  HandNote,
  PaperClip,
  Stamp,
  TornEdge,
} from "@/app/components/sketchbook";
import PostContent from "@/app/post/[id]/PostContent";
import { acceptsFile, markdownFor, useUpload } from "@/app/lib/use-upload";
import {
  countWords,
  handleEnter,
  handleTab,
  insertFootnote,
  insertLink,
  insertText,
  isInsideCode,
  isPlatformMod,
  isSoundtrackUrl,
  isUrl,
  parseOutline,
  replaceToken,
  wrapSelection,
} from "./lib/editor-core";
import { keepCaretComfortable, keyboardInset } from "./lib/caret";
import {
  Caps,
  Revision,
  SaveStatus,
  Working,
  clearLocal,
  printedFrom,
  readLocal,
  workingEqual,
  workingFrom,
  writeLocal,
} from "./lib/types";
import Verso from "./Verso";
import { GhostOverlay, GhostPalette, useGhostCompletion } from "./Ghost";

type NoticeAction = { label: string; onClick?: () => void; href?: string };
type Notice = { id: number; text: string; actions?: NoticeAction[] };

type CeremonyPhase = "idle" | "inking" | "stamped" | "done";

const lowTime = (d: Date | number) => format(d, "h:mm a").toLowerCase();

export default function WritingRoom({
  initialPost,
  initialCaps,
  tagVocabulary,
}: {
  initialPost: Post | null;
  initialCaps: Caps;
  tagVocabulary: string[];
}) {
  // ---------------------------------------------------------------- state
  const [post, setPost] = useState<Post | null>(initialPost);
  const [caps, setCaps] = useState<Caps>(initialCaps);
  const [working, setWorking] = useState<Working>(() =>
    workingFrom(initialPost)
  );
  const [status, setStatus] = useState<SaveStatus>(() => {
    if (!initialPost) return "blank";
    if (!initialPost.is_draft && initialPost.draft) return "kept";
    return "dry";
  });
  const [savedAt, setSavedAt] = useState<Date | null>(
    initialPost ? new Date(initialPost.updated_at) : null
  );
  const [mode, setMode] = useState<"write" | "proof">("write");
  const [versoOpen, setVersoOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [ceremony, setCeremony] = useState<{
    phase: CeremonyPhase;
    label: string;
    slug: string;
  }>({ phase: "idle", label: "", slug: "" });
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [marksOpen, setMarksOpen] = useState(false);
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tagFocus, setTagFocus] = useState(false);
  const [caretIndex, setCaretIndex] = useState(0);
  const [titleShaking, setTitleShaking] = useState(false);
  const [kbInset, setKbInset] = useState(0);
  const [ghostOn, setGhostOn] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteSelection, setPaletteSelection] = useState("");

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const proofRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const workingRef = useRef(working);
  const postRef = useRef(post);
  const capsRef = useRef(caps);
  const statusRef = useRef(status);
  const saveTimer = useRef<number | null>(null);
  const inFlight = useRef(false);
  const flushAgain = useRef(false);
  const flushPromise = useRef<Promise<void> | null>(null);
  const hydrated = useRef(false);
  const noticeCounter = useRef(0);
  const uploadCounter = useRef(0);
  const sessionStart = useRef(countWords(workingFrom(initialPost).content));
  const proofReturn = useRef<{ sel: number; scroll: number } | null>(null);
  const preRestore = useRef<Working | null>(null);
  const caretRaf = useRef(0);
  const railH = useRef(0);
  const composingRef = useRef(false);
  const paletteSel = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  useEffect(() => {
    workingRef.current = working;
  }, [working]);
  useEffect(() => {
    postRef.current = post;
  }, [post]);
  useEffect(() => {
    capsRef.current = caps;
  }, [caps]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const { upload, uploading, progress } = useUpload();

  // Adopt a server row NOW, not on the next render — a queued flush reads
  // postRef synchronously and must never see a stale null (double-create) or
  // a stale updated_at (false conflict).
  const adoptPost = useCallback((p: Post) => {
    postRef.current = p;
    setPost(p);
    setSavedAt(new Date(p.updated_at));
  }, []);

  // ----------------------------------------------------------- the ghost
  useEffect(() => {
    try {
      setGhostOn(localStorage.getItem("writing-room:ghost") !== "0");
    } catch {
      /* default stands */
    }
  }, []);
  const toggleGhost = useCallback(() => {
    setGhostOn((on) => {
      try {
        localStorage.setItem("writing-room:ghost", on ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !on;
    });
  }, []);

  const ghost = useGhostCompletion({
    enabled: ghostOn && mode === "write" && !versoOpen && !paletteOpen,
    bodyRef,
    workingRef,
    content: working.content,
    caretIndex,
    composingRef,
  });

  const openPalette = useCallback(() => {
    const ta = bodyRef.current;
    if (ta) {
      paletteSel.current = { start: ta.selectionStart, end: ta.selectionEnd };
      setPaletteSelection(ta.value.slice(ta.selectionStart, ta.selectionEnd));
    } else {
      setPaletteSelection("");
    }
    setPaletteOpen(true);
  }, []);

  const insertFromPalette = useCallback(
    (text: string, replaceSelection: boolean) => {
      const ta = bodyRef.current;
      if (!ta) return;
      ta.focus();
      const { start, end } = paletteSel.current;
      if (replaceSelection && end > start) {
        ta.setSelectionRange(start, end);
        insertText(ta, text);
      } else {
        const at = Math.min(end, ta.value.length);
        ta.setSelectionRange(at, at);
        let final = text;
        // paragraphs land on their own lines, like a hand would place them
        if (/\n/.test(text) || text.length > 120) {
          if (at > 0 && ta.value[at - 1] !== "\n") final = `\n\n${final.replace(/^\n+/, "")}`;
          if (at < ta.value.length && ta.value[at] !== "\n") final = `${final.replace(/\n+$/, "")}\n\n`;
        }
        insertText(ta, final);
      }
      setCaretIndex(ta.selectionStart);
      keepCaretComfortable(ta);
    },
    []
  );

  const isPublished = !!post && !post.is_draft;
  const differs = useMemo(
    () => (isPublished && post ? !workingEqual(working, printedFrom(post)) : false),
    [isPublished, post, working]
  );

  const setField = useCallback(
    <K extends keyof Working>(key: K, value: Working[K]) => {
      setWorking((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const flashNote = useCallback((text: string, actions?: NoticeAction[]) => {
    const id = ++noticeCounter.current;
    setNotice({ id, text, actions });
    if (!actions) {
      window.setTimeout(() => {
        setNotice((n) => (n && n.id === id ? null : n));
      }, 3600);
    }
  }, []);

  // ---------------------------------------------------------------- saving
  const flush = useCallback(
    async (keepalive = false): Promise<void> => {
      if (inFlight.current) {
        flushAgain.current = true;
        return flushPromise.current ?? undefined;
      }
      const current = postRef.current;
      const snapshot = workingRef.current;
      const isPub = !!current && !current.is_draft;
      if (isPub && !capsRef.current.draft) return; // device-only mode
      if (!current && !snapshot.title.trim() && !snapshot.content.trim()) {
        setStatus("blank");
        return;
      }
      // refuse no-op saves: a stale timer firing right after publish would
      // otherwise write a ghost working-copy identical to the fresh print
      if (current) {
        const baseline = current.is_draft
          ? workingFrom(current)
          : printedFrom(current);
        if (workingEqual(snapshot, baseline)) {
          setStatus(!current.is_draft && current.draft ? "kept" : "dry");
          return;
        }
      }
      inFlight.current = true;
      const run = (async () => {
      try {
        const patchBody = current
          ? JSON.stringify({
              fields: snapshot,
              baseUpdatedAt: current.updated_at,
            })
          : JSON.stringify({ fields: snapshot });
        const res = current
          ? await fetch(`/api/dashboard/posts/${current.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              // keepalive caps the body at ~64KiB — a long entry would reject
              // outright, so only ask for it when the payload fits
              keepalive: keepalive && patchBody.length < 60_000,
              body: patchBody,
            })
          : await fetch(`/api/dashboard/posts`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              keepalive: keepalive && patchBody.length < 60_000,
              body: patchBody,
            });

        if (res.status === 401) {
          setStatus("offline");
          flashNote("the shelf doesn't recognize you — sign in again", [
            { label: "sign in", href: "/api/auth/login" },
          ]);
          return;
        }
        if (res.status === 409) {
          const data = await res.json().catch(() => ({}));
          if (data.error === "conflict" && data.post) {
            const theirs: Post = data.post;
            flashNote("this page was inked somewhere else —", [
              {
                label: "keep mine",
                onClick: () => {
                  adoptPost(theirs); // their updated_at becomes the new base
                  setNotice(null);
                  void flush();
                },
              },
              {
                label: "load theirs",
                onClick: () => {
                  adoptPost(theirs);
                  setWorking(workingFrom(theirs));
                  setStatus("dry");
                  setNotice(null);
                },
              },
            ]);
          } else {
            setStatus("local");
          }
          return;
        }
        if (!res.ok) throw new Error("save failed");

        const data = await res.json();
        if (data.caps) {
          capsRef.current = data.caps;
          setCaps(data.caps);
        }
        const saved: Post = data.post;
        if (!current) {
          // mirror the FRESHEST state under the new id (keystrokes may have
          // landed while the create was in flight), then retire the 'new' key
          writeLocal(saved.id, workingRef.current);
          clearLocal(null);
          window.history.replaceState(null, "", `/write/${saved.id}`);
        }
        adoptPost(saved);
        if (workingEqual(workingRef.current, snapshot)) {
          setStatus(isPub ? "kept" : "dry");
        }
      } catch {
        setStatus("offline");
      } finally {
        inFlight.current = false;
        if (flushAgain.current) {
          flushAgain.current = false;
          void flush();
        }
      }
      })();
      flushPromise.current = run;
      return run;
    },
    [flashNote, adoptPost]
  );

  // every change: local mirror immediately, server after the pen rests
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    writeLocal(postRef.current?.id ?? null, working);
    if (postRef.current && !postRef.current.is_draft && !capsRef.current.draft) {
      setStatus("local");
      return;
    }
    setStatus("drying");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void flush(), 2500);
  }, [working, flush]);

  // flush when the room loses the owner's attention
  useEffect(() => {
    const maybeFlush = () => {
      // never CREATE on the way out — a keepalive create the client can't
      // hear back from orphans a row; the words are safe in localStorage
      // and the next visit offers them back
      if (!postRef.current) return;
      if (statusRef.current === "drying" || statusRef.current === "offline") {
        void flush(true);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") maybeFlush();
    };
    window.addEventListener("blur", maybeFlush);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", maybeFlush);
    window.addEventListener("beforeunload", maybeFlush);
    return () => {
      window.removeEventListener("blur", maybeFlush);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", maybeFlush);
      window.removeEventListener("beforeunload", maybeFlush);
    };
  }, [flush]);

  // on open: does this device hold newer ink than the shelf?
  useEffect(() => {
    const id = initialPost?.id ?? null;
    const local = readLocal(id);
    if (!local) return;
    const baseline = workingFrom(initialPost);
    if (workingEqual(local.working, baseline)) return;
    const serverT = initialPost
      ? new Date(initialPost.updated_at).getTime()
      : 0;
    if (local.t > serverT + 1500) {
      flashNote(
        `this device has newer ink — from ${formatDistanceToNow(local.t, {
          addSuffix: true,
        })}. keep it?`,
        [
          {
            label: "use this one",
            onClick: () => {
              setWorking(local.working);
              setNotice(null);
            },
          },
          {
            label: "use the shelf's",
            onClick: () => {
              clearLocal(id);
              setNotice(null);
            },
          },
        ]
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------- keyboard
  const exitProof = useCallback((caretTarget: number | null) => {
    setMode("write");
    requestAnimationFrame(() => {
      const ta = bodyRef.current;
      if (!ta) return;
      if (caretTarget != null) {
        ta.focus();
        ta.setSelectionRange(caretTarget, caretTarget);
        setCaretIndex(caretTarget);
        keepCaretComfortable(ta);
      } else {
        window.scrollTo({ top: proofReturn.current?.scroll ?? 0 });
        const s = proofReturn.current?.sel ?? 0;
        ta.focus();
        ta.setSelectionRange(s, s);
      }
    });
  }, []);

  const toggleProof = useCallback(() => {
    if (mode === "write") {
      proofReturn.current = {
        sel: bodyRef.current?.selectionStart ?? 0,
        scroll: window.scrollY,
      };
      setMode("proof");
      window.scrollTo({ top: 0 });
    } else {
      exitProof(null);
    }
  }, [mode, exitProof]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return; // the sheet already answered this key
      // ⌘ on mac, ctrl elsewhere — treating ctrl as ⌘ on mac would hijack
      // native ctrl+e (end-of-line) mid-typing
      const mod = isPlatformMod(e);
      const key = e.key.toLowerCase();
      if (mod && key === "e") {
        e.preventDefault();
        if (mode === "proof") exitProof(null);
        else toggleProof();
      } else if (mod && key === "j") {
        e.preventDefault();
        if (paletteOpen) setPaletteOpen(false);
        else openPalette();
      } else if (mod && key === "s") {
        e.preventDefault();
        if (statusRef.current === "drying" || statusRef.current === "offline") {
          void flush();
        } else if (statusRef.current === "local") {
          flashNote("saved here — 'set the page' presses it into print");
        } else {
          flashNote("⌘s does nothing — it's already saved");
        }
      } else if (mod && e.key === "Enter") {
        e.preventDefault();
        setVersoOpen(true);
      } else if (e.key === "Escape") {
        if (paletteOpen) setPaletteOpen(false);
        else if (versoOpen) setVersoOpen(false);
        else if (revisionsOpen) setRevisionsOpen(false);
        else if (typePickerOpen) setTypePickerOpen(false);
        else if (mode === "proof") exitProof(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    mode,
    versoOpen,
    revisionsOpen,
    typePickerOpen,
    paletteOpen,
    openPalette,
    exitProof,
    toggleProof,
    flush,
    flashNote,
  ]);

  // keyboard inset for the mobile bar
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setKbInset(keyboardInset());
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // autogrow both writing surfaces. Collapsing to height:auto for the measure
  // momentarily shrinks the document, and the browser clamps the window scroll
  // — restore it before paint or every keystroke deep in a long entry yanks
  // the viewport.
  const measureGrowth = useCallback(() => {
    const y = window.scrollY;
    for (const ta of [titleRef.current, bodyRef.current]) {
      if (!ta) continue;
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    }
    if (window.scrollY !== y) window.scrollTo(0, y);
  }, []);

  useLayoutEffect(() => {
    measureGrowth();
  }, [working.title, working.content, mode, measureGrowth]);

  // wrapped line counts change with the viewport — re-measure on resize
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measureGrowth();
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [measureGrowth]);

  // a fresh page invites the pen (desktop only — no surprise keyboards)
  useEffect(() => {
    if (!initialPost && window.matchMedia("(pointer: fine)").matches) {
      titleRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------ uploading
  const uploadIntoBody = useCallback(
    async (file: File) => {
      const ta = bodyRef.current;
      if (!ta) return;
      const k = ++uploadCounter.current;
      const token = `[inking it in… ${k}]`;
      ta.focus();
      insertText(ta, token);
      try {
        const up = await upload(file);
        const md = markdownFor(up);
        if (!replaceToken(ta, token, md)) {
          setWorking((prev) => ({
            ...prev,
            content: prev.content.replace(token, md),
          }));
        }
        if (!up.isVideo && !up.isHtml) {
          try {
            if (!localStorage.getItem("writing-room:alt-nudge")) {
              localStorage.setItem("writing-room:alt-nudge", "1");
              flashNote(
                "alt text becomes the handwritten caption — the pen is inside the brackets ✎"
              );
            }
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        if (!replaceToken(ta, token, "")) {
          setWorking((prev) => ({
            ...prev,
            content: prev.content.replace(token, ""),
          }));
        }
        flashNote(
          err instanceof Error ? err.message : "the upload smudged — try again?"
        );
      }
    },
    [upload, flashNote]
  );

  // ------------------------------------------------------- body handlers
  const onBodyKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget;
      const mod = isPlatformMod(e);
      if (mod && !e.shiftKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === "b") {
          e.preventDefault();
          wrapSelection(ta, "**", "**", "bold");
          return;
        }
        if (k === "i") {
          e.preventDefault();
          wrapSelection(ta, "*", "*", "italic");
          return;
        }
        if (k === "k") {
          e.preventDefault();
          void (async () => {
            let clip = "";
            try {
              clip = await navigator.clipboard.readText();
            } catch {
              /* clipboard unavailable */
            }
            insertLink(ta, clip);
          })();
          return;
        }
      }
      if (e.key === "Enter" && !e.shiftKey && !mod) {
        if (handleEnter(ta)) {
          e.preventDefault();
          requestAnimationFrame(() => keepCaretComfortable(ta));
        }
        return;
      }
      if (e.key === "Tab" && !mod) {
        // the ghost's line has first claim on tab
        if (!e.shiftKey && ghost.acceptIfAny()) {
          e.preventDefault();
          return;
        }
        if (handleTab(ta, e.shiftKey)) e.preventDefault();
        return;
      }
      if (e.key === "Escape") {
        if (ghost.dismissIfAny()) {
          e.preventDefault(); // consumed — the global Esc chain stands down
          return;
        }
      }
      if (e.key === "^" && !mod) {
        const { selectionStart: s, selectionEnd: end, value } = ta;
        if (s === end && value[s - 1] === "[" && !isInsideCode(value, s)) {
          e.preventDefault();
          ta.setSelectionRange(s - 1, s);
          insertText(ta, "");
          insertFootnote(ta);
        }
      }
    },
    [ghost.acceptIfAny, ghost.dismissIfAny]
  );

  const onBodyPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget;
      const files = Array.from(e.clipboardData.files || []).filter(acceptsFile);
      if (files.length) {
        e.preventDefault();
        files.forEach((f) => void uploadIntoBody(f));
        return;
      }
      const text = e.clipboardData.getData("text/plain").trim();
      if (!isUrl(text)) return;
      const { selectionStart: s, selectionEnd: end, value } = ta;
      if (end > s) {
        e.preventDefault();
        insertText(ta, `[${value.slice(s, end)}](${text})`);
        return;
      }
      if (isSoundtrackUrl(text) && !workingRef.current.media_url) {
        const lineStart = value.lastIndexOf("\n", s - 1) + 1;
        const le = value.indexOf("\n", s);
        const lineEnd = le === -1 ? value.length : le;
        if (!value.slice(lineStart, lineEnd).trim()) {
          // let the paste land, then offer to lift it into the player
          window.setTimeout(() => {
            flashNote("that link could play on the page —", [
              {
                label: "make it the entry's soundtrack →",
                onClick: () => {
                  setWorking((prev) => ({
                    ...prev,
                    media_url: text,
                    content: prev.content
                      .split("\n")
                      .filter((l, i, arr) => {
                        if (l.trim() !== text) return true;
                        // drop only the first matching line
                        return arr.findIndex((x) => x.trim() === text) !== i;
                      })
                      .join("\n"),
                  }));
                  setNotice(null);
                },
              },
              { label: "leave it in the text", onClick: () => setNotice(null) },
            ]);
          }, 50);
        }
      }
    },
    [uploadIntoBody, flashNote]
  );

  const scheduleCaretComfort = useCallback(() => {
    if (caretRaf.current) return;
    caretRaf.current = requestAnimationFrame(() => {
      caretRaf.current = 0;
      const ta = bodyRef.current;
      if (ta && document.activeElement === ta) keepCaretComfortable(ta);
    });
  }, []);

  // ------------------------------------------------------------- outline
  const outline = useMemo(() => parseOutline(working.content), [working.content]);
  const outlineMinDepth = useMemo(
    () => (outline.length ? Math.min(...outline.map((h) => h.depth)) : 1),
    [outline]
  );
  const activeOutline = useMemo(() => {
    let active = -1;
    outline.forEach((h, i) => {
      if (h.index <= caretIndex) active = i;
    });
    return active;
  }, [outline, caretIndex]);

  const jumpToOutline = useCallback((caret: number) => {
    const ta = bodyRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(caret, caret);
    setCaretIndex(caret);
    keepCaretComfortable(ta);
  }, []);

  // ---------------------------------------------------------------- tags
  const commitTag = useCallback(() => {
    const t = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (!t) return;
    setWorking((prev) =>
      prev.tags.includes(t) ? prev : { ...prev, tags: [...prev.tags, t] }
    );
    setTagInput("");
  }, [tagInput]);

  const tagSuggestions = useMemo(() => {
    const q = tagInput.trim().replace(/^#/, "").toLowerCase();
    return tagVocabulary
      .filter((t) => !working.tags.includes(t))
      .filter((t) => !q || t.startsWith(q))
      .slice(0, 8);
  }, [tagVocabulary, working.tags, tagInput]);

  // ------------------------------------------------------------ publishing
  const doAction = useCallback(
    async (
      action: "publish" | "set-page" | "unpublish" | "recut-slug",
      extra: Record<string, unknown> = {}
    ): Promise<Post | null> => {
      // a half-inked upload would publish as a dangling placeholder
      if (
        (action === "publish" || action === "set-page") &&
        /\[inking it in… \d+\]/.test(workingRef.current.content)
      ) {
        flashNote("still inking something in — let the upload finish first");
        return null;
      }
      // the server trims the title at publish; trim here too so the working
      // copy can't immediately read as "differs from print"
      const trimmed = workingRef.current.title.trim();
      if (trimmed !== workingRef.current.title) {
        workingRef.current = { ...workingRef.current, title: trimmed };
        setWorking(workingRef.current);
      }
      // the ceremony must not race the autosave engine: cancel the pending
      // timer, then wait out any in-flight flush before pressing
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      flushAgain.current = false;
      await flushPromise.current?.catch(() => {});
      if (!postRef.current) {
        await flush();
        if (!postRef.current) {
          flashNote("write something first ✎");
          return null;
        }
      }
      setPublishing(true);
      try {
        const res = await fetch(
          `/api/dashboard/posts/${postRef.current.id}/publish`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action,
              fields: workingRef.current,
              ...extra,
            }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            res.status === 401
              ? "the shelf doesn't recognize you — sign in again"
              : data.error || "the press jammed — try again"
          );
        }
        if (data.caps) {
          capsRef.current = data.caps;
          setCaps(data.caps);
        }
        adoptPost(data.post);
        setStatus("dry");
        // the reconcile render above may have re-armed the autosave timer
        // mid-await — the page is set, nothing is owed
        if (saveTimer.current) {
          window.clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
        return data.post as Post;
      } catch (err) {
        flashNote(
          err instanceof Error ? err.message : "the press jammed — try again"
        );
        // the timer was cancelled above — re-arm it so unpressed changes
        // still reach the shelf
        if (statusRef.current === "drying") {
          saveTimer.current = window.setTimeout(() => void flush(), 1500);
        }
        return null;
      } finally {
        setPublishing(false);
      }
    },
    [flush, flashNote, adoptPost]
  );

  const startCeremony = useCallback((p: Post, kind: "published" | "revised") => {
    const label = `${kind} · ${format(new Date(), "dd MMM").toLowerCase()}`;
    if (sheetRef.current) {
      railH.current = Math.max(0, sheetRef.current.clientHeight - 48);
    }
    if (kind === "published") {
      setCeremony({ phase: "inking", label, slug: p.slug });
      window.setTimeout(
        () => setCeremony((c) => ({ ...c, phase: "stamped" })),
        1250
      );
      window.setTimeout(
        () => setCeremony((c) => ({ ...c, phase: "done" })),
        2100
      );
    } else {
      setCeremony({ phase: "stamped", label, slug: p.slug });
      window.setTimeout(
        () => setCeremony((c) => ({ ...c, phase: "done" })),
        900
      );
    }
  }, []);

  const publishEntry = useCallback(async () => {
    const p = await doAction("publish");
    if (!p) return;
    setVersoOpen(false);
    startCeremony(p, "published");
  }, [doAction, startCeremony]);

  const setPage = useCallback(async () => {
    const p = await doAction("set-page");
    if (!p) return;
    setVersoOpen(false);
    startCeremony(p, "revised");
  }, [doAction, startCeremony]);

  const unpublish = useCallback(async () => {
    const p = await doAction("unpublish");
    if (p) {
      setVersoOpen(false);
      setCeremony({ phase: "idle", label: "", slug: "" });
      flashNote("pulled back to drafts — it's yours again");
    }
  }, [doAction, flashNote]);

  const recutSlug = useCallback(
    async (slug: string) => {
      const p = await doAction("recut-slug", { slug });
      if (p) flashNote(`re-cut — it now lives at /post/${p.slug}`);
    },
    [doAction, flashNote]
  );

  const refusePublish = useCallback(() => {
    setVersoOpen(false);
    setTitleShaking(true);
    flashNote("give it a title first ✎");
    window.setTimeout(() => titleRef.current?.focus(), 350);
  }, [flashNote]);

  // ------------------------------------------------------------ revisions
  const openRevisions = useCallback(async () => {
    if (!postRef.current) return;
    setRevisionsOpen(true);
    if (revisions === null) {
      try {
        const res = await fetch(
          `/api/dashboard/posts/${postRef.current.id}/revisions`
        );
        const data = await res.json();
        setRevisions(data.revisions || []);
      } catch {
        setRevisions([]);
      }
    }
  }, [revisions]);

  const restoreRevision = useCallback(
    (rev: Revision) => {
      preRestore.current = workingRef.current;
      setWorking((prev) => ({
        ...prev,
        title: rev.snapshot.title ?? prev.title,
        content: rev.snapshot.content ?? prev.content,
        tags: rev.snapshot.tags ?? prev.tags,
        description: rev.snapshot.description ?? prev.description,
      }));
      setRevisionsOpen(false);
      flashNote(
        `restored earlier ink — from ${format(
          new Date(rev.created_at),
          "d MMM, h:mm a"
        ).toLowerCase()}`,
        [
          {
            label: "put it back",
            onClick: () => {
              if (preRestore.current) setWorking(preRestore.current);
              setNotice(null);
            },
          },
          { label: "keep this", onClick: () => setNotice(null) },
        ]
      );
    },
    [flashNote]
  );

  // ------------------------------------------------------------ derived ui
  const words = useMemo(() => countWords(working.content), [working.content]);
  const readMin = Math.max(1, Math.ceil(words / 200));
  const sessionDelta = words - sessionStart.current;
  const typeMeta = POST_TYPE_META[working.type] ?? POST_TYPE_META.note;
  const createdAt = post ? new Date(post.created_at) : new Date();

  const statusText: { text: string; tone: "faint" | "amber" | "rust" } =
    useMemo(() => {
      switch (status) {
        case "drying":
          return { text: "ink drying…", tone: "faint" };
        case "dry":
          return {
            text: savedAt ? `ink dry · ${lowTime(savedAt)}` : "ink dry",
            tone: "faint",
          };
        case "kept":
          return {
            text: savedAt
              ? `kept · ${lowTime(savedAt)} — not yet in print`
              : "kept — not yet in print",
            tone: "amber",
          };
        case "local":
          return { text: "saved here, not synced ✎", tone: "amber" };
        case "offline":
          return {
            text: "can't reach the shelf — words safe on this device",
            tone: "rust",
          };
        default:
          return { text: "a fresh page", tone: "faint" };
      }
    }, [status, savedAt]);

  const proofPost: Post = useMemo(
    () => ({
      id: post?.id ?? "proof",
      created_at: post?.created_at ?? new Date().toISOString(),
      updated_at: post?.updated_at ?? new Date().toISOString(),
      title: working.title || "untitled, for now",
      content: working.content,
      type: working.type,
      media_url: working.media_url || undefined,
      tags: working.tags,
      accent_color: post?.accent_color ?? "#c75623",
      is_draft: post?.is_draft ?? true,
      view_count: post?.view_count ?? 0,
      slug: post?.slug ?? "proof",
      display_size: working.display_size || null,
      description: working.description || null,
      meta_image: working.meta_image || null,
      is_pinned: working.is_pinned,
    }),
    [post, working]
  );

  const onProofClickCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const heading = target.closest(".prose :is(h2,h3,h4)[id]");
      if (heading && proofRef.current) {
        e.preventDefault();
        e.stopPropagation();
        const all = Array.from(
          proofRef.current.querySelectorAll(".prose :is(h2,h3,h4)[id]")
        );
        const idx = all.indexOf(heading as Element);
        // index mapping holds when source #-headings and rendered headings
        // agree 1:1; setext/blockquote headings can skew it, so fall back to
        // matching the heading's text.
        let entry = outline.length === all.length ? outline[idx] : undefined;
        if (!entry) {
          const norm = (s: string | null) =>
            (s || "").replace(/\s+/g, " ").trim().toLowerCase();
          const wanted = norm(heading.textContent);
          const nth = all
            .slice(0, idx + 1)
            .filter((h) => norm(h.textContent) === wanted).length;
          const matches = outline.filter((o) => norm(o.text) === wanted);
          entry = matches[nth - 1] ?? matches[0];
        }
        if (entry) exitProof(entry.caret);
        return;
      }
      const a = target.closest("a[href]");
      if (a) {
        const href = a.getAttribute("href") || "";
        if (!href.startsWith("#")) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    },
    [outline, exitProof]
  );

  const chromeAction = isPublished
    ? differs || status === "local"
      ? "set the page…"
      : "back of page ⟲"
    : "publish…";

  // ================================================================ render
  return (
    <div className="min-h-screen page-reveal">
      {/* hidden file input for "attach" */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4,text/html,.html"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []).filter(acceptsFile);
          e.target.value = "";
          files.forEach((f) => void uploadIntoBody(f));
        }}
      />

      {/* ---------- chrome: one quiet hairline, backstage register ---------- */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-[84rem] items-center justify-between px-4 sm:px-8">
          <Link
            href="/dashboard"
            onClick={() => {
              if (statusRef.current === "drying") void flush(true);
            }}
            className="font-hand text-xl text-ink-soft transition-colors hover:text-accent-rust"
          >
            ← the shelf
          </Link>
          <div className="flex items-center gap-5 font-mono text-[0.65rem] tracking-[0.12em]">
            <span
              className={`hidden sm:inline ${
                statusText.tone === "amber"
                  ? "text-accent-orange"
                  : statusText.tone === "rust"
                    ? "text-accent-rust"
                    : "text-ink-faint"
              }`}
              role="status"
              aria-live="polite"
            >
              {uploading ? `inking it in… ${progress}%` : statusText.text}
            </span>
            <button
              type="button"
              onClick={() => (mode === "proof" ? exitProof(null) : toggleProof())}
              className={`transition-colors hover:text-accent-rust ${
                mode === "proof" ? "text-accent-rust" : "text-ink-soft"
              }`}
              title="see it like a reader — ⌘e"
            >
              {mode === "proof" ? "back to the pen" : "proof"}
            </button>
            <button
              type="button"
              onClick={() => setVersoOpen(true)}
              className="relative text-ink-soft transition-colors hover:text-accent-rust"
              title="the back of the page — ⌘↵"
            >
              {chromeAction}
              {(differs || status === "local") && (
                <span
                  aria-hidden
                  className="absolute -right-2 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent-orange"
                />
              )}
            </button>
          </div>
        </div>

        {/* inline notice — the house pattern, no toasts */}
        <AnimatePresence>
          {notice && (
            <motion.div
              key={notice.id}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden border-t border-accent-rust/20 bg-accent-rust/[0.06]"
            >
              <div className="mx-auto flex max-w-[46rem] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2">
                <span className="font-hand text-lg leading-tight text-accent-rust">
                  {notice.text}
                </span>
                {notice.actions?.map((a) =>
                  a.href ? (
                    <a
                      key={a.label}
                      href={a.href}
                      className="font-mono text-[0.65rem] uppercase tracking-wider text-ink underline decoration-accent-rust/50 underline-offset-2"
                    >
                      {a.label}
                    </a>
                  ) : (
                    <button
                      key={a.label}
                      type="button"
                      onClick={a.onClick}
                      className="font-mono text-[0.65rem] uppercase tracking-wider text-ink underline decoration-accent-rust/50 underline-offset-2"
                    >
                      {a.label}
                    </button>
                  )
                )}
                <button
                  type="button"
                  aria-label="dismiss"
                  onClick={() => setNotice(null)}
                  className="ml-auto text-ink-faint transition-colors hover:text-ink"
                >
                  ×
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* =================================================== the proof */}
      {mode === "proof" && (
        <motion.div
          ref={proofRef}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          onClickCapture={onProofClickCapture}
        >
          <div className="pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2">
            <motion.div
              initial={{ scale: 1.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.09, duration: 0.16 }}
            >
              <Stamp tone="rust" rotate={-3} className="shadow-paper">
                proof — tap a heading to fix it
              </Stamp>
            </motion.div>
          </div>
          <main className="post-reading relative z-10 min-h-screen py-8 pt-14 md:py-16">
            <PostContent key="proof" post={proofPost} preview />
          </main>
        </motion.div>
      )}

      {/* =================================================== the room */}
      <div className={mode === "proof" ? "hidden" : undefined}>
        <div className="mx-auto w-full max-w-[40rem] px-4 pb-32 pt-8 sm:max-w-[44rem] sm:px-6 md:pt-12 xl:grid xl:max-w-[84rem] xl:grid-cols-[minmax(0,1fr)_minmax(0,46rem)_minmax(0,1fr)] xl:items-start xl:gap-x-12 xl:px-8 2xl:max-w-[92rem] 2xl:gap-x-16">
          {/* ---------- left margin: the outline being born ---------- */}
          <aside className="hidden self-start xl:sticky xl:top-20 xl:block">
            {outline.length > 0 && (
              <nav
                aria-label="Outline"
                className="rise d1 relative mt-8 max-h-[calc(100vh-7rem)] overflow-y-auto pl-4 scrollbar-hide"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-1 left-0 w-px bg-accent-rust/25"
                />
                <p className="mb-3 font-hand text-xl -rotate-1 text-accent-purple">
                  in this entry —
                </p>
                <ul className="space-y-1.5">
                  {outline.map((h, i) => (
                    <li
                      key={`${h.index}-${h.text}`}
                      style={{
                        paddingLeft: `${Math.min(h.depth - outlineMinDepth, 2) * 0.85}rem`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => jumpToOutline(h.caret)}
                        className={`group/oi relative inline-block text-left font-hand leading-snug transition-colors ${
                          h.depth === outlineMinDepth ? "text-base" : "text-sm"
                        } ${
                          i === activeOutline
                            ? "text-ink"
                            : "text-ink-soft hover:text-ink"
                        }`}
                      >
                        {h.text}
                        <Doodle
                          name="underline"
                          tone="rust"
                          className={`block h-1.5 w-full transition-opacity duration-200 ${
                            i === activeOutline
                              ? "opacity-100"
                              : "opacity-0 group-hover/oi:opacity-40"
                          }`}
                          strokeWidth={3}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </aside>

          {/* ---------- center: the sheet ---------- */}
          <div className="min-w-0">
            <motion.div
              ref={sheetRef}
              animate={
                ceremony.phase === "stamped"
                  ? { y: [0, 1.5, 0] }
                  : { y: 0 }
              }
              transition={{ duration: 0.08 }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                Array.from(e.dataTransfer.files)
                  .filter(acceptsFile)
                  .forEach((f) => void uploadIntoBody(f));
              }}
              className="relative rounded-[3px] border border-line bg-card px-6 py-11 shadow-paper-lg sm:px-10 md:px-16 md:py-14"
            >
              <TornEdge position="top" />
              <TornEdge position="bottom" />
              <PaperClip className="-top-5 right-8 md:right-12" rotate={9} tone="ink" />

              {/* drop affordance — a dashed rule drawn around the sheet */}
              {dragOver && (
                <div className="pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-[6px] border-2 border-dashed border-accent-rust/60 bg-card/80">
                  <HandNote tone="rust" rotate={-2} className="text-2xl">
                    drop it on the page —
                  </HandNote>
                </div>
              )}

              {/* the margin rule — graphite while drafting, inked at publish */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-6 left-4 w-px sm:left-7 md:left-9"
              >
                <div className="absolute inset-0 bg-ink/15" />
                {ceremony.phase !== "idle" && (
                  <CeremonyInk
                    animate={ceremony.phase === "inking"}
                    railH={railH.current}
                  />
                )}
              </div>

              {/* the publish stamp, slammed on and left there */}
              <AnimatePresence>
                {(ceremony.phase === "stamped" || ceremony.phase === "done") && (
                  <motion.div
                    initial={{ scale: 1.4, rotate: -8, opacity: 0 }}
                    animate={{ scale: 1, rotate: -4, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="absolute right-5 top-5 z-20 md:right-8 md:top-8"
                  >
                    <Stamp tone="rust" rotate={0}>
                      {ceremony.label}
                    </Stamp>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* header — the page's own anatomy is the metadata; geometry
                  mirrors the published sheet so write↔proof doesn't jump */}
              <header className="mb-11 md:mb-12">
                <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2.5">
                  {/* type stamp: tap to choose */}
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={() => setTypePickerOpen((o) => !o)}
                      title={`${typeMeta.blurb} — tap to change`}
                      className="focus-visible:outline-none"
                    >
                      <motion.span
                        key={working.type}
                        initial={{ scale: 1.12, rotate: -7 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ duration: 0.16 }}
                        className="inline-block"
                      >
                        <Stamp tone={typeMeta.tone} rotate={-4}>
                          {working.type}
                        </Stamp>
                      </motion.span>
                    </button>
                    {typePickerOpen && (
                      <>
                        <button
                          type="button"
                          aria-label="close"
                          onClick={() => setTypePickerOpen(false)}
                          className="fixed inset-0 z-30 cursor-default"
                        />
                        <div className="absolute left-0 top-full z-40 mt-2 w-64 space-y-1 rounded-md border border-line bg-card p-2 shadow-paper-lg">
                          {POST_TYPES.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => {
                                setField("type", t);
                                setTypePickerOpen(false);
                              }}
                              className="flex w-full items-center gap-2.5 rounded p-1.5 text-left transition-colors hover:bg-ink/5"
                            >
                              <Stamp tone={POST_TYPE_META[t].tone} rotate={-2}>
                                {t}
                              </Stamp>
                              <span className="text-[0.65rem] leading-tight text-ink-faint">
                                {POST_TYPE_META[t].blurb}
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <Stamp tone="ink" rotate={3}>
                    {format(createdAt, "dd MMM ''yy")}
                  </Stamp>

                  {isPublished ? (
                    <Stamp tone="ink" rotate={-2}>
                      in print
                    </Stamp>
                  ) : (
                    <Stamp tone="rust" rotate={-2}>
                      wet ink
                    </Stamp>
                  )}
                </div>

                <span className="font-hand text-2xl -rotate-1 text-accent-purple">
                  from the journal —
                </span>
                {/* class-toggled (never keyed!) so the textarea is not
                    remounted — a remount would wipe the title's undo stack */}
                <div
                  className={titleShaking ? "gentle-refuse" : ""}
                  onAnimationEnd={() => setTitleShaking(false)}
                >
                  <textarea
                    ref={titleRef}
                    rows={1}
                    value={working.title}
                    onChange={(e) =>
                      setField("title", e.target.value.replace(/\n/g, ""))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
                        e.preventDefault();
                        bodyRef.current?.focus();
                        bodyRef.current?.setSelectionRange(0, 0);
                      }
                    }}
                    placeholder="title this entry…"
                    aria-label="title"
                    className="mt-1 w-full resize-none overflow-hidden bg-transparent font-serif text-3xl font-medium leading-[1.08] tracking-tight text-ink placeholder:text-ink-faint focus:outline-none focus-visible:ring-0 sm:text-4xl md:text-5xl lg:text-6xl"
                    style={{ caretColor: "rgb(var(--accent-rust))" }}
                  />
                </div>

                {/* tags — exactly where readers see them */}
                <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
                  {working.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setWorking((prev) => ({
                          ...prev,
                          tags: prev.tags.filter((t) => t !== tag),
                        }))
                      }
                      title="remove tag"
                      className="group/tag font-hand text-xl text-accent-purple"
                    >
                      #{tag}
                      <span className="ml-0.5 align-middle text-sm text-ink-faint opacity-0 transition-opacity group-hover/tag:opacity-100">
                        ×
                      </span>
                    </button>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onFocus={() => setTagFocus(true)}
                    onBlur={() => {
                      window.setTimeout(() => setTagFocus(false), 150);
                      commitTag();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
                        if (tagInput.trim()) {
                          e.preventDefault();
                          commitTag();
                        }
                      } else if (e.key === "Backspace" && !tagInput) {
                        setWorking((prev) => ({
                          ...prev,
                          tags: prev.tags.slice(0, -1),
                        }));
                      }
                    }}
                    placeholder="+ tag"
                    aria-label="add a tag"
                    className="w-24 bg-transparent font-hand text-xl text-accent-purple placeholder:text-ink-faint focus:outline-none focus-visible:ring-0"
                  />
                </div>
                {tagFocus && tagSuggestions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="font-hand text-base text-ink-faint">
                      ones you&apos;ve used —
                    </span>
                    {tagSuggestions.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setWorking((prev) => ({
                            ...prev,
                            tags: [...prev.tags, t],
                          }));
                          setTagInput("");
                        }}
                        className="font-hand text-base text-accent-purple/60 transition-colors hover:text-accent-purple"
                      >
                        #{t}
                      </button>
                    ))}
                  </div>
                )}
              </header>

              {/* the body — write in the reading face; the ghost's graphite
                  continuation renders in a metric-mirror layer behind it */}
              <div className="relative">
                <textarea
                  ref={bodyRef}
                  value={working.content}
                  onChange={(e) => {
                    setField("content", e.target.value);
                    setCaretIndex(e.target.selectionStart);
                    scheduleCaretComfort();
                  }}
                  onSelect={(e) =>
                    setCaretIndex(
                      (e.target as HTMLTextAreaElement).selectionStart
                    )
                  }
                  onCompositionStart={() => {
                    composingRef.current = true;
                  }}
                  onCompositionEnd={() => {
                    composingRef.current = false;
                  }}
                  onKeyDown={onBodyKeyDown}
                  onPaste={onBodyPaste}
                  placeholder="start anywhere. you can fix it later ✎"
                  aria-label="entry body (markdown)"
                  spellCheck
                  className="relative block min-h-[50vh] w-full resize-none overflow-hidden bg-transparent font-serif text-base leading-[1.75] tracking-[0.01em] text-ink-soft placeholder:italic placeholder:text-ink-faint focus:outline-none focus-visible:ring-0 md:text-lg md:leading-[1.8]"
                  style={{ caretColor: "rgb(var(--accent-rust))" }}
                />
                <GhostOverlay
                  content={working.content}
                  suggestion={ghost.suggestion}
                />
              </div>
            </motion.div>

            {/* the it's-out-there line, after the quiet beat */}
            <AnimatePresence>
              {ceremony.phase === "done" && (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="mt-6 text-center font-hand text-2xl text-ink"
                >
                  it&apos;s out there{" "}
                  <a
                    href={`/post/${ceremony.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-orange underline decoration-accent-orange/40 underline-offset-4 transition-colors hover:text-accent-purple"
                  >
                    → read it on the site
                  </a>
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* ---------- right margin: field notes, backstage ---------- */}
          <aside className="hidden self-start xl:sticky xl:top-20 xl:block">
            <div className="rise d2 mt-8 space-y-6 text-right">
              <div className="space-y-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-faint">
                <p>
                  {words.toLocaleString()} words · ~{readMin} min
                </p>
                <p>
                  this sitting ·{" "}
                  {sessionDelta >= 0 ? `+${sessionDelta}` : sessionDelta} words
                </p>
              </div>

              <p
                className={`font-mono text-[0.65rem] tracking-[0.12em] ${
                  statusText.tone === "amber"
                    ? "text-accent-orange"
                    : statusText.tone === "rust"
                      ? "text-accent-rust"
                      : "text-ink-faint"
                }`}
              >
                {statusText.text}
              </p>

              <div className="flex justify-end">
                <Doodle
                  name="squiggle"
                  tone="rust"
                  className="h-4 w-20 opacity-60"
                  strokeWidth={2.5}
                />
              </div>

              <div className="flex flex-col items-end gap-2 font-mono text-[0.68rem] tracking-[0.1em] text-ink-soft">
                <button
                  type="button"
                  onClick={toggleProof}
                  className="transition-colors hover:text-accent-rust"
                >
                  proof — see it as a reader
                </button>
                <button
                  type="button"
                  onClick={openPalette}
                  className="text-accent-purple/80 transition-colors hover:text-accent-purple"
                >
                  summon the ghost ✦
                </button>
                <button
                  type="button"
                  onClick={toggleGhost}
                  title="the ghost offers a line when your pen rests"
                  className="transition-colors hover:text-accent-purple"
                >
                  ghost —{" "}
                  {ghostOn
                    ? ghost.thinking
                      ? "thinking…"
                      : "awake"
                    : "resting"}
                </button>
                <button
                  type="button"
                  onClick={() => setVersoOpen(true)}
                  className="transition-colors hover:text-accent-rust"
                >
                  back of page ⟲
                </button>
                {caps.revisions && post && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        revisionsOpen ? setRevisionsOpen(false) : void openRevisions()
                      }
                      className="transition-colors hover:text-accent-rust"
                    >
                      earlier ink ↺
                    </button>
                    {revisionsOpen && (
                      <div className="absolute right-0 top-full z-40 mt-2 max-h-72 w-72 overflow-y-auto rounded-md border border-line bg-card p-2 text-left shadow-paper-lg">
                        {revisions === null ? (
                          <p className="p-2 font-hand text-base text-ink-faint">
                            leafing back…
                          </p>
                        ) : revisions.length === 0 ? (
                          <p className="p-2 font-hand text-base text-ink-faint">
                            no earlier ink yet — keep writing ✎
                          </p>
                        ) : (
                          revisions.map((rev) => (
                            <button
                              key={rev.id}
                              type="button"
                              onClick={() => restoreRevision(rev)}
                              className="block w-full rounded p-2 text-left transition-colors hover:bg-ink/5"
                            >
                              <span className="font-mono text-[0.62rem] uppercase tracking-wider text-ink-soft">
                                {rev.kind === "publish" ? "✦" : "·"}{" "}
                                {format(
                                  new Date(rev.created_at),
                                  "d MMM · h:mm a"
                                ).toLowerCase()}
                              </span>
                              <span className="ml-2 font-mono text-[0.62rem] text-ink-faint">
                                {countWords(rev.snapshot.content || "")} words
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Doodle
                  name="squiggle"
                  tone="rust"
                  className="h-4 w-20 opacity-60"
                  strokeWidth={2.5}
                />
              </div>

              <div className="space-y-0.5 font-mono text-[0.6rem] tracking-[0.08em] text-ink-faint/80">
                <p>⌘e proof · ⌘b bold · ⌘i italic</p>
                <p>⌘k link · ⌘j ghost · ⌘↵ publish</p>
                <p>tab takes the ghost&apos;s line · esc waves it off</p>
                <p>⌘s — it&apos;s already saved</p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ---------- mobile bar, riding the keyboard ---------- */}
      <div
        className="fixed inset-x-0 z-40 md:hidden"
        style={{ bottom: kbInset }}
      >
        <AnimatePresence>
          {marksOpen && mode === "write" && (
            <motion.div
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-around border-t border-line bg-card/95 px-2 py-2 backdrop-blur-md"
            >
              {(
                [
                  ["b", () => bodyRef.current && wrapSelection(bodyRef.current, "**", "**", "bold")],
                  ["i", () => bodyRef.current && wrapSelection(bodyRef.current, "*", "*", "italic")],
                  ["link", () => bodyRef.current && insertLink(bodyRef.current)],
                  ["– list", () => bodyRef.current && insertText(bodyRef.current, "\n- ")],
                  ["`code`", () => bodyRef.current && wrapSelection(bodyRef.current, "`", "`", "code")],
                  ["# h", () => bodyRef.current && insertText(bodyRef.current, "\n## ")],
                  ["[^1]", () => bodyRef.current && insertFootnote(bodyRef.current)],
                ] as [string, () => void][]
              ).map(([label, action]) => (
                <button
                  key={label}
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={action}
                  className="rounded px-2.5 py-1.5 font-mono text-xs text-ink-soft transition-colors hover:text-accent-rust"
                >
                  {label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <div
          className="flex items-center justify-between border-t border-line bg-card/95 px-5 py-2.5 backdrop-blur-md"
          style={{
            paddingBottom: kbInset
              ? undefined
              : "calc(env(safe-area-inset-bottom) + 0.625rem)",
          }}
        >
          <span
            aria-label={statusText.text}
            title={statusText.text}
            className={`h-2 w-2 rounded-full ${
              status === "drying" || uploading
                ? "animate-pulse bg-accent-orange"
                : statusText.tone === "amber"
                  ? "bg-accent-orange"
                  : statusText.tone === "rust"
                    ? "bg-accent-rust"
                    : "bg-ink/40"
            }`}
          />
          {ghost.suggestion && mode === "write" && (
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => ghost.acceptIfAny()}
              className="font-hand text-lg text-accent-purple"
            >
              take the ghost&apos;s line ✎
            </button>
          )}
          {(
            [
              // marks/attach/ghost write into the sheet — hidden in proof
              ...(mode === "write"
                ? ([
                    ["marks", () => setMarksOpen((o) => !o)],
                    ["attach", () => fileInputRef.current?.click()],
                    ["ghost", openPalette],
                  ] as [string, () => void][])
                : []),
              [
                mode === "proof" ? "pen" : "proof",
                () => (mode === "proof" ? exitProof(null) : toggleProof()),
              ],
              ["page ⟲", () => setVersoOpen(true)],
            ] as [string, () => void][]
          ).map(([label, action]) => (
            <button
              key={label}
              type="button"
              onPointerDown={(e) => {
                if (label === "marks") e.preventDefault();
              }}
              onClick={action}
              className={`font-mono text-[0.7rem] lowercase tracking-[0.1em] transition-colors ${
                (label === "marks" && marksOpen) || label === "pen"
                  ? "text-accent-rust"
                  : "text-ink-soft"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- the ghost's slip ---------- */}
      <GhostPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        selectionText={paletteSelection}
        working={working}
        onInsert={insertFromPalette}
        onSetTitle={(t) => {
          setField("title", t);
          flashNote("titled ✎");
        }}
      />

      {/* ---------- the back of the page ---------- */}
      <Verso
        open={versoOpen}
        onClose={() => setVersoOpen(false)}
        working={working}
        setField={setField}
        post={post}
        caps={caps}
        isPublished={isPublished}
        differs={differs || status === "local"}
        busy={publishing}
        onPublish={() => void publishEntry()}
        onSetPage={() => void setPage()}
        onUnpublish={() => void unpublish()}
        onRecutSlug={(s) => void recutSlug(s)}
        onRefusePublish={refusePublish}
      />
    </div>
  );
}

// The reader's own wet-ink margin fill, played once as the entry signs itself.
function CeremonyInk({ animate, railH }: { animate: boolean; railH: number }) {
  const [filled, setFilled] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setFilled(true))
    );
    return () => cancelAnimationFrame(raf);
  }, [animate]);
  const transition = animate
    ? "transform 1.2s cubic-bezier(0.45, 0, 0.25, 1)"
    : undefined;
  return (
    <>
      <div
        className="absolute inset-x-0 top-0 h-full origin-top"
        style={{
          transform: filled ? "scaleY(1)" : "scaleY(0)",
          transition,
          background:
            "linear-gradient(rgb(var(--accent-orange)), rgb(var(--accent-rust)))",
        }}
      />
      <svg
        className="absolute -left-[5px] top-0 h-[11px] w-[11px] text-accent-rust"
        viewBox="0 0 12 12"
        fill="none"
        style={{
          transform: filled
            ? `translate3d(0, ${Math.max(0, railH - 6)}px, 0)`
            : "translate3d(0, 0, 0)",
          transition,
        }}
      >
        <path d="M2 2 L10 2 L6 11 Z" fill="currentColor" />
      </svg>
    </>
  );
}
