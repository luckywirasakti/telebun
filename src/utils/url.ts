/**
 * Build the Telegram deep link URL that gets encoded in the QR code.
 *
 * When a user scans the QR code with their Telegram app, this URL opens
 * a chat with the bot and sends `/start <sessionId>` automatically.
 *
 * @param botUsername  Bot username (without @)
 * @param sessionId    The generated session ID
 * @returns            Deep link URL
 */
export function buildDeepLink(botUsername: string, sessionId: string): string {
  const safe = encodeURIComponent(sessionId);
  return `https://t.me/${botUsername}?start=${safe}`;
}

/**
 * Strip trailing slash from a base URL for consistent concatenation.
 */
export function normalizeBaseUrl(base: string): string {
  return base.replace(/\/+$/, '');
}
