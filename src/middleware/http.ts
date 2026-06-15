import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Telebun } from '../core/telebun.js';
import type { CallbackPayload } from '../types.js';

/**
 * Create a raw Node.js `http` request handler that exposes:
 *
 * - `POST /qr`          → generate QR session → returns JSON
 * - `POST /callback`    → handle bot callback  → returns AuthResult
 * - `GET  /session/:id` → check session status → returns session or 404
 *
 * @example
 * ```ts
 * import { createServer } from 'node:http';
 * import { Telebun } from 'telebun';
 * import { createHttpHandler } from 'telebun/http';
 *
 * const telebun = new Telebun({ ... });
 * const handler = createHttpHandler(telebun);
 * createServer(handler).listen(3000);
 * ```
 */
export function createHttpHandler(telebun: Telebun) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // CORS (permissive for QR auth use-case)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const path = url.pathname;

      // ── Generate QR ────────────────────────────────────────────────
      if (req.method === 'POST' && path === '/qr') {
        const body = await readBody(req);
        const rawMeta = body.metadata;
        const metadata: Record<string, unknown> | undefined =
          rawMeta && typeof rawMeta === 'object'
            ? (rawMeta as Record<string, unknown>)
            : undefined;
        const result = await telebun.generate(
          metadata ? { metadata } : undefined,
        );
        writeJson(res, 200, result);
        return;
      }

      // ── Handle callback ────────────────────────────────────────────
      if (req.method === 'POST' && path === '/callback') {
        const body = await readBody(req);
        const result = await telebun.handleCallback(body as unknown as CallbackPayload);
        writeJson(res, result.success ? 200 : 400, result);
        return;
      }

      // ── Check session ──────────────────────────────────────────────
      const sessionMatch = path.match(/^\/session\/([a-f0-9]+)$/);
      if (req.method === 'GET' && sessionMatch) {
        const sessionId = sessionMatch[1];
        const session = await telebun.checkSession(sessionId);
        if (!session) {
          writeJson(res, 404, { ok: false, error: 'Session not found' });
          return;
        }
        writeJson(res, 200, { ok: true, session });
        return;
      }

      writeJson(res, 404, { ok: false, error: 'Not found' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      writeJson(res, 500, { ok: false, error: message });
    }
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function writeJson(res: ServerResponse, code: number, data: unknown): void {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        resolve({});
      }
    });
  });
}
