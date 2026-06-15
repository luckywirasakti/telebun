import { signPayload, verifySignature } from '../utils/crypto.js';
import type { CallbackPayload, TelegramUser } from '../types.js';

/**
 * Build the canonical payload string for signing.
 *
 * The payload is a deterministic, pipe-delimited string so that
 * the producer (bot callback) and consumer (telebun) agree on format.
 */
export function buildSignablePayload(
  sessionId: string,
  userId: number,
  authenticatedAt: string,
): string {
  return [sessionId, String(userId), authenticatedAt].join('|');
}

/**
 * Create a signed callback payload ready to POST to the webhook endpoint.
 *
 * @param sessionId     The session being authenticated
 * @param user          Telegram user data
 * @param botToken      Bot API token (used as HMAC secret)
 * @returns             CallbackPayload with HMAC signature
 */
export function createSignedCallback(
  sessionId: string,
  user: TelegramUser,
  botToken: string,
): CallbackPayload {
  const authenticatedAt = new Date().toISOString();
  const signable = buildSignablePayload(sessionId, user.id, authenticatedAt);
  const signature = signPayload(signable, botToken);

  return {
    sessionId,
    user,
    authenticatedAt,
    signature,
  };
}

/**
 * Verify the HMAC signature on a callback payload.
 *
 * @param payload  The full callback payload received
 * @param secret   The shared HMAC secret (bot token)
 * @returns        true if signature is valid
 */
export function verifyCallbackSignature(
  payload: CallbackPayload,
  secret: string,
): boolean {
  const { sessionId, user, authenticatedAt, signature } = payload;
  const signable = buildSignablePayload(sessionId, user.id, authenticatedAt);
  return verifySignature(signable, signature, secret);
}
