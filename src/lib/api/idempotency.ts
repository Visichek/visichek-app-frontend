/**
 * Generate an Idempotency-Key for a bulk POST. The backend accepts
 * `^[A-Za-z0-9._\-:+/=]{8,200}$` and rejects anything outside that.
 *
 * `crypto.randomUUID()` is available in every browser we support and in
 * the Node 19+ runtime Next.js uses. The fallback is a defensive belt
 * against very old environments — never user input.
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: 16 random bytes, hex-encoded.
  const arr = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i += 1) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
