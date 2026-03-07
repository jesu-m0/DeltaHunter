"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import UploadZone from "@/components/UploadZone";
import { useAnalysisStore } from "@/lib/store";
import type { AnalysisResponse, ParsedSession } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const setData = useAnalysisStore((s) => s.setData);
  const setParsed = useAnalysisStore((s) => s.setParsed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (
    userFiles: { ld: File; ldx: File | null },
    refFiles: { ld: File; ldx: File | null }
  ) => {
    setLoading(true);
    setError(null);

    try {
      const compress = async (file: File): Promise<Blob> => {
        const stream = file.stream().pipeThrough(new CompressionStream("gzip"));
        return new Response(stream).blob();
      };

      const parseLap = async (file: File) => {
        const gz = await compress(file);
        const form = new FormData();
        form.append("file", gz, file.name);
        const res = await fetch("/api/analyze/parse", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Parse failed" }));
          throw new Error(body.error || `Parse failed: ${res.status}`);
        }
        return res.json();
      };

      // Step 1: Parse both files in parallel (each request carries only one file)
      const [userSession, refSession]: [ParsedSession, ParsedSession] =
        await Promise.all([
          parseLap(userFiles.ld),
          parseLap(refFiles.ld),
        ]);

      // Store parsed sessions for later re-comparison with different laps
      setParsed(userSession, refSession);

      // Step 2: Compare the best laps (JSON only, no binary files)
      const res = await fetch("/api/analyze/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_lap: userSession, ref_lap: refSession }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(body.error || `Server error ${res.status}`);
      }

      const data: AnalysisResponse = await res.json();
      setData(data);
      router.push("/analysis");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold mb-3 tracking-tight">
          <span className="text-user">Delta</span>
          <span className="text-txt">Hunter</span>
        </h1>
        <p className="text-txt-dim text-lg max-w-md mx-auto">
          Upload two MoTeC telemetry files and instantly see where and why you
          lose time, corner by corner.
        </p>
      </div>

      <UploadZone onAnalyze={handleAnalyze} loading={loading} error={error} />

      <div className="mt-16 text-center text-txt-dim/50 text-xs max-w-sm">
        <p>
          Supports MoTeC .ld telemetry from Assetto Corsa (Telemetrick & ACTI).
          <br />
          Drop .ld + .ldx together, or just the .ld file.
          <br />
          Files are compressed and processed in-memory, never stored.
        </p>
      </div>
    </main>
  );
}
