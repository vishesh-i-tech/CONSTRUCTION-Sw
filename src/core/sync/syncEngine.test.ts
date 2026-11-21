/// <reference types="node" />
import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

// Shim window, localStorage, and crypto for Node.js test environment
if (typeof window === 'undefined') {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => store.set(key, val),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };

  (globalThis as any).window = globalThis;
  (globalThis as any).localStorage = mockLocalStorage;
}

import {
  dataUrlToBlob,
  enqueueSyncMutation,
  subscribeSyncStatus,
} from './syncEngine.ts';
import {
  storeTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  clearStoredTokens,
} from '../../services/apiClient.ts';
import { db } from '../db/database.ts';

test('Phase 3 Sync Engine & API Client Tests', async (t) => {
  await t.test('dataUrlToBlob converts base64 image data URL to binary Blob', () => {
    // 1x1 transparent PNG in base64
    const pngBase64 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const blob = dataUrlToBlob(pngBase64);
    assert.equal(blob.type, 'image/png');
    assert.ok(blob.size > 0);
  });

  await t.test('dataUrlToBlob handles audio/webm MIME type correctly', () => {
    const audioDataUrl = 'data:audio/webm;codecs=opus;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwE=';
    const blob = dataUrlToBlob(audioDataUrl);
    assert.ok(blob.type.startsWith('audio/webm'));
    assert.ok(blob.size > 0);
  });

  await t.test('apiClient token storage works with get, store, clear', () => {
    clearStoredTokens();
    assert.equal(getStoredAccessToken(), null);
    assert.equal(getStoredRefreshToken(), null);

    storeTokens('test-access-token-123', 'test-refresh-token-456');
    assert.equal(getStoredAccessToken(), 'test-access-token-123');
    assert.equal(getStoredRefreshToken(), 'test-refresh-token-456');

    clearStoredTokens();
    assert.equal(getStoredAccessToken(), null);
    assert.equal(getStoredRefreshToken(), null);
  });

  await t.test('enqueueSyncMutation queues daily record mutation into Dexie outbox', async () => {
    const sampleRecord = {
      clientId: `test-client-${Date.now()}`,
      siteId: 'site-test-1',
      date: '2026-11-21',
      status: 'full_day',
      totalLabour: 12,
      workProgress: 'Brickwork 2nd floor completed',
      issues: ['material_delay'],
    };

    const outboxId = await enqueueSyncMutation('daily_record', 'create', sampleRecord);
    assert.ok(outboxId, 'Expected an outbox ID string');

    const item = await db.syncOutbox.get(outboxId);
    assert.ok(item, 'Expected item to exist in Dexie syncOutbox table');
    assert.equal(item.entity, 'daily_record');
    assert.equal(item.action, 'create');
    assert.equal(item.status, 'pending');
    assert.equal(item.payload.workProgress, 'Brickwork 2nd floor completed');
    assert.equal(item.retryCount, 0);

    // Clean up
    await db.syncOutbox.delete(outboxId);
  });

  await t.test('subscribeSyncStatus receives status notifications', async () => {
    let received = false;
    let receivedCount = -1;

    const unsubscribe = subscribeSyncStatus((status) => {
      received = true;
      receivedCount = status.pendingCount;
    });

    // Wait a tick for async initial notification
    await new Promise((r) => setTimeout(r, 20));

    assert.ok(received, 'Listener should receive initial status');
    assert.ok(receivedCount >= 0, 'Pending count should be a non-negative integer');

    unsubscribe();
  });
});
