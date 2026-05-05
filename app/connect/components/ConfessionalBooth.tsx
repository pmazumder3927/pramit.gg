"use client";

import { motion, AnimatePresence } from "motion/react";
import { useRef, useState } from "react";

import type { ConfessionalCaptchaSubmission } from "@/app/lib/confessional-captcha";
import DrawingCaptcha, {
  type DrawingCaptchaHandle,
} from "@/app/connect/components/DrawingCaptcha";
import CatCouncil from "@/app/connect/components/CatCouncil";

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
      const snapshot = await drawingRef.current?.getSnapshot();
      if (snapshot) {
        captchaToSend = { ...captchaPayload, snapshot };
      }
    } catch (snapshotError) {
      console.error("Snapshot generation failed:", snapshotError);
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
      } else {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        rejectionNote =
          data?.error ?? "the council did not accept your drawing.";
      }
    } catch (error) {
      console.error("Error submitting message:", error);
      rejectionNote = "the council was unreachable. Try again.";
    }

    await minJudgingDeadline;

    if (approved) {
      setVerdictMessage(approvalNote ?? "your whisper has been recorded.");
      setPhase("approve");
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
      <div className="absolute top-0 left-0 w-8 h-px bg-white/10" />
      <div className="absolute top-0 left-0 w-px h-8 bg-white/10" />
      <div className="absolute bottom-0 right-0 w-8 h-px bg-white/10" />
      <div className="absolute bottom-0 right-0 w-px h-8 bg-white/10" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <h2 className="text-2xl md:text-3xl font-extralight text-white/80 mb-2">
          whisper into the void
        </h2>
        <p className="text-white/40 font-light text-sm max-w-md mx-auto">
          anonymous thoughts, feedback, or just say hi
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {showCouncil ? (
            <motion.div
              key="council"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="px-6 py-10 md:py-14"
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
                className="w-12 h-12 mx-auto mb-4 rounded-full border border-emerald-300/30 flex items-center justify-center"
              >
                <svg
                  className="w-5 h-5 text-emerald-200/80"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </motion.div>

              <h3 className="text-lg font-light text-white/80 mb-1">
                message received
              </h3>
              <p className="text-white/40 text-sm font-light">
                the council waves you on. whispered into the void.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-5 md:p-7"
            >
              <div className="relative mx-auto mb-4 max-w-3xl">
                <textarea
                  value={message}
                  onChange={handleMessageChange}
                  placeholder="speak your truth..."
                  className="w-full h-32 bg-transparent border border-white/[0.08] rounded-xl p-4 text-white/80 placeholder-white/30 resize-none focus:border-white/20 focus:outline-none transition-colors duration-300 font-light text-sm"
                />
                <div className="absolute bottom-3 right-3 text-xs text-white/30">
                  {characterCount}/{maxLength}
                </div>
              </div>

              <div className="mx-auto mb-6 flex max-w-3xl items-center gap-2 text-xs text-white/30">
                <svg
                  className="w-3.5 h-3.5"
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
                <div className="mx-auto mb-6 max-w-3xl rounded-xl border border-rose-400/20 bg-rose-500/5 px-4 py-3 text-sm font-light text-rose-100/80">
                  {submitError}
                </div>
              ) : null}

              <motion.button
                onClick={submitMessage}
                disabled={!message.trim() || isBusy || !captchaReady}
                className="mx-auto block w-full max-w-3xl py-3 bg-white/[0.05] border border-white/10 rounded-xl text-white/70 text-sm font-light hover:bg-white/[0.08] hover:text-white/90 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
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
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
