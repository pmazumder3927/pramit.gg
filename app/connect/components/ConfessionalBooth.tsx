"use client";

import { motion, AnimatePresence } from "motion/react";
import { useRef, useState } from "react";

import type { ConfessionalCaptchaSubmission } from "@/app/lib/confessional-captcha";
import DrawingCaptcha, {
  type DrawingCaptchaHandle,
  getCaptchaAttempts,
  resetCaptchaAttempts,
} from "@/app/connect/components/DrawingCaptcha";
import { markTurtlesFresh } from "@/app/lib/turtleFresh";
import { track } from "@/app/lib/track";
import CatCouncil from "@/app/connect/components/CatCouncil";
import {
  Doodle,
  HandNote,
  Tape,
  PaperClip,
  TornEdge,
  RuledPaper,
} from "@/app/components/sketchbook";

type Phase = "form" | "judging" | "approve" | "reject" | "received";

const MIN_JUDGING_MS = 2_400;
const VERDICT_HOLD_MS = 1_700;
const RECEIVED_HOLD_MS = 3_400;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function ConfessionalBooth() {
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [characterCount, setCharacterCount] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [verdictMessage, setVerdictMessage] = useState<string | null>(null);
  const [captchaPayload, setCaptchaPayload] =
    useState<ConfessionalCaptchaSubmission | null>(null);
  const [captchaReady, setCaptchaReady] = useState(false);
  const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0);
  const drawingRef = useRef<DrawingCaptchaHandle>(null);

  const maxLength = 500;
  const isBusy = phase !== "form";

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= maxLength) {
      setMessage(value);
      setCharacterCount(value.length);
      setSubmitError(null);
    }
  };

  const submitMessage = async () => {
    if (!message.trim() || isBusy) return;

    if (!captchaPayload || !captchaReady) {
      setSubmitError("Finish your drawing for the council first.");
      return;
    }

    setPhase("judging");
    setSubmitError(null);
    setVerdictMessage(null);

    // Always rasterize the canvas right before submitting so the gallery
    // gets a snapshot. The debounced background path was racy and often
    // ended up sending the captcha payload without one.
    let captchaToSend: ConfessionalCaptchaSubmission = captchaPayload;
    try {
      const handle = drawingRef.current;
      if (!handle) {
        console.warn("[confessional] drawingRef not attached at submit");
      } else {
        const snapshot = await handle.getSnapshot();
        console.log(
          "[confessional] snapshot generated",
          snapshot
            ? { length: snapshot.length, prefix: snapshot.slice(0, 32) }
            : "NULL",
        );
        if (snapshot) {
          captchaToSend = { ...captchaPayload, snapshot };
        }
      }
    } catch (snapshotError) {
      console.error(
        "[confessional] snapshot generation failed:",
        snapshotError,
      );
    }

    const minJudgingDeadline = sleep(MIN_JUDGING_MS);
    let approved = false;
    let approvalNote: string | null = null;
    let rejectionNote: string | null = null;

    try {
      const response = await fetch("/api/confessional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          timestamp: new Date().toISOString(),
          captcha: captchaToSend,
        }),
      });

      if (response.ok) {
        approved = true;
        track("captcha_result", {
          passed: true,
          attempts: getCaptchaAttempts(),
        });
        track("confession_submitted", {
          captcha_attempts: getCaptchaAttempts(),
        });
        resetCaptchaAttempts();
      } else {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        rejectionNote =
          data?.error ?? "the council did not accept your drawing.";
        track("captcha_result", {
          passed: false,
          attempts: getCaptchaAttempts(),
        });
      }
    } catch (error) {
      // network failure, not a verdict — deliberately no captcha_result
      console.error("Error submitting message:", error);
      rejectionNote = "the council was unreachable. Try again.";
    }

    await minJudgingDeadline;

    if (approved) {
      setVerdictMessage(approvalNote ?? "your whisper has been recorded.");
      setPhase("approve");
      // open the cache-bust window BEFORE listeners refetch on the event
      markTurtlesFresh();
      window.dispatchEvent(new CustomEvent("turtle:new"));

      await sleep(VERDICT_HOLD_MS);

      setMessage("");
      setCharacterCount(0);
      setCaptchaPayload(null);
      setCaptchaReady(false);
      setCaptchaRefreshKey((current) => current + 1);
      setPhase("received");

      await sleep(RECEIVED_HOLD_MS);
      setPhase("form");
    } else {
      setVerdictMessage(rejectionNote);
      setPhase("reject");

      await sleep(VERDICT_HOLD_MS);

      setSubmitError(rejectionNote);
      // Force a fresh challenge — old one is signed but no longer valid for retry.
      setCaptchaPayload(null);
      setCaptchaReady(false);
      setCaptchaRefreshKey((current) => current + 1);
      setPhase("form");
    }
  };

  const showCouncil =
    phase === "judging" || phase === "approve" || phase === "reject";

  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex items-center gap-2">
          <HandNote tone="purple" rotate={-3} className="text-2xl">
            leave a doodle in my sketchbook
          </HandNote>
          <Doodle
            name="arrow"
            tone="purple"
            className="h-5 w-10"
            strokeWidth={3}
          />
        </div>
        <h2 className="mt-1 font-serif text-2xl font-medium text-ink md:text-3xl">
          draw me something, whisper something
        </h2>
        <p className="mt-1.5 max-w-md font-serif text-sm italic text-ink-soft">
          anonymous. sketch on the page, drop a note, and the council decides if
          it stays. say hi, leave a burning rant or feedback, whatever u want
          dude.
        </p>
        <p className="mt-3 max-w-md -rotate-1 font-hand text-lg leading-snug text-accent-purple">
          psst — the faint drawings drifting behind every page of this site?
          visitors drew them, right here. if the council approves, yours joins
          them.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="relative -rotate-[0.4deg] rounded-[3px] border border-line bg-card shadow-paper-lg"
      >
        <Tape tone="purple" rotate={-3} className="-top-3 left-10" width={90} />
        <Tape tone="orange" rotate={4} className="-top-3 right-10" width={90} />
        <PaperClip
          className="-top-4 right-1/2 translate-x-1/2 md:right-16 md:translate-x-0"
          rotate={8}
          tone="ink"
        />
        <AnimatePresence mode="wait">
          {showCouncil ? (
            <motion.div
              key="council"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="m-3 rounded-xl border-[1.6px] border-line bg-paper-2/60 px-6 py-10 md:py-14"
            >
              <CatCouncil
                verdict={
                  phase === "approve"
                    ? "approve"
                    : phase === "reject"
                      ? "reject"
                      : "judging"
                }
                message={verdictMessage ?? undefined}
                strokes={captchaPayload?.strokes ?? []}
              />
            </motion.div>
          ) : phase === "received" ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-12 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-[1.6px] border-accent-orange/50 text-accent-orange"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </motion.div>

              <h3 className="font-serif text-lg font-medium text-ink mb-1">
                message received
              </h3>
              <p className="font-hand text-lg text-accent-rust">
                the council waves you on. whispered into the void.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <RuledPaper variant="ruled" className="rounded-[3px] p-5 md:p-7">
                <div className="relative mx-auto mb-2 max-w-3xl">
                  <HandNote
                    tone="rust"
                    rotate={-1.5}
                    className="mb-1.5 block text-lg"
                  >
                    1 · jot a note (only i can see these)
                  </HandNote>
                  <textarea
                    value={message}
                    onChange={handleMessageChange}
                    placeholder="speak your truth..."
                    className="h-28 w-full resize-none rounded-[3px] border-[1.6px] border-line bg-paper-2/60 p-4 font-serif text-base text-ink placeholder-ink-faint transition-colors duration-300 focus:border-accent-orange/60 focus:outline-none"
                  />
                  <div className="absolute bottom-3 right-3 text-xs tabular-nums text-ink-faint">
                    {characterCount}/{maxLength}
                  </div>
                </div>

                <div className="mx-auto mb-5 flex max-w-3xl items-center gap-2 font-hand text-base text-ink-faint">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <span>completely anonymous · no tracking</span>
                </div>

                <HandNote
                  tone="rust"
                  rotate={-1.5}
                  className="mx-auto mb-2 block max-w-3xl text-lg"
                >
                  2 · draw a little something — it&apos;ll float in the
                  site&apos;s background with everyone else&apos;s (publicly
                  visible)
                </HandNote>
                <div className="mb-6">
                  <DrawingCaptcha
                    ref={drawingRef}
                    disabled={isBusy}
                    refreshKey={captchaRefreshKey}
                    onChange={(payload, ready) => {
                      setCaptchaPayload(payload);
                      setCaptchaReady(ready);
                      setSubmitError(null);
                    }}
                  />
                </div>

                {submitError ? (
                  <div className="mx-auto mb-6 max-w-3xl rounded-xl border-[1.4px] border-accent-rust/40 bg-accent-rust/10 px-4 py-3 text-sm text-accent-rust">
                    {submitError}
                  </div>
                ) : null}

                <motion.button
                  onClick={submitMessage}
                  disabled={!message.trim() || isBusy || !captchaReady}
                  className="mx-auto block w-full max-w-3xl rounded-xl border-[1.6px] border-line bg-paper-2/50 py-3 font-serif text-sm text-ink-soft transition-all duration-300 hover:border-accent-orange/60 hover:bg-accent-orange/10 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                  whileHover={{
                    scale: message.trim() && captchaReady && !isBusy ? 1.01 : 1,
                  }}
                  whileTap={{
                    scale: message.trim() && captchaReady && !isBusy ? 0.99 : 1,
                  }}
                >
                  {captchaReady
                    ? "submit to the council"
                    : "draw something for the council first"}
                </motion.button>
              </RuledPaper>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
