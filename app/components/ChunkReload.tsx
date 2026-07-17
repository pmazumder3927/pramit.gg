"use client";

import { useEffect } from "react";

// After a deploy, clients holding the previous build can fail to fetch
// hashed chunks (observed in session replays as dead taps + hard reloads).
// When a chunk import fails, force one clean reload to pick up the new build.
const CHUNK_ERROR_RE =
  /ChunkLoadError|Loading chunk .+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export default function ChunkReload() {
  useEffect(() => {
    const reloadOnce = () => {
      let last = 0;
      try {
        last = Number(sessionStorage.getItem("chunk-reload") ?? 0);
      } catch {
        /* storage unavailable — still reload, worst case is a plain reload */
      }
      if (Date.now() - last < 60_000) return; // never loop
      try {
        sessionStorage.setItem("chunk-reload", String(Date.now()));
      } catch {}
      window.location.reload();
    };
    const onError = (e: ErrorEvent) => {
      if (e.message && CHUNK_ERROR_RE.test(e.message)) reloadOnce();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const message =
        (e.reason && typeof e.reason === "object" && "message" in e.reason
          ? String((e.reason as { message?: unknown }).message ?? "")
          : String(e.reason ?? "")) || "";
      if (CHUNK_ERROR_RE.test(message)) reloadOnce();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
