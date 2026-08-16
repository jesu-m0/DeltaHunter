"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import UploadZone from "@/components/UploadZone";
import {
  describeNetworkError,
  describeResponseError,
  readJson,
} from "@/lib/apiError";
import { lapPayload, useAnalysisStore } from "@/lib/store";
import type { AnalysisResponse, ParsedSession } from "@/lib/types";

/**
 * Vercel rejects request bodies over 4.5 MB at the edge, before the function
 * runs. Stopping just under that lets us explain the problem instead of
 * surfacing the platform's error page.
 */
const MAX_UPLOAD_BYTES = 4.4 * 1024 * 1024;

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

export default function Home() {
  const router = useRouter();
  const setData = useAnalysisStore((s) => s.setData);
  const setParsed = useAnalysisStore((s) => s.setParsed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Gzips an upload when the browser supports it. Without it a 4.9 MB .ld blows
   * past the request limit on its own, so whether it actually happened is
   * reported back for the error message.
   */
  const compress = async (
    file: File
  ): Promise<{ body: Blob; compressed: boolean }> => {
    if (typeof CompressionStream === "undefined") {
      return { body: file, compressed: false };
    }
    try {
      const stream = file.stream().pipeThrough(new CompressionStream("gzip"));
      return { body: await new Response(stream).blob(), compressed: true };
    } catch {
      // Some WebKit builds accept the constructor but fail draining the stream.
      return { body: file, compressed: false };
    }
  };

  const parseSession = async (file: File): Promise<ParsedSession> => {
    const step = `Reading "${file.name}"`;
    const { body, compressed } = await compress(file);

    if (body.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        `${step}: it is ${mb(body.size)} MB` +
          (compressed
            ? " even after compression"
            : " and this browser cannot compress uploads") +
          `, over the ${mb(MAX_UPLOAD_BYTES)} MB the server accepts per request. ` +
          "Export a shorter session (fewer laps) and try again."
      );
    }

    const form = new FormData();
    form.append("file", body, file.name);

    let res: Response;
    try {
      res = await fetch("/api/analyze/parse", { method: "POST", body: form });
    } catch (e) {
      throw new Error(describeNetworkError(e, step));
    }
    if (!res.ok) throw new Error(await describeResponseError(res, step));

    return readJson<ParsedSession>(res, step);
  };

  /**
   * Demo telemetry is parsed server-side from the files bundled with the
   * deployment: the browser never downloads the .ld only to upload it back.
   */
  const loadDemo = async (demoId: string) => {
    const step = "Loading the demo session";
    let res: Response;
    try {
      res = await fetch(`/api/analyze/demo?id=${encodeURIComponent(demoId)}`);
    } catch (e) {
      throw new Error(describeNetworkError(e, step));
    }
    if (!res.ok) throw new Error(await describeResponseError(res, step));

    return readJson<{ user: ParsedSession; ref: ParsedSession | null }>(res, step);
  };

  /** Picks the laps to compare, runs /compare, then opens the dashboard. */
  const runComparison = async (
    userSession: ParsedSession,
    refSession: ParsedSession | null
  ) => {
    let ref = refSession;
    let userLapIdx = -1; // -1 = best
    let refLapIdx = -1;

    if (!ref) {
      // Single session: compare best vs 2nd best lap from the same run
      if (userSession.laps.length < 2) {
        throw new Error(
          "This session only contains one complete lap, so there is nothing to compare it against. " +
            "Upload a reference telemetry file, or a session with more laps."
        );
      }
      ref = userSession;
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

    setParsed(
      userSession,
      ref,
      userLapIdx >= 0 ? userLapIdx : undefined,
      refLapIdx >= 0 ? refLapIdx : undefined
    );

    // Compare — send only the selected laps, not the whole sessions
    const step = "Comparing the two laps";
    let res: Response;
    try {
      res = await fetch("/api/analyze/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_lap: lapPayload(userSession, userLapIdx),
          ref_lap: lapPayload(ref, refLapIdx),
        }),
      });
    } catch (e) {
      throw new Error(describeNetworkError(e, step));
    }
    if (!res.ok) throw new Error(await describeResponseError(res, step));

    setData(await readJson<AnalysisResponse>(res, step));
    router.push("/analysis");
  };

  const handleAnalyze = async (
    userFiles: { ld: File; ldx: File | null },
    refFiles: { ld: File; ldx: File | null } | null
  ) => {
    setLoading(true);
    setError(null);
    try {
      const userSession = await parseSession(userFiles.ld);
      const refSession = refFiles ? await parseSession(refFiles.ld) : null;
      await runComparison(userSession, refSession);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async (demoId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { user, ref } = await loadDemo(demoId);
      await runComparison(user, ref);
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

      <UploadZone
        onAnalyze={handleAnalyze}
        onDemo={handleDemo}
        loading={loading}
        error={error}
      />

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
