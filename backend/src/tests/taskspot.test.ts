import { test } from 'node:test';
import * as assert from 'node:assert';
import { randomUUID } from 'crypto';
import { buildServer } from '../server.js';
import { getDb } from '../db/index.js';
import { organizations, users, sites, materials, expenseDues } from '../db/schema.js';
import { generateTokens } from '../services/auth.service.js';
import { eq } from 'drizzle-orm';

test('Phase 4 TaskSpot: Material Requests, Site Tasks, and Escalations Lifecycle', async () => {
  const db = getDb();
  if (!db) {
    console.log('Skipping live DB taskspot test (DATABASE_URL not configured)');
    return;
  }

  const server = await buildServer();

  // Create organization, owner user, and site
  const [org] = await db
    .insert(organizations)
    .values({ name: 'TaskSpot Test Org' })
    .returning();

  const [ownerUser] = await db
    .insert(users)
    .values({
      organizationId: org.id,
      name: 'Test Owner',
      phone: `+91${Math.floor(6000000000 + Math.random() * 3999999999)}`,
      role: 'owner',
    })
    .returning();

  const [testSite] = await db
    .insert(sites)
    .values({
      organizationId: org.id,
      name: 'TaskSpot Construction Site',
      locationText: 'Sector 62, Noida, UP',
    })
    .returning();

  const ownerToken = generateTokens({
    userId: ownerUser.id,
    organizationId: org.id,
    role: 'owner',
    name: ownerUser.name,
  }).accessToken;

  try {
    // -------------------------------------------------------------
    // 1. MATERIAL REQUEST LIFECYCLE
    // -------------------------------------------------------------
    // Create material request
    const createReqRes = await server.inject({
      method: 'POST',
      url: '/api/v1/material-requests',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        siteId: testSite.id,
        itemsJson: [
          { itemName: 'UltraTech Cement 53 Grade', quantity: 50, unit: 'bags', estimatedRate: 420 },
        ],
        urgency: 'urgent',
        notes: 'Required before morning casting',
      },
    });
    assert.strictEqual(createReqRes.statusCode, 201);
    const createdReq = JSON.parse(createReqRes.payload).materialRequest;
    assert.strictEqual(createdReq.status, 'pending');
    assert.strictEqual(createdReq.urgency, 'urgent');

    // List material requests
    const listReqRes = await server.inject({
      method: 'GET',
      url: `/api/v1/material-requests?siteId=${testSite.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(listReqRes.statusCode, 200);
    const requests = JSON.parse(listReqRes.payload).materialRequests;
    assert.ok(requests.length >= 1);

    // Approve material request
    const approveRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/material-requests/${createdReq.id}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { status: 'approved', notes: 'PO sent to dealer' },
    });
    assert.strictEqual(approveRes.statusCode, 200);

    // Fulfill request (GRN) with photo proof & auto-ledger sync
    const fulfillRes = await server.inject({
      method: 'POST',
      url: `/api/v1/material-requests/${createdReq.id}/fulfill`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        actualQuantity: 50,
        unitCost: 420,
        totalCost: 21000,
        paymentStatus: 'partial',
        paidAmount: 5000,
        challanPhotoKey: 'orgs/test/challan-123.jpg',
        notes: 'Challan verified and signed on site',
      },
    });
    assert.strictEqual(fulfillRes.statusCode, 200);
    const { createdMaterialId } = JSON.parse(fulfillRes.payload);
    assert.ok(createdMaterialId, 'Expected material ID to be created in ledger');

    // Verify material record created in database
    const createdMaterial = await db.query.materials.findFirst({
      where: eq(materials.id, createdMaterialId),
    });
    assert.ok(createdMaterial);
    assert.strictEqual(createdMaterial.quantity, 50);
    assert.strictEqual(createdMaterial.totalCost, 21000);
    assert.strictEqual(createdMaterial.paymentStatus, 'partial');

    // Verify linked due created in database
    const createdDue = await db.query.expenseDues.findFirst({
      where: eq(expenseDues.materialId, createdMaterialId),
    });
    assert.ok(createdDue);
    assert.strictEqual(createdDue.amountDue, 16000); // 21000 - 5000

    // -------------------------------------------------------------
    // 2. SITE TASKS & MANDATORY COMPLETION PHOTO PROOF
    // -------------------------------------------------------------
    // Create task
    const createTaskRes = await server.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        siteId: testSite.id,
        title: 'Fix reinforcement cover on column C3',
        priority: 'high',
        dueDate: '2026-11-25',
      },
    });
    assert.strictEqual(createTaskRes.statusCode, 201);
    const createdTask = JSON.parse(createTaskRes.payload).task;
    assert.strictEqual(createdTask.status, 'todo');

    // Updating status to 'done' WITHOUT photo proof must fail (400)
    const failDoneRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${createdTask.id}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { status: 'done' },
    });
    assert.strictEqual(failDoneRes.statusCode, 400);

    // Updating status to 'done' WITH completion photo proof succeeds (200)
    const successDoneRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${createdTask.id}/status`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        status: 'done',
        completionPhotoKey: 'orgs/test/task-proof-1.jpg',
        notes: 'Cover blocks placed, ready for inspection',
      },
    });
    assert.strictEqual(successDoneRes.statusCode, 200);

    // Convert issue to task (1-tap)
    const convertIssueRes = await server.inject({
      method: 'POST',
      url: '/api/v1/tasks/from-issue',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        siteId: testSite.id,
        issueTitle: 'Water leakage in basement pump room',
        priority: 'high',
      },
    });
    assert.strictEqual(convertIssueRes.statusCode, 201);
    const convertedTask = JSON.parse(convertIssueRes.payload).task;
    assert.ok(convertedTask.title.includes('Water leakage'));

    // -------------------------------------------------------------
    // 3. ESCALATION SERVICE
    // -------------------------------------------------------------
    const escalationRes = await server.inject({
      method: 'POST',
      url: '/api/v1/escalations/run-check',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(escalationRes.statusCode, 200);
    const { summary } = JSON.parse(escalationRes.payload);
    assert.ok(summary !== undefined);
  } finally {
    // Cleanup
    await db.delete(organizations).where(eq(organizations.id, org.id));
    await server.close();
  }
});
