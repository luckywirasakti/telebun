/**
 * Custom error hierarchy for Telebun.
 * Every error carries a user-facing `message` and a machine-readable `code`.
 */

export class TelebunError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TelebunError';
    this.code = code;
  }
}

/** Thrown when the HMAC signature on a callback is invalid */
export class SignatureError extends TelebunError {
  constructor(detail?: string) {
    super(
      'INVALID_SIGNATURE',
      `Callback signature verification failed${detail ? `: ${detail}` : ''}`,
    );
    this.name = 'SignatureError';
  }
}

/** Thrown when a session ID does not exist or has expired */
export class SessionNotFoundError extends TelebunError {
  constructor(sessionId: string) {
    super('SESSION_NOT_FOUND', `Session "${sessionId}" not found or expired`);
    this.name = 'SessionNotFoundError';
  }
}

/** Thrown when the Telegram Bot API token is missing or invalid */
export class ConfigError extends TelebunError {
  constructor(field: string, hint?: string) {
    super(
      'CONFIG_ERROR',
      `Invalid configuration: ${field}${hint ? ` — ${hint}` : ''}`,
    );
    this.name = 'ConfigError';
  }
}
