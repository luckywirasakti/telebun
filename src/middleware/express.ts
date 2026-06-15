import type { Telebun } from '../core/telebun.js';
import type { ExpressReq, ExpressRes, ExpressNext } from '../types.js';

/**
 * Express-compatible middleware for Telebun.
 *
 * Mounts three routes on the given path:
 * - `POST /qr`          → generate QR session
 * - `POST /callback`    → handle bot callback
 * - `GET  /session/:id` → check session status
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { Telebun } from 'telebun';
 * import { createExpressMiddleware } from 'telebun/express';
 *
 * const app = express();
 * const telebun = new Telebun({ ... });
 *
 * app.use('/api/auth', createExpressMiddleware(telebun));
 * app.listen(3000);
 * ```
 */
export function createExpressMiddleware(telebun: Telebun) {
  return (req: ExpressReq, res: ExpressRes, next: ExpressNext): void => {
    // We need the full path. Express stores the matched mount path
    // in req.baseUrl and the remainder in req.path. We combine them
    // so our internal routing works regardless of mount point.
    const fullPath =
      (req as Record<string, unknown>).baseUrl?.toString() ?? '';
    const relPath = (req as Record<string, unknown>).path?.toString() ?? '';
    const url = new URL(
      fullPath + relPath,
      'http://localhost',
    );

    const method = ((req as Record<string, unknown>).method as string) ?? 'GET';
    const body = (req.body as Record<string, unknown>) ?? {};

    void (async () => {
      try {
        const path = url.pathname;

        // ── Generate QR ──────────────────────────────────────────────
        if (method === 'POST' && path.endsWith('/qr')) {
          const rawMeta = body?.metadata;
          const metadata: Record<string, unknown> | undefined =
            rawMeta && typeof rawMeta === 'object'
              ? (rawMeta as Record<string, unknown>)
              : undefined;
          const result = await telebun.generate(
            metadata ? { metadata } : undefined,
          );
          res.json(result);
          return;
        }

        // ── Handle callback ──────────────────────────────────────────
        if (method === 'POST' && path.endsWith('/callback')) {
          const result = await telebun.handleCallback(body as never);
          res.status(result.success ? 200 : 400).json(result);
          return;
        }

        // ── Check session ────────────────────────────────────────────
        const sessionMatch = path.match(/\/session\/([a-f0-9]+)$/);
        if (method === 'GET' && sessionMatch) {
          const sessionId = sessionMatch[1];
          const session = await telebun.checkSession(sessionId);
          if (!session) {
            res.status(404).json({ ok: false, error: 'Session not found' });
            return;
          }
          res.json({ ok: true, session });
          return;
        }

        next();
      } catch (err) {
        next(err);
      }
    })();
  };
}
