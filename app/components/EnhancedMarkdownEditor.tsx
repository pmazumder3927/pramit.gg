"use client";

import React, { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.css";

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
  placeholder = "Write your content here... You can use KaTeX for math: $c = \\pm\\sqrt{a^2 + b^2}$ or $$c = \\pm\\sqrt{a^2 + b^2}$$",
  height = 400,
}: EnhancedMarkdownEditorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<any>(null);

  const insertAtCursor = useCallback((text: string) => {
    if (editorRef.current) {
      const textarea = editorRef.current.textarea;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = value.substring(0, start);
        const after = value.substring(end);
        const newValue = before + text + after;
        onChange(newValue);
        
        // Set cursor position after inserted text
        setTimeout(() => {
          const newCursorPos = start + text.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          textarea.focus();
        }, 0);
      } else {
        // Fallback: append to end
        const newValue = value + (value.endsWith("\n") ? "" : "\n\n") + text + "\n\n";
        onChange(newValue);
      }
    } else {
      // Fallback: append to end
      const newValue = value + (value.endsWith("\n") ? "" : "\n\n") + text + "\n\n";
      onChange(newValue);
    }
  }, [value, onChange]);

  const uploadFile = useCallback(
    async (file: File) => {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type === "video/mp4";
      
      if (!isImage && !isVideo) {
        alert("Please select an image or MP4 video file");
        return;
      }

      if (file.size > 100 * 1024 * 1024) {
        alert("File must be less than 100MB");
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

        const { url, filename, isVideo } = await response.json();

        // Insert markdown at cursor position
        const markdown = isVideo 
          ? `<video controls width="100%">\n  <source src="${url}" type="video/mp4">\n  Your browser does not support the video tag.\n</video>`
          : `![${filename}](${url})`;
        
        insertAtCursor(markdown);

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
    [insertAtCursor]
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
      const mediaFile = files.find((file) => 
        file.type.startsWith("image/") || file.type === "video/mp4"
      );

      if (mediaFile) {
        uploadFile(mediaFile);
      }
    },
    [uploadFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        uploadFile(file);
      }
      // Reset input
      e.target.value = "";
    },
    [uploadFile]
  );

  const insertMediaClick = useCallback(() => {
    mediaInputRef.current?.click();
  }, []);

  return (
    <div className="relative">
      {/* Hidden file input */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/mp4"
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
              <p className="text-gray-300">Uploading media...</p>
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
              <div className="text-4xl mb-2">📸🎥</div>
              <p className="text-white font-medium">
                Drop image or video here to upload
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media upload button */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={insertMediaClick}
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
            Upload Media
          </button>
          <span className="text-xs text-gray-500">or drag & drop</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>📱 Mobile friendly</span>
          <span>•</span>
          <span>Max 100MB</span>
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
          ref={editorRef}
          value={value}
          onChange={(val) => onChange(val || "")}
          preview="edit"
          height={height}
          hideToolbar={false}
          previewOptions={{
            remarkPlugins: [remarkMath],
            rehypePlugins: [rehypeKatex],
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
        💡 On mobile: Tap &quot;Upload Media&quot; to upload from your camera or gallery
      </div>
    </div>
  );
}
