import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../server.js';
import { getDb } from '../db/index.js';
import { users, organizations, sites } from '../db/schema.js';
import { eq } from 'drizzle-orm';

test('Phase 5 AI Voice & WhatsApp Digest Lifecycle', async (t) => {
  const app = await buildServer();
  await app.ready();

  const timestamp = Date.now();
  const orgName = `Test Voice Org ${timestamp}`;
  const ownerEmail = `voice-owner-${timestamp}@example.com`;
  const ownerPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;

  let ownerToken: string;
  let orgId: string;
  let testSiteId: string;

  // 1. Sign up Owner
  await t.test('Set up test owner and organization', async () => {
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/owner/signup',
      payload: {
        email: ownerEmail,
        password: 'Password123!',
        name: 'Voice Test Contractor',
        phone: ownerPhone,
        companyName: orgName,
      },
    });

    assert.equal(signupRes.statusCode, 201);
    const body = JSON.parse(signupRes.body);
    ownerToken = body.tokens.accessToken;
    orgId = body.organization.id;
    assert.ok(ownerToken);
    assert.ok(orgId);

    // Create a test site
    testSiteId = crypto.randomUUID();
    const database = getDb()!;
    await database.insert(sites).values({
      id: testSiteId,
      organizationId: orgId,
      name: 'Sector 62 Commercial Tower',
      locationText: 'Sector 62, Noida, UP',
      siteType: 'Commercial',
      workStatus: 'ongoing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  // 2. AI Voice Action Extraction Tests
  await t.test('POST /api/v1/voice/extract-action extracts Material Request in Hinglish', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/voice/extract-action',
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
      payload: {
        transcript: '50 bags cement Ultratech Sector 62 site par bhej do urgent hai',
        siteId: testSiteId,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.action.actionType, 'material_request');
    assert.equal(body.action.extractedData.quantity, 50);
    assert.equal(body.action.extractedData.unit, 'bags');
    assert.equal(body.action.extractedData.urgency, 'urgent');
    assert.ok(body.action.extractedData.itemName?.includes('Cement'));
  });

  await t.test('POST /api/v1/voice/extract-action extracts Punch-List Task in English/Hindi', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/voice/extract-action',
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
      payload: {
        transcript: 'Repair shuttering leakage at column C4 before casting',
        siteId: testSiteId,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.action.actionType, 'site_task');
    assert.ok(body.action.extractedData.title?.includes('Repair shuttering'));
  });

  await t.test('POST /api/v1/voice/extract-action extracts Expense in Hinglish', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/voice/extract-action',
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
      payload: {
        transcript: '4500 rupaye diesel mixer machine ke liye cash diya',
        siteId: testSiteId,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.action.actionType, 'expense');
    assert.equal(body.action.extractedData.amount, 4500);
  });

  // 3. WhatsApp Daily Digest Tests
  await t.test('GET /api/v1/whatsapp/daily-digest compiles summary and wa.me link', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/whatsapp/daily-digest?phone=${ownerPhone}`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.digest);
    assert.ok(body.digest.totalSites >= 1);
    assert.ok(body.digest.messageText.includes('SiteSaathi'));
    assert.ok(body.digest.waLink.startsWith('https://wa.me/'));
  });

  await t.test('POST /api/v1/whatsapp/send-digest enforces requireOwner and handles response', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/whatsapp/send-digest',
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
      payload: {
        recipientPhone: ownerPhone,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.digest);
    assert.ok(body.sendResult);
  });

  // Teardown
  t.after(async () => {
    try {
      const database = getDb();
      if (database) {
        await database.delete(sites).where(eq(sites.id, testSiteId));
        await database.delete(users).where(eq(users.organizationId, orgId));
        await database.delete(organizations).where(eq(organizations.id, orgId));
      }
    } catch {
      // Ignore cleanup errors
    }
    await app.close();
  });
});
