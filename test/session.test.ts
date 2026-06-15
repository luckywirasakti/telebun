import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../dist/session/stores/memory.js';
import type { QRSession } from '../dist/types.js';

const makeSession = (overrides?: Partial<QRSession>): QRSession => ({
  id: 'test123',
  status: 'pending',
  createdAt: Date.now(),
  expiresAt: Date.now() + 300_000,
  ...overrides,
});

describe('MemoryStore', () => {
  it('should create and retrieve a session', async () => {
    const store = new MemoryStore();
    const session = makeSession();
    await store.create(session);

    const got = await store.get(session.id);
    assert.deepEqual(got, session);
  });

  it('should return null for missing session', async () => {
    const store = new MemoryStore();
    const got = await store.get('nope');
    assert.equal(got, null);
  });

  it('should update a session', async () => {
    const store = new MemoryStore();
    const session = makeSession();
    await store.create(session);

    await store.update(session.id, { status: 'verified' });
    const got = await store.get(session.id);
    assert.equal(got?.status, 'verified');
  });

  it('should delete a session', async () => {
    const store = new MemoryStore();
    const session = makeSession();
    await store.create(session);
    await store.delete(session.id);
    assert.equal(await store.get(session.id), null);
  });

  it('should clean up only expired sessions', async () => {
    const store = new MemoryStore();
    await store.create(makeSession({ id: 'a', expiresAt: Date.now() - 1000 }));
    await store.create(makeSession({ id: 'b', expiresAt: Date.now() + 60_000 })); // still valid
    await store.create(makeSession({ id: 'c', expiresAt: Date.now() - 1000 }));

    const removed = await store.cleanup();
    assert.equal(removed, 2); // only 'a' and 'c' expired
    assert.equal(await store.get('a'), null);
    assert.ok(await store.get('b')); // 'b' should still exist
    assert.equal(await store.get('c'), null);
  });
});
