"use client";

import React, { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import "katex/dist/katex.min.css";

// Dynamic import to avoid SSR issues
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface EnhancedMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
}

export default function EnhancedMarkdownEditor({
  value,
  onChange,
  placeholder = "Write your content in markdown...\n\nMath examples:\nInline: $E = mc^2$\nBlock: $$\n\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}\n$$",
  height = 400,
}: EnhancedMarkdownEditorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewMode, setPreviewMode] = useState<"edit" | "preview">("edit");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file");
        return;
      }

      if (file.size > 25 * 1024 * 1024) {
        alert("Image must be less than 25MB");
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);

      try {
        const formData = new FormData();
        formData.append("file", file);

        // Simulate upload progress
        const progressInterval = setInterval(() => {
          setUploadProgress((prev: number) => Math.min(prev + 10, 90));
        }, 100);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        }

        const { url, filename } = await response.json();

        // Insert image markdown at cursor position
        const imageMarkdown = `![${filename}](${url})`;
        const newValue =
          value + (value.endsWith("\n") ? "" : "\n\n") + imageMarkdown + "\n\n";
        onChange(newValue);

        // Success notification
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
        }, 500);
      } catch (error) {
        console.error("Upload error:", error);
        alert(error instanceof Error ? error.message : "Upload failed");
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [value, onChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files) as File[];
      const imageFile = files.find((file) => file.type.startsWith("image/"));

      if (imageFile) {
        uploadImage(imageFile);
      }
    },
    [uploadImage]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        uploadImage(file);
      }
      // Reset input
      e.target.value = "";
    },
    [uploadImage]
  );

  const insertImageClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="relative">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Upload progress overlay */}
      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center rounded-lg"
          >
            <div className="bg-deep-graphite p-6 rounded-lg flex flex-col items-center">
              <div className="w-16 h-16 mb-4 relative">
                <svg
                  className="w-16 h-16 transform -rotate-90"
                  viewBox="0 0 64 64"
                >
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-gray-700"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={175.84}
                    strokeDashoffset={175.84 - (175.84 * uploadProgress) / 100}
                    className="text-cyber-orange transition-all duration-300"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-mono">{uploadProgress}%</span>
                </div>
              </div>
              <p className="text-gray-300">Uploading image...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-cyber-orange/20 border-2 border-cyber-orange border-dashed z-40 flex items-center justify-center rounded-lg"
          >
            <div className="text-center">
              <div className="text-4xl mb-2">📸</div>
              <p className="text-white font-medium">
                Drop image here to upload
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image upload button */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={insertImageClick}
            className="flex items-center gap-1 px-3 py-1 bg-cyber-orange/20 text-cyber-orange hover:bg-cyber-orange/30 rounded-lg transition-colors text-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Add Image
          </button>
          <span className="text-xs text-gray-500">or drag & drop</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewMode(previewMode === "edit" ? "preview" : "edit")}
            className="flex items-center gap-1 px-3 py-1 bg-cyber-orange/20 text-cyber-orange hover:bg-cyber-orange/30 rounded-lg transition-colors text-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={previewMode === "edit" 
                  ? "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  : "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                }
              />
            </svg>
            {previewMode === "edit" ? "Preview" : "Edit"}
          </button>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>📱 Mobile friendly</span>
            <span>•</span>
            <span>Max 25MB</span>
            <span>•</span>
            <span>✨ Math support</span>
          </div>
        </div>
      </div>

      {/* Editor with drag and drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-color-mode="dark"
        className="relative"
      >
        <MDEditor
          value={value}
          onChange={(val) => onChange(val || "")}
          preview={previewMode}
          height={height}
          hideToolbar={false}
          previewOptions={{
            remarkPlugins: [require("remark-math")],
            rehypePlugins: [require("rehype-katex")],
          }}
          textareaProps={{
            placeholder,
            style: {
              fontSize: "14px",
              fontFamily:
                'ui-monospace, SFMono-Regular, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            },
          }}
        />
      </div>

      {/* Mobile-specific instructions */}
      <div className="md:hidden mt-2 text-xs text-gray-500 text-center">
        💡 On mobile: Tap &quot;Add Image&quot; to upload from your camera or
        gallery
      </div>

      {/* Math help text */}
      <div className="mt-2 text-xs text-gray-500">
        <p className="mb-1">
          <strong>Math support:</strong> Use <code className="bg-white/10 px-1 rounded">$formula$</code> for inline math and <code className="bg-white/10 px-1 rounded">$$formula$$</code> for block math.
        </p>
        <p className="text-gray-600">
          Examples: <code className="bg-white/10 px-1 rounded">$E = mc^2$</code>, <code className="bg-white/10 px-1 rounded">$$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$</code>
        </p>
      </div>
    </div>
  );
}
