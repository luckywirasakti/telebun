// ─── Types & Interfaces ───────────────────────────────────────────────────────

/** Configuration for Telebun instance */
export interface TelebunConfig {
  /** Telegram Bot API token (from @BotFather) */
  botToken: string;
  /** Bot username (without @) — used in deep links */
  botUsername: string;
  /** Public HTTPS URL where telebun callback handler is mounted */
  callbackBaseUrl: string;
  /** Session TTL in ms (default: 5 minutes) */
  sessionTTL?: number;
  /** Optional secret for additional payload signing */
  hmacSecret?: string;
}

/** All possible states of a QR auth session */
export type SessionStatus = 'pending' | 'expired' | 'verified';

/** Telegram user info returned after successful auth */
export interface TelegramUser {
  id: number;
  username?: string;
  firstName: string;
  lastName?: string;
  languageCode?: string;
  /** URL of user's Telegram profile photo (if available) */
  photoUrl?: string;
}

/** Data payload that the bot sends back to the callback endpoint */
export interface CallbackPayload {
  sessionId: string;
  user: TelegramUser;
  /** ISO-8601 timestamp of when auth was granted */
  authenticatedAt: string;
  /** HMAC-SHA256 hex digest for integrity verification */
  signature: string;
}

/** A QR authentication session */
export interface QRSession {
  id: string;
  status: SessionStatus;
  createdAt: number;
  expiresAt: number;
  /** Telegram user data — only present when status === 'verified' */
  user?: TelegramUser;
  /** Arbitrary metadata attached on creation (e.g., IP, user-agent) */
  metadata?: Record<string, unknown>;
}

/** Result returned by the callback handler */
export interface AuthResult {
  success: boolean;
  session?: QRSession;
  error?: string;
}

/** Options for generate() */
export interface GenerateOptions {
  /** Arbitrary metadata to associate with this session */
  metadata?: Record<string, unknown>;
}

/** Result of generate() */
export interface GenerateResult {
  sessionId: string;
  /** Base64 PNG data URL of the QR code */
  qrDataUrl: string;
  /** URL encoded in the QR code (deep link to bot) */
  deepLink: string;
  /** Session expiry timestamp (epoch ms) */
  expiresAt: number;
}

/** Persistence contract — implement this to plug in any storage backend */
export interface SessionStore {
  create(session: QRSession): Promise<void>;
  get(id: string): Promise<QRSession | null>;
  update(id: string, patch: Partial<QRSession>): Promise<void>;
  delete(id: string): Promise<void>;
  /** Remove expired sessions. Returns number of removed entries. */
  cleanup(): Promise<number>;
}

/** Express-compatible request and response (duck-typing, no hard dep) */
export interface ExpressReq {
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
}

export interface ExpressRes {
  status(code: number): ExpressRes;
  json(data: unknown): void;
  send(data: unknown): void;
}

/** Type guard for Express-style next function */
export type ExpressNext = (err?: unknown) => void;
