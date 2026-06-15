import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { signPayload, verifySignature } from '../dist/utils/crypto.js';
import {
  buildSignablePayload,
  createSignedCallback,
  verifyCallbackSignature,
} from '../dist/auth/validator.js';

const SECRET = 'super-secret-key-12345';

describe('Crypto', () => {
  it('should sign and verify a payload', () => {
    const payload = 'hello|world|42';
    const sig = signPayload(payload, SECRET);
    assert.ok(sig);
    assert.equal(sig.length, 64); // SHA-256 hex = 64 chars
    assert.ok(verifySignature(payload, sig, SECRET));
  });

  it('should reject tampered payload', () => {
    const payload = 'a|b|c';
    const sig = signPayload(payload, SECRET);
    assert.ok(!verifySignature('a|b|X', sig, SECRET));
  });

  it('should reject wrong secret', () => {
    const payload = 'a|b|c';
    const sig = signPayload(payload, SECRET);
    assert.ok(!verifySignature(payload, sig, 'wrong-secret'));
  });
});

describe('Validator', () => {
  it('should build signable payload', () => {
    const result = buildSignablePayload('sess1', 42, '2026-01-01T00:00:00Z');
    assert.equal(result, 'sess1|42|2026-01-01T00:00:00Z');
  });

  it('should create and verify a signed callback', () => {
    const user = { id: 99, username: 'test', firstName: 'Tester' };
    const payload = createSignedCallback('sess1', user, SECRET);
    assert.ok(payload.signature);
    assert.equal(payload.sessionId, 'sess1');

    assert.ok(verifyCallbackSignature(payload, SECRET));
  });

  it('should reject callback with invalid signature', () => {
    const user = { id: 99, firstName: 'Tester' };
    const payload = createSignedCallback('sess1', user, SECRET);
    payload.signature = '0'.repeat(64);
    assert.ok(!verifyCallbackSignature(payload, SECRET));
  });
});
