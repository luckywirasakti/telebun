import type { SessionStore, QRSession } from '../../types.js';

/**
 * Redis-backed session store.
 *
 * Uses Redis with TTL (EXPIRE) so expired sessions are
 * automatically evicted by Redis — no manual cleanup needed.
 *
 * **Note:** This adapter requires the `redis` package to be installed:
 * ```bash
 * npm install redis
 * ```
 *
 * @example
 * ```ts
 * import { createClient } from 'redis';
 * const client = createClient({ url: 'redis://localhost:6379' });
 * await client.connect();
 *
 * const store = new RedisStore(client, { prefix: 'telebun:' });
 * ```
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisClient = any;

export class RedisStore implements SessionStore {
  private readonly _client: RedisClient;
  private readonly _prefix: string;

  constructor(client: RedisClient, options?: { prefix?: string }) {
    this._client = client;
    this._prefix = options?.prefix ?? 'telebun:';
  }

  private _key(id: string): string {
    return `${this._prefix}${id}`;
  }

  async create(session: QRSession): Promise<void> {
    const ttl = Math.ceil((session.expiresAt - Date.now()) / 1000);
    if (ttl <= 0) return;
    await this._client.set(this._key(session.id), JSON.stringify(session), {
      EX: ttl,
    });
  }

  async get(id: string): Promise<QRSession | null> {
    const raw = await this._client.get(this._key(id));
    if (!raw) return null;
    return JSON.parse(raw) as QRSession;
  }

  async update(id: string, patch: Partial<QRSession>): Promise<void> {
    const existing = await this.get(id);
    if (!existing) return;
    const updated = { ...existing, ...patch };
    const ttl = Math.ceil((updated.expiresAt - Date.now()) / 1000);
    if (ttl <= 0) {
      await this.delete(id);
      return;
    }
    await this._client.set(this._key(id), JSON.stringify(updated), {
      EX: ttl,
    });
  }

  async delete(id: string): Promise<void> {
    await this._client.del(this._key(id));
  }

  async cleanup(): Promise<number> {
    // Handled automatically by Redis TTL
    return 0;
  }
}
