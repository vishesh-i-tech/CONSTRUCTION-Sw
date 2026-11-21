import { test } from 'node:test';
import * as assert from 'node:assert';
import { randomUUID } from 'crypto';
import { buildServer } from '../server.js';
import { getDb } from '../db/index.js';
import { organizations, issueTypes } from '../db/schema.js';
import { seedDefaultIssueTypes } from '../services/issueTypes.service.js';
import { generateTokens } from '../services/auth.service.js';
import { eq } from 'drizzle-orm';

test('Issue Types: Multi-tenant isolation and 8-chip limit', async () => {
  const db = getDb();
  if (!db) {
    console.log('Skipping live DB issueTypes test (DATABASE_URL not configured)');
    return;
  }

  const server = await buildServer();

  // Create two distinct test organizations
  const [orgA] = await db
    .insert(organizations)
    .values({ name: 'Test Org Alpha' })
    .returning();

  const [orgB] = await db
    .insert(organizations)
    .values({ name: 'Test Org Beta' })
    .returning();

  const tokenA = generateTokens({
    userId: randomUUID(),
    organizationId: orgA.id,
    role: 'owner',
    name: 'Owner Alpha',
  }).accessToken;

  const tokenB = generateTokens({
    userId: randomUUID(),
    organizationId: orgB.id,
    role: 'owner',
    name: 'Owner Beta',
  }).accessToken;

  try {
    // Seed Org A with defaults
    await seedDefaultIssueTypes(orgA.id);

    // Seed Org B with a custom chip
    const [orgBChip] = await db
      .insert(issueTypes)
      .values({
        organizationId: orgB.id,
        labelHi: 'ऑर्ग बी की समस्या',
        labelEn: 'Org B Custom Issue',
        sortOrder: 1,
        isActive: true,
      })
      .returning();

    // 1. Unauthenticated request fails (401)
    const noAuthRes = await server.inject({
      method: 'GET',
      url: '/api/v1/issue-types',
    });
    assert.strictEqual(noAuthRes.statusCode, 401);

    // 2. Org A can only see Org A's chips
    const orgARes = await server.inject({
      method: 'GET',
      url: '/api/v1/issue-types',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(orgARes.statusCode, 200);
    const orgAData = JSON.parse(orgARes.payload);
    assert.strictEqual(orgAData.issueTypes.length, 6);
    // Org A must NOT see Org B's chip
    assert.strictEqual(
      orgAData.issueTypes.some((item: any) => item.labelEn === 'Org B Custom Issue'),
      false
    );

    // 3. Org A cannot edit Org B's chip
    const maliciousEditRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/issue-types/${orgBChip.id}`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { labelEn: 'Hacked by Org A' },
    });
    // Must return 404 Not Found because Org A has no access to Org B's chip
    assert.strictEqual(maliciousEditRes.statusCode, 404);

    // 4. Max 8 active chips check for Org A
    // Org A already has 6 chips. Add chip 7 and chip 8.
    await server.inject({
      method: 'POST',
      url: '/api/v1/issue-types',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { labelHi: 'चिप ७', labelEn: 'Chip 7', sortOrder: 7, isActive: true },
    });
    await server.inject({
      method: 'POST',
      url: '/api/v1/issue-types',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { labelHi: 'चिप ८', labelEn: 'Chip 8', sortOrder: 8, isActive: true },
    });

    // Attempting to add a 9th active chip must fail with 400
    const chip9Res = await server.inject({
      method: 'POST',
      url: '/api/v1/issue-types',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { labelHi: 'चिप ९', labelEn: 'Chip 9', sortOrder: 9, isActive: true },
    });
    assert.strictEqual(chip9Res.statusCode, 400);

    // 5. Org B sees only its custom chip
    const orgBRes = await server.inject({
      method: 'GET',
      url: '/api/v1/issue-types',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(orgBRes.statusCode, 200);
    const orgBData = JSON.parse(orgBRes.payload);
    assert.strictEqual(orgBData.issueTypes.length, 1);
    assert.strictEqual(orgBData.issueTypes[0].labelEn, 'Org B Custom Issue');
  } finally {
    await db.delete(organizations).where(eq(organizations.id, orgA.id));
    await db.delete(organizations).where(eq(organizations.id, orgB.id));
  }
});
