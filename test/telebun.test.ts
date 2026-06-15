import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Telebun } from '../dist/core/telebun.js';

// We test against the compiled JS so we validate the build artifact.
// Before running these tests, run `npm run build` first.

const CONFIG = {
  botToken: '123456789:ABCdefGHIjklmNOPqrstUVwxyz123456789',
  botUsername: 'TestAuthBot',
  callbackBaseUrl: 'https://example.com/api/auth',
};

describe('Telebun', () => {
  let telebun: Telebun;

  before(() => {
    telebun = new Telebun(CONFIG);
  });

  after(() => {
    telebun.dispose();
  });

  it('should generate a QR session', async () => {
    const result = await telebun.generate({ metadata: { source: 'test' } });

    assert.ok(result.sessionId);
    assert.match(result.qrDataUrl, /^data:image\/png;base64,/);
    assert.ok(result.deepLink.includes(CONFIG.botUsername));
    assert.ok(result.deepLink.includes(result.sessionId));
    assert.ok(result.expiresAt > Date.now());
  });

  it('should reject invalid config', () => {
    assert.throws(() => new Telebun({ ...CONFIG, botToken: '' as string }));
    assert.throws(() => new Telebun({ ...CONFIG, botUsername: '' as string }));
    assert.throws(() => new Telebun({ ...CONFIG, callbackBaseUrl: '' as string }));
  });

  it('should reject callback with invalid signature', async () => {
    const result = await telebun.generate();
    const fakePayload = {
      sessionId: result.sessionId,
      user: { id: 123, firstName: 'Hacker' },
      authenticatedAt: new Date().toISOString(),
      signature: 'bad_sig_here',
    };

    await assert.rejects(
      () => telebun.handleCallback(fakePayload as never),
      /signature/i,
    );
  });

  it('should handle a valid callback', async () => {
    const { sessionId } = await telebun.generate();

    // Build a proper signed callback
    const { createSignedCallback } = await import('../dist/auth/validator.js');
    const user = { id: 42, username: 'testuser', firstName: 'Test' };
    const payload = createSignedCallback(sessionId, user, CONFIG.botToken);

    const result = await telebun.handleCallback(payload);

    assert.ok(result.success);
    assert.equal(result.session?.status, 'verified');
    assert.equal(result.session?.user?.id, 42);
  });

  it('should return session via checkSession', async () => {
    const { sessionId } = await telebun.generate();

    // Should exist and be pending
    const pending = await telebun.checkSession(sessionId);
    assert.ok(pending);
    assert.equal(pending!.status, 'pending');

    // After verification
    const { createSignedCallback } = await import('../dist/auth/validator.js');
    const user = { id: 7, firstName: 'Alice' };
    await telebun.handleCallback(
      createSignedCallback(sessionId, user, CONFIG.botToken),
    );

    const verified = await telebun.checkSession(sessionId);
    assert.equal(verified?.status, 'verified');
  });

  it('should return null for unknown session', async () => {
    const session = await telebun.checkSession('deadbeefdeadbeefdeadbeef');
    assert.equal(session, null);
  });

  it('should expire sessions', async () => {
    const short = new Telebun({ ...CONFIG, sessionTTL: 10 }); // 10ms TTL
    const { sessionId } = await short.generate();

    await new Promise((r) => setTimeout(r, 50));

    const session = await short.checkSession(sessionId);
    assert.equal(session, null);
    short.dispose();
  });
});
