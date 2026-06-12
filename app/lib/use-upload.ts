"use client";

import { useCallback, useState } from "react";

// The presigned-URL upload flow, extracted from the old markdown editor so the
// writing room (and anything else) can reuse it. Images, MP4 video, and HTML
// (plotly graphs) up to 100MB, straight to Supabase storage.

export type UploadedFile = {
  url: string;
  fileName: string;
  isVideo: boolean;
  isHtml: boolean;
};

export function acceptsFile(file: File): boolean {
  return (
    file.type.startsWith("image/") ||
    file.type === "video/mp4" ||
    file.type === "text/html" ||
    file.name.endsWith(".html")
  );
}

/** The markdown to drop into a post for an uploaded file. */
export function markdownFor(file: UploadedFile): string {
  if (file.isVideo) {
    return `<video controls width="100%">\n  <source src="${file.url}" type="video/mp4">\n  Your browser does not support the video tag.\n</video>`;
  }
  if (file.isHtml) {
    const title = file.fileName
      .replace(/^\d+_[a-z0-9]+_/, "")
      .replace(/\.html$/, "")
      .replace(/_/g, " ");
    return `\n\n<plotly-graph src="${file.url}" title="${title}" height="500px"></plotly-graph>\n\n`;
  }
  // empty alt on purpose: the room parks the caret inside the brackets so the
  // next keystrokes are the handwritten caption readers will see.
  return `![](${file.url})`;
}

export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = useCallback(async (file: File): Promise<UploadedFile> => {
    if (!acceptsFile(file)) {
      throw new Error("only images, mp4, or html graphs");
    }
    if (file.size > 100 * 1024 * 1024) {
      throw new Error("file must be under 100MB");
    }

    setUploading(true);
    setProgress(5);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || (file.name.endsWith(".html") ? "text/html" : ""),
          fileSize: file.size,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "could not start the upload");
      }
      const { uploadUrl, publicUrl, fileName, isVideo, isHtml } =
        await res.json();

      setProgress(20);
      const put = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!put.ok) throw new Error("the upload smudged — try again?");
      setProgress(85);

      // best-effort verification; failure is non-fatal
      await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: fileName, fileName, publicUrl, isVideo, isHtml }),
      }).catch(() => {});

      setProgress(100);
      return { url: publicUrl, fileName, isVideo, isHtml };
    } finally {
      window.setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 400);
    }
  }, []);

  return { upload, uploading, progress };
}
