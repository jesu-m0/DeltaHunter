"use client";

import { useState, useRef, useCallback } from "react";

interface LapFiles {
  ld: File;
  ldx: File | null;
}

interface Props {
  onAnalyze: (userFiles: LapFiles, refFiles: LapFiles | null) => void;
  loading: boolean;
  error: string | null;
}

const DEMOS = [
  {
    label: "Imola — jesu_m0 vs Cavalli",
    user: "/imola/jesu_m0/21022026-130019-jesum0-fw_cupra_tcr_2024-fn_imolalfm.ld",
    ref: "/imola/cavalli/fn_imola_&_fw_cupra_tcr_2024_&_E. Cavalli_&_stint_3.ld",
  },
  {
    label: "Sepang — jesu_m0 vs Cavalli",
    user: "/sepang/jesum0/22022026-233806-15  Jesus Moreno-fw_cupra_tcr_2024-acu_sepang.ld",
    ref: "/sepang/cavalli/acu_sepang_&_fw_cupra_tcr_2024_&_E. Cavalli_&_stint_22.ld",
  },
  {
    label: "Imola — jesu_m0 (solo session)",
    user: "/imola/jesu_m0/21022026-130019-jesum0-fw_cupra_tcr_2024-fn_imolalfm.ld",
    ref: null,
  },
];

async function fetchAsFile(url: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  const blob = await res.blob();
  const name = url.split("/").pop() ?? "telemetry.ld";
  return new File([blob], name, { type: "application/octet-stream" });
}

function DropBox({
  label,
  ld,
  ldx,
  onFiles,
}: {
  label: string;
  ld: File | null;
  ldx: File | null;
  onFiles: (ld: File | null, ldx: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const processFiles = useCallback(
    (fileList: FileList | File[]) => {
      let newLd: File | null = null;
      let newLdx: File | null = null;

      for (const f of Array.from(fileList)) {
        const name = f.name.toLowerCase();
        if (name.endsWith(".ld") && !name.endsWith(".ldx")) newLd = f;
        else if (name.endsWith(".ldx")) newLdx = f;
      }

      onFiles(newLd ?? ld, newLdx ?? ldx);
    },
    [onFiles, ld, ldx]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center gap-2
        w-full min-h-[12rem] rounded-xl border-2 border-dashed cursor-pointer
        transition-all duration-200
        ${
          dragOver
            ? "border-user bg-user/5"
            : ld
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
        accept=".ld,.ldx"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) processFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {ld ? (
        <>
          <svg
            className="w-7 h-7 text-gain"
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
          <span className="text-sm text-txt font-medium">{ld.name}</span>
          <span className="text-xs text-txt-dim">
            {(ld.size / 1024).toFixed(0)} KB
          </span>
          {ldx ? (
            <span className="text-xs text-gain/70">
              + {ldx.name}
            </span>
          ) : (
            <span className="text-xs text-txt-dim/40">
              .ldx not provided (optional)
            </span>
          )}
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
            .ld required &middot; .ldx optional
          </span>
          <span className="text-xs text-txt-dim/40">
            Drag & drop or click to browse
          </span>
        </>
      )}
    </div>
  );
}

export default function UploadZone({ onAnalyze, loading, error }: Props) {
  const [userLd, setUserLd] = useState<File | null>(null);
  const [userLdx, setUserLdx] = useState<File | null>(null);
  const [refLd, setRefLd] = useState<File | null>(null);
  const [refLdx, setRefLdx] = useState<File | null>(null);
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);

  const canAnalyze = userLd && !loading;

  const handleDemo = async (demo: (typeof DEMOS)[number]) => {
    setLoadingDemo(demo.label);
    try {
      const userFile = await fetchAsFile(demo.user);
      const refFile = demo.ref ? await fetchAsFile(demo.ref) : null;
      onAnalyze(
        { ld: userFile, ldx: null },
        refFile ? { ld: refFile, ldx: null } : null
      );
    } catch {
      // let parent handle error
    } finally {
      setLoadingDemo(null);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-txt-dim mb-2">
            <span className="inline-block w-2 h-2 rounded-full bg-user mr-2" />
            Your telemetry
          </label>
          <DropBox
            label="Your telemetry files"
            ld={userLd}
            ldx={userLdx}
            onFiles={(ld, ldx) => {
              setUserLd(ld);
              setUserLdx(ldx);
            }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-txt-dim mb-2">
            <span className="inline-block w-2 h-2 rounded-full bg-ref mr-2" />
            Reference <span className="text-txt-dim/50">(optional)</span>
          </label>
          <DropBox
            label="Reference telemetry files"
            ld={refLd}
            ldx={refLdx}
            onFiles={(ld, ldx) => {
              setRefLd(ld);
              setRefLdx(ldx);
            }}
          />
        </div>
      </div>

      {!refLd && userLd && (
        <p className="text-xs text-txt-dim/60 text-center mb-4">
          No reference file? Your best and 2nd best laps will be compared automatically.
        </p>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-loss/10 border border-loss/30 text-loss text-sm">
          {error}
        </div>
      )}

      <button
        disabled={!canAnalyze}
        onClick={() => {
          if (userLd)
            onAnalyze(
              { ld: userLd, ldx: userLdx },
              refLd ? { ld: refLd, ldx: refLdx } : null
            );
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

      {/* Demo presets */}
      <div className="mt-8 pt-6 border-t border-border/50">
        <p className="text-xs text-txt-dim uppercase tracking-wider font-semibold mb-3 text-center">
          Or try a demo
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {DEMOS.map((demo) => (
            <button
              key={demo.label}
              disabled={loading || loadingDemo !== null}
              onClick={() => handleDemo(demo)}
              className="px-3 py-1.5 rounded-lg bg-surface2 border border-border text-xs text-txt-dim
                hover:text-txt hover:border-user/40 transition-colors disabled:opacity-50"
            >
              {loadingDemo === demo.label ? "Loading..." : demo.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
