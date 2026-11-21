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

  await t.test('Phase 4: Dexie v6 supports materialRequests table and outbox queuing', async () => {
    const requestId = crypto.randomUUID();
    const materialReq = {
      id: requestId,
      clientId: requestId,
      siteId: 'site-phase4-test',
      siteName: 'Sector 62 Site',
      requestedBy: 'user-sup-1',
      requestedByName: 'Ramesh Supervisor',
      status: 'pending' as const,
      urgency: 'urgent' as const,
      notes: 'Need 50 bags OPC 53 grade cement before 2 PM',
      itemsJson: [
        {
          itemName: 'Ultratech Cement 53',
          quantity: 50,
          unit: 'bags',
        },
      ],
      synced: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store in Dexie
    await db.materialRequests.put(materialReq);
    const stored = await db.materialRequests.get(requestId);
    assert.ok(stored, 'Stored material request should exist in db');
    assert.equal(stored.itemsJson.length, 1);
    assert.equal(stored.urgency, 'urgent');

    // Enqueue in sync outbox
    const outboxId = await enqueueSyncMutation('material_request', 'create', materialReq);
    assert.ok(outboxId);
    const outboxItem = await db.syncOutbox.get(outboxId);
    assert.ok(outboxItem);
    assert.equal(outboxItem.entity, 'material_request');

    // Clean up
    await db.materialRequests.delete(requestId);
    await db.syncOutbox.delete(outboxId);
  });

  await t.test('Phase 4: Dexie v6 supports siteTasks table and photo proof requirements', async () => {
    const taskId = crypto.randomUUID();
    const siteTask = {
      id: taskId,
      clientId: taskId,
      siteId: 'site-phase4-test',
      title: 'Fix reinforcement spacing at beam B-12',
      description: 'Rebar spacing should be strictly 150mm c/c',
      priority: 'high' as const,
      status: 'in_progress' as const,
      dueDate: '2026-11-22',
      synced: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store in Dexie
    await db.siteTasks.put(siteTask);
    const storedTask = await db.siteTasks.get(taskId);
    assert.ok(storedTask, 'Stored task should exist');
    assert.equal(storedTask.priority, 'high');
    assert.equal(storedTask.status, 'in_progress');

    // Update with mandatory completion photo proof
    const completionPhotoKey = 'proofs/task-123-done.jpg';
    await db.siteTasks.update(taskId, {
      status: 'done',
      completionPhotoKey,
      completedAt: new Date().toISOString(),
      completedBy: 'user-sup-1',
    });

    const completed = await db.siteTasks.get(taskId);
    assert.ok(completed);
    assert.equal(completed.status, 'done');
    assert.equal(completed.completionPhotoKey, completionPhotoKey);

    // Enqueue update in sync outbox
    const outboxId = await enqueueSyncMutation('site_task', 'update', {
      id: taskId,
      status: 'done',
      completionPhotoKey,
    });
    assert.ok(outboxId);
    const outboxItem = await db.syncOutbox.get(outboxId);
    assert.ok(outboxItem);
    assert.equal(outboxItem.entity, 'site_task');

    // Clean up
    await db.siteTasks.delete(taskId);
    await db.syncOutbox.delete(outboxId);
  });
});
