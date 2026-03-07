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
    refFiles: { ld: File; ldx: File | null } | null
  ) => {
    setLoading(true);
    setError(null);

    try {
      const compress = async (file: File): Promise<Blob> => {
        const stream = file.stream().pipeThrough(new CompressionStream("gzip"));
        return new Response(stream).blob();
      };

      const parseSession = async (file: File): Promise<ParsedSession> => {
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

      // Parse user session (always)
      const userSession = await parseSession(userFiles.ld);

      // Parse ref session if provided, otherwise reuse user session
      let refSession: ParsedSession;
      let userLapIdx = -1; // -1 = best
      let refLapIdx = -1;

      if (refFiles) {
        refSession = await parseSession(refFiles.ld);
      } else {
        // Single file: compare best vs 2nd best lap from same session
        refSession = userSession;
        if (userSession.laps.length >= 2) {
          userLapIdx = userSession.best_index;
          // Find 2nd best (fastest after best)
          let secondBest = -1;
          let secondTime = Infinity;
          for (let i = 0; i < userSession.laps.length; i++) {
            if (i !== userSession.best_index && userSession.laps[i].lap_time < secondTime) {
              secondTime = userSession.laps[i].lap_time;
              secondBest = i;
            }
          }
          refLapIdx = secondBest >= 0 ? secondBest : 0;
        }
      }

      setParsed(userSession, refSession);

      // Compare
      const compareBody: Record<string, unknown> = {
        user_lap: userSession,
        ref_lap: refSession,
      };
      if (userLapIdx >= 0) compareBody.user_lap_index = userLapIdx;
      if (refLapIdx >= 0) compareBody.ref_lap_index = refLapIdx;

      const res = await fetch("/api/analyze/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(compareBody),
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
          Upload your MoTeC telemetry and instantly see where and why you
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
          Upload one file to compare your own laps, or two to compare against a reference.
        </p>
      </div>
    </main>
  );
}
