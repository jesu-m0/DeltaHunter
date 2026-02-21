"use client";

import { useState, useRef, useCallback } from "react";

interface Props {
  onAnalyze: (userFile: File, refFile: File) => void;
  loading: boolean;
  error: string | null;
}

function DropBox({
  label,
  file,
  onFile,
}: {
  label: string;
  file: File | null;
  onFile: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f && f.name.endsWith(".ld")) onFile(f);
    },
    [onFile]
  );

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center gap-3
        w-full h-48 rounded-xl border-2 border-dashed cursor-pointer
        transition-all duration-200
        ${
          dragOver
            ? "border-user bg-user/5"
            : file
            ? "border-gain/40 bg-gain/5"
            : "border-border hover:border-txt-dim bg-surface"
        }
      `}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".ld"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      {file ? (
        <>
          <svg
            className="w-8 h-8 text-gain"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="text-sm text-txt font-medium">{file.name}</span>
          <span className="text-xs text-txt-dim">
            {(file.size / 1024).toFixed(0)} KB
          </span>
        </>
      ) : (
        <>
          <svg
            className="w-10 h-10 text-txt-dim"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <span className="text-sm text-txt-dim">{label}</span>
          <span className="text-xs text-txt-dim/60">
            Drag & drop or click to browse
          </span>
        </>
      )}
    </div>
  );
}

export default function UploadZone({ onAnalyze, loading, error }: Props) {
  const [userFile, setUserFile] = useState<File | null>(null);
  const [refFile, setRefFile] = useState<File | null>(null);

  const canAnalyze = userFile && refFile && !loading;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-txt-dim mb-2">
            <span className="inline-block w-2 h-2 rounded-full bg-user mr-2" />
            Your lap (.ld)
          </label>
          <DropBox
            label="Your telemetry file"
            file={userFile}
            onFile={setUserFile}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-txt-dim mb-2">
            <span className="inline-block w-2 h-2 rounded-full bg-ref mr-2" />
            Reference lap (.ld)
          </label>
          <DropBox
            label="Reference telemetry file"
            file={refFile}
            onFile={setRefFile}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-loss/10 border border-loss/30 text-loss text-sm">
          {error}
        </div>
      )}

      <button
        disabled={!canAnalyze}
        onClick={() => {
          if (userFile && refFile) onAnalyze(userFile, refFile);
        }}
        className={`
          w-full py-3 px-6 rounded-xl font-semibold text-base
          transition-all duration-200
          ${
            canAnalyze
              ? "bg-user text-white hover:bg-user/90 active:scale-[0.98]"
              : "bg-surface2 text-txt-dim cursor-not-allowed"
          }
        `}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            Analyzing telemetry...
          </span>
        ) : (
          "Analyze"
        )}
      </button>
    </div>
  );
}
