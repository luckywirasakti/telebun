import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Number of random bytes used for session IDs */
const ID_BYTES = 24;

/**
 * Generate a cryptographically-secure random hex string.
 * Used for session IDs and ephemeral challenges.
 */
export function randomHex(len: number = ID_BYTES): string {
  return randomBytes(len).toString('hex');
}

/**
 * Create an HMAC-SHA256 hex digest.
 * `payload` MUST be sorted by key (or be a pre-encoded string)
 * for deterministic signing across producers and consumers.
 */
export function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

/**
 * Verify an HMAC-SHA256 hex digest against a payload.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = signPayload(payload, secret);
  // Different lengths ⇒ fast-fail without leaking payload length
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
