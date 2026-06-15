import { randomHex } from '../utils/crypto.js';
import { generateQR } from '../qr/generator.js';
import { verifyCallbackSignature } from '../auth/validator.js';
import { MemoryStore } from '../session/stores/memory.js';
import {
  TelebunError,
  ConfigError,
  SessionNotFoundError,
  SignatureError,
} from './errors.js';
import type {
  TelebunConfig,
  SessionStore,
  QRSession,
  AuthResult,
  GenerateOptions,
  GenerateResult,
  CallbackPayload,
} from '../types.js';

const DEFAULT_SESSION_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Telebun — Telegram QR Authentication engine.
 *
 * @example
 * ```ts
 * const telebun = new Telebun({
 *   botToken: '123456:ABC-DEF1234',
 *   botUsername: 'MyAuthBot',
 *   callbackBaseUrl: 'https://example.com/api/auth',
 * });
 *
 * // 1. Generate QR
 * const { sessionId, qrDataUrl } = await telebun.generate();
 *
 * // 2. Handle callback (from your HTTP endpoint)
 * const result = await telebun.handleCallback(payload);
 *
 * // 3. Check session status
 * const session = await telebun.checkSession(sessionId);
 * ```
 */
export class Telebun {
  private readonly _config: TelebunConfig;
  private readonly _store: SessionStore;
  private _cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: TelebunConfig, store?: SessionStore) {
    this._validateConfig(config);
    this._config = {
      sessionTTL: DEFAULT_SESSION_TTL,
      ...config,
    };
    this._store = store ?? new MemoryStore();
    this._startCleanupLoop();
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Generate a new QR authentication session.
   *
   * Returns a QR code (as base64 data URL), the session ID, and the
   * underlying deep link so you can render alternative UIs.
   */
  async generate(options?: GenerateOptions): Promise<GenerateResult> {
    const now = Date.now();
    const sessionId = randomHex();
    const ttl = this._config.sessionTTL!;

    const session: QRSession = {
      id: sessionId,
      status: 'pending',
      createdAt: now,
      expiresAt: now + ttl,
      metadata: options?.metadata,
    };

    await this._store.create(session);

    const { dataUrl, deepLink } = await generateQR(
      this._config.botUsername,
      sessionId,
    );

    return { sessionId, qrDataUrl: dataUrl, deepLink, expiresAt: session.expiresAt };
  }

  /**
   * Process a callback from the Telegram bot webhook.
   *
   * Verifies the HMAC signature, marks the session as verified, and
   * attaches the Telegram user data.
   *
   * @param payload  Signed callback payload from the bot
   * @throws SignatureError if HMAC verification fails
   * @throws SessionNotFoundError if the session doesn't exist / expired
   */
  async handleCallback(payload: CallbackPayload): Promise<AuthResult> {
    try {
      // 1. Verify HMAC signature
      const secret = this._config.hmacSecret ?? this._config.botToken;
      if (!verifyCallbackSignature(payload, secret)) {
        throw new SignatureError('payload may have been tampered with');
      }

      // 2. Look up the session
      const session = await this._store.get(payload.sessionId);
      if (!session || session.expiresAt <= Date.now()) {
        throw new SessionNotFoundError(payload.sessionId);
      }

      // 3. Mark as verified
      const updated: QRSession = {
        ...session,
        status: 'verified',
        user: payload.user,
      };
      await this._store.update(payload.sessionId, updated);

      return { success: true, session: updated };
    } catch (err) {
      if (err instanceof TelebunError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  /**
   * Get the current status of a session.
   *
   * Returns `null` if the session doesn't exist or has expired (the
   * cleanup loop removes expired entries lazily, so this call also
   * performs an implicit expiry check).
   */
  async checkSession(sessionId: string): Promise<QRSession | null> {
    const session = await this._store.get(sessionId);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      await this._store.delete(sessionId);
      return null;
    }
    return session;
  }

  /**
   * Wait for a session to be verified (long-poll).
   *
   * Polls `checkSession` every `interval` ms until the session is
   * verified, expired, or `timeout` ms elapsed.
   *
   * @returns  The verified session, or `null` if timeout/expired
   */
  async waitForSession(
    sessionId: string,
    options?: { timeout?: number; interval?: number },
  ): Promise<QRSession | null> {
    const timeout = options?.timeout ?? 60_000;
    const interval = options?.interval ?? 1_000;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const session = await this.checkSession(sessionId);
      if (!session) return null;
      if (session.status === 'verified') return session;
      await sleep(interval);
    }
    return null;
  }

  /** Dispose the instance — stops the cleanup timer. */
  dispose(): void {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private _validateConfig(config: TelebunConfig): void {
    if (!config.botToken) throw new ConfigError('botToken', 'required');
    if (!config.botUsername) throw new ConfigError('botUsername', 'required');
    if (!config.callbackBaseUrl) {
      throw new ConfigError('callbackBaseUrl', 'required');
    }
    if (!/^\d+:[\w-]+$/.test(config.botToken)) {
      throw new ConfigError(
        'botToken',
        'expected format: <numeric_id>:<API_key>',
      );
    }
  }

  /**
   * Start a periodic cleanup timer that removes expired sessions
   * from the store every 60 seconds.
   */
  private _startCleanupLoop(): void {
    this._cleanupTimer = setInterval(() => {
      this._store.cleanup().catch(() => {
        /* swallow — cleanup is best-effort */
      });
    }, 60_000);
    // Allow the process to exit even if the timer is still alive
    if (this._cleanupTimer && typeof this._cleanupTimer === 'object') {
      if ('unref' in this._cleanupTimer) {
        (this._cleanupTimer as ReturnType<typeof setInterval>).unref();
      }
    }
  }
}

/** Tiny helper — Promisified setTimeout */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Re-export error classes so callers can catch by type
export { TelebunError, ConfigError, SignatureError, SessionNotFoundError } from './errors.js';
