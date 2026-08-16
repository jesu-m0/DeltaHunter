/**
 * Turns a failed request into a message that names the step and the cause.
 *
 * Some failures never reach our Python function: Vercel's edge rejects the
 * request first and answers with its own plain-text or HTML page. Rendering
 * that body verbatim produced errors like "Forbidden FORBIDDEN cdg1::iad1::x",
 * which say neither what failed nor what to do about it, so the platform's
 * error codes are translated here instead.
 */

const EDGE_ERRORS: Record<string, string> = {
  FUNCTION_PAYLOAD_TOO_LARGE:
    "the upload was bigger than the 4.5 MB the server accepts in one request",
  FUNCTION_RESPONSE_PAYLOAD_TOO_LARGE:
    "the server's response was bigger than the 4.5 MB limit",
  FUNCTION_INVOCATION_TIMEOUT:
    "the server ran out of time (30 s) while processing the telemetry",
  FUNCTION_INVOCATION_FAILED: "the server crashed while processing the telemetry",
  FUNCTION_THROTTLED: "the server is rate-limiting requests — try again in a moment",
  NO_RESPONSE_FROM_FUNCTION: "the server closed the connection without replying",
  DEPLOYMENT_BLOCKED: "this deployment is blocked",
  DEPLOYMENT_PAUSED: "this deployment is paused",
  DEPLOYMENT_NOT_FOUND: "this deployment no longer exists",
  ROUTER_CANNOT_MATCH: "the request did not match any route on the server",
};

/** Flattens an edge error page (HTML or plain text) into one readable line. */
function readable(body: string): string {
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

/**
 * Describes a non-OK response. `step` is what the app was doing, phrased so it
 * reads as the start of a sentence ("Loading the demo session").
 */
export async function describeResponseError(
  res: Response,
  step: string
): Promise<string> {
  const code = res.headers.get("x-vercel-error");
  const mitigated = res.headers.get("x-vercel-mitigated");
  const requestId = res.headers.get("x-vercel-id");
  const body = await res.text().catch(() => "");

  // Our own endpoints always answer JSON, so anything else came from the edge.
  let detail = "";
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.error === "string") detail = parsed.error;
  } catch {
    // Not our JSON — fall through to the platform-level explanations below.
  }

  if (!detail && mitigated) {
    detail =
      `the Vercel firewall blocked the request (${mitigated}). Reload the page ` +
      `and try again; if it keeps happening, check Firewall in the Vercel dashboard`;
  }
  if (!detail && code) {
    detail = EDGE_ERRORS[code] ?? `the platform rejected the request (${code})`;
  }
  if (!detail && res.status === 403) {
    detail =
      "the server refused the request. This is usually bot/DDoS mitigation or " +
      "deployment protection rather than the telemetry itself";
  }
  if (!detail) {
    detail = readable(body) || `the server answered ${res.status}`;
  }

  const trace = [`HTTP ${res.status}`, requestId].filter(Boolean).join(" · ");
  return `${step}: ${detail} [${trace}]`;
}

/**
 * Reads a successful response as JSON, naming the step if the body turns out
 * to be truncated or not JSON at all.
 */
export async function readJson<T>(res: Response, step: string): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch (e) {
    const reason = e instanceof Error ? e.message : "invalid JSON";
    throw new Error(`${step}: the server's reply could not be read (${reason})`);
  }
}

/**
 * Describes a fetch that never got a response. Safari reports these as
 * "Load failed" with no further detail, so the message has to supply the
 * likely causes itself.
 */
export function describeNetworkError(e: unknown, step: string): string {
  const reason = e instanceof Error ? e.message : String(e);
  return (
    `${step}: could not reach the server (${reason}). The connection dropped, ` +
    `timed out, or was blocked before it arrived.`
  );
}
