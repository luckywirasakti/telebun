import type { SessionStore, QRSession } from '../../types.js';

/**
 * In-memory session store.
 *
 * **This is the default backend.** It works perfectly for single-process
 * deployments. For multi-process or serverless (Lambda, etc.) scenarios,
 * swap to a persistent store such as `RedisStore`.
 */
export class MemoryStore implements SessionStore {
  private readonly _sessions = new Map<string, QRSession>();

  async create(session: QRSession): Promise<void> {
    this._sessions.set(session.id, { ...session });
  }

  async get(id: string): Promise<QRSession | null> {
    return this._sessions.get(id) ?? null;
  }

  async update(id: string, patch: Partial<QRSession>): Promise<void> {
    const existing = this._sessions.get(id);
    if (existing) {
      this._sessions.set(id, { ...existing, ...patch });
    }
  }

  async delete(id: string): Promise<void> {
    this._sessions.delete(id);
  }

  async cleanup(): Promise<number> {
    const now = Date.now();
    let removed = 0;
    const entries = Array.from(this._sessions.entries());
    for (const [id, session] of entries) {
      if (session.expiresAt <= now) {
        this._sessions.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /** Return the number of active sessions (useful for diagnostics) */
  get size(): number {
    return this._sessions.size;
  }
}
