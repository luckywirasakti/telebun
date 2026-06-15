/**
 * Express.js integration example for Telebun.
 *
 * Run:
 *   npm install express
 *   npx tsx examples/express-example.ts
 *
 * Then:
 *   curl -X POST http://localhost:3000/api/auth/qr
 *   curl http://localhost:3000/api/auth/session/<sessionId>
 */

import { Telebun } from '../dist/core/telebun.js';
import { createExpressMiddleware } from '../dist/middleware/express.js';

// --- Replace with your actual bot credentials ---
const TELEBUN_CONFIG = {
  botToken: process.env.BOT_TOKEN || '1234567890:AAAA...',
  botUsername: process.env.BOT_USERNAME || 'YourAuthBot',
  callbackBaseUrl: process.env.CALLBACK_URL || 'https://example.com/api/auth',
};

const telebun = new Telebun(TELEBUN_CONFIG);

// Dynamic import of express
async function main() {
  const express = (await import('express')).default;
  const app = express();

  // Parse JSON bodies
  app.use(express.json());

  // Mount Telebun middleware
  app.use('/api/auth', createExpressMiddleware(telebun));

  // Your other routes
  app.get('/', (_req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Telebun Demo</title></head>
      <body>
        <h1>🔐 Telebun Demo</h1>
        <div id="qr"></div>
        <div id="status"></div>
        <script>
          fetch('/api/auth/qr', { method: 'POST' })
            .then(r => r.json())
            .then(data => {
              document.getElementById('qr').innerHTML =
                '<img src="' + data.qrDataUrl + '" alt="Scan with Telegram">';
              document.getElementById('status').textContent =
                'Session: ' + data.sessionId;

              // Poll for verification
              const poll = setInterval(() => {
                fetch('/api/auth/session/' + data.sessionId)
                  .then(r => r.json())
                  .then(res => {
                    if (res.session?.status === 'verified') {
                      document.getElementById('status').textContent =
                        '✅ Authenticated as ' + res.session.user?.firstName;
                      clearInterval(poll);
                    }
                  });
              }, 1000);
            });
        </script>
      </body>
      </html>
    `);
  });

  app.listen(3000, () => {
    console.log('🚀 Telebun demo running on http://localhost:3000');
  });
}

main().catch(console.error);
