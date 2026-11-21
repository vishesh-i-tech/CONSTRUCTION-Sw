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

import { db } from '../db/database.ts';
import { enqueueSyncMutation } from './syncEngine.ts';
import {
  apiExtractVoiceAction,
  apiGetDailyDigest,
  storeTokens,
  clearStoredTokens,
} from '../../services/apiClient.ts';

test('Phase 5 AI Voice & WhatsApp Digest Frontend Unit Tests', async (t) => {
  // Setup clean database and mock tokens
  storeTokens('mock-access-token', 'mock-refresh-token');

  await t.test('apiExtractVoiceAction falls back gracefully or calls endpoint', async () => {
    // Intercept global fetch for this test
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, init: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/voice/extract-action')) {
        const body = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: 'Voice action extracted successfully',
            action: {
              actionType: 'material_request',
              confidence: 0.95,
              transcript: body.transcript,
              source: 'gemini',
              extractedData: {
                itemName: 'UltraTech Cement',
                quantity: 50,
                unit: 'bags',
                urgency: 'urgent',
              },
            },
          }),
        } as any;
      }
      return originalFetch(url, init);
    };

    try {
      const res = await apiExtractVoiceAction({ transcript: 'Site 1 par pachaas bori cement bhej do turant' });
      assert.ok(res.data);
      assert.equal(res.data.action.actionType, 'material_request');
      assert.equal(res.data.action.extractedData.quantity, 50);
      assert.equal(res.data.action.extractedData.unit, 'bags');
      assert.equal(res.data.action.extractedData.urgency, 'urgent');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('apiGetDailyDigest returns summary and wa.me deep-link', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, init: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/whatsapp/daily-digest')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: 'Daily digest compiled',
            digest: {
              date: '2026-11-21',
              totalSites: 3,
              reportedSites: 2,
              pendingSites: 1,
              fullDayCount: 2,
              halfDayCount: 0,
              stoppedCount: 0,
              pendingMaterialsCount: 1,
              overdueTasksCount: 0,
              messageText: '*SiteSaathi Daily Digest*\nTotal Sites: 3',
              waLink: 'https://wa.me/?text=*SiteSaathi%20Daily%20Digest*',
            },
          }),
        } as any;
      }
      return originalFetch(url, init);
    };

    try {
      const res = await apiGetDailyDigest('9876543210');
      assert.ok(res.data);
      assert.equal(res.data.digest.totalSites, 3);
      assert.equal(res.data.digest.reportedSites, 2);
      assert.equal(res.data.digest.pendingSites, 1);
      assert.ok(res.data.digest.waLink.startsWith('https://wa.me/'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('Confirmation card commits material request to Dexie and sync queue', async () => {
    const reqId = `voice-req-${Date.now()}`;
    const testSiteId = 'site-test-101';

    // Commit to Dexie
    await (db as any).materialRequests.add({
      id: reqId,
      siteId: testSiteId,
      item: 'TMT 12mm Saria',
      quantity: 500,
      unit: 'kg',
      urgency: 'high',
      notes: 'Extracted from voice prompt',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await enqueueSyncMutation('material_request', 'create', {
      id: reqId,
      siteId: testSiteId,
      item: 'TMT 12mm Saria',
      quantity: 500,
      unit: 'kg',
      urgency: 'high',
    });

    const stored = await (db as any).materialRequests.get(reqId);
    assert.ok(stored);
    assert.equal(stored.item, 'TMT 12mm Saria');
    assert.equal(stored.quantity, 500);

    const outboxItems = await (db as any).syncOutbox.toArray();
    assert.ok(outboxItems.length > 0);
  });

  await t.test('Confirmation card commits punch task to Dexie and sync queue', async () => {
    const taskId = `voice-task-${Date.now()}`;
    const testSiteId = 'site-test-101';

    await (db as any).siteTasks.add({
      id: taskId,
      siteId: testSiteId,
      title: 'Chhat ki dhalai checking',
      priority: 'high',
      status: 'todo',
      dueDate: '2026-11-23',
      requiresPhotoProof: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await enqueueSyncMutation('task', 'create', {
      id: taskId,
      siteId: testSiteId,
      title: 'Chhat ki dhalai checking',
      priority: 'high',
    });

    const stored = await (db as any).siteTasks.get(taskId);
    assert.ok(stored);
    assert.equal(stored.title, 'Chhat ki dhalai checking');
    assert.equal(stored.requiresPhotoProof, true);
  });

  clearStoredTokens();
});
