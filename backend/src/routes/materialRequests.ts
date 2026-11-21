import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  materialRequests,
  materials,
  expenseDues,
  sites,
  users,
  siteAssignments,
} from '../db/schema.js';
import { authenticate, requireOwner } from '../middleware/auth.js';
import { getTodayIst } from '../utils/date.js';

const createMaterialRequestSchema = z.object({
  siteId: z.string().uuid(),
  itemsJson: z
    .array(
      z.object({
        itemName: z.string().min(1, 'Item name is required'),
        quantity: z.number().positive('Quantity must be greater than 0'),
        unit: z.string().min(1, 'Unit is required'),
        estimatedRate: z.number().optional(),
      })
    )
    .min(1, 'At least one material item is required'),
  urgency: z.enum(['low', 'normal', 'urgent']).default('normal'),
  notes: z.string().optional(),
  clientId: z.string().optional(),
});

const updateRequestStatusSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  vendorId: z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
});

const fulfillRequestSchema = z.object({
  actualQuantity: z.number().positive().optional(),
  challanPhotoKey: z.string().optional(),
  challanPhotoUrl: z.string().optional(),
  vendorId: z.string().optional(),
  unitCost: z.number().nonnegative().optional(),
  totalCost: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  paymentStatus: z.enum(['paid', 'pending', 'partial']).default('pending'),
  paidAmount: z.number().nonnegative().default(0),
});

export const materialRequestRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticate);

  // 1. Submit a Material Request (Supervisor or Owner)
  fastify.post('/api/v1/material-requests', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const parseRes = createMaterialRequestSchema.safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseRes.error.flatten().fieldErrors,
      });
    }

    const { siteId, itemsJson, urgency, notes } = parseRes.data;
    const user = request.user!;

    // RBAC: If supervisor, verify assigned to site
    if (user.role === 'supervisor') {
      const [assignment] = await db
        .select()
        .from(siteAssignments)
        .where(and(eq(siteAssignments.siteId, siteId), eq(siteAssignments.userId, user.userId)));

      if (!assignment) {
        return reply.status(403).send({ error: 'You are not assigned to this site' });
      }
    }

    // Verify site belongs to organization
    const site = await db.query.sites.findFirst({
      where: and(eq(sites.id, siteId), eq(sites.organizationId, user.organizationId)),
    });
    if (!site) {
      return reply.status(404).send({ error: 'Site not found in organization' });
    }

    const id = crypto.randomUUID();
    const newRequest = {
      id,
      organizationId: user.organizationId,
      siteId,
      requestedBy: user.userId,
      itemsJson,
      urgency,
      status: 'pending' as const,
      notes: notes || null,
      createdAt: new Date().toISOString(),
    };

    await db.insert(materialRequests).values(newRequest);

    return reply.status(201).send({
      message: 'Material request created successfully',
      materialRequest: newRequest,
    });
  });

  // 2. List Material Requests
  fastify.get('/api/v1/material-requests', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const user = request.user!;
    const query = request.query as { siteId?: string; status?: string };

    let orgRequests = await db
      .select({
        id: materialRequests.id,
        organizationId: materialRequests.organizationId,
        siteId: materialRequests.siteId,
        siteName: sites.name,
        requestedBy: materialRequests.requestedBy,
        requestedByName: users.name,
        itemsJson: materialRequests.itemsJson,
        urgency: materialRequests.urgency,
        status: materialRequests.status,
        notes: materialRequests.notes,
        createdAt: materialRequests.createdAt,
      })
      .from(materialRequests)
      .innerJoin(sites, eq(materialRequests.siteId, sites.id))
      .innerJoin(users, eq(materialRequests.requestedBy, users.id))
      .where(eq(materialRequests.organizationId, user.organizationId))
      .orderBy(desc(materialRequests.createdAt));

    // If supervisor, restrict to their assigned sites
    if (user.role === 'supervisor') {
      const assignedSites = await db.query.siteAssignments.findMany({
        where: eq(siteAssignments.userId, user.userId),
      });
      const allowedSiteIds = new Set(assignedSites.map((a) => a.siteId));
      orgRequests = orgRequests.filter((r) => allowedSiteIds.has(r.siteId));
    }

    if (query.siteId) {
      orgRequests = orgRequests.filter((r) => r.siteId === query.siteId);
    }
    if (query.status) {
      orgRequests = orgRequests.filter((r) => r.status === query.status);
    }

    return reply.status(200).send({ materialRequests: orgRequests });
  });

  // 3. Approve or Reject Material Request (Owner Only)
  fastify.patch('/api/v1/material-requests/:id/status', { preHandler: [requireOwner] }, async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const { id } = request.params as { id: string };
    const parseRes = updateRequestStatusSchema.safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseRes.error.flatten().fieldErrors,
      });
    }

    const existing = await db.query.materialRequests.findFirst({
      where: and(eq(materialRequests.id, id), eq(materialRequests.organizationId, request.user!.organizationId)),
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Material request not found' });
    }

    const { status, notes } = parseRes.data;

    await db
      .update(materialRequests)
      .set({
        status,
        notes: notes ? `${existing.notes ? `${existing.notes}\n` : ''}${notes}` : existing.notes,
      })
      .where(eq(materialRequests.id, id));

    return reply.status(200).send({
      message: `Material request marked as ${status}`,
      status,
    });
  });

  // 4. Delivery Confirmation (GRN) & Auto-Ledger Material Sync
  fastify.post('/api/v1/material-requests/:id/fulfill', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const { id } = request.params as { id: string };
    const parseRes = fulfillRequestSchema.safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseRes.error.flatten().fieldErrors,
      });
    }

    const user = request.user!;
    const existing = await db.query.materialRequests.findFirst({
      where: and(eq(materialRequests.id, id), eq(materialRequests.organizationId, user.organizationId)),
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Material request not found' });
    }

    if (existing.status === 'fulfilled') {
      return reply.status(400).send({ error: 'Material request is already fulfilled' });
    }

    const data = parseRes.data;

    // 1. Mark request fulfilled
    await db
      .update(materialRequests)
      .set({
        status: 'fulfilled',
        notes: data.notes ? `${existing.notes ? `${existing.notes}\n` : ''}${data.notes}` : existing.notes,
      })
      .where(eq(materialRequests.id, id));

    // 2. Auto-Ledger Sync: Automatically record in materials & expense dues
    const items = existing.itemsJson as any[];
    const firstItem = items[0] || { itemName: 'Material Delivery', quantity: 1, unit: 'units' };
    const materialId = crypto.randomUUID();
    const qty = data.actualQuantity || firstItem.quantity;
    const unitPrice = data.unitCost || 0;
    const totalAmount = data.totalCost || (unitPrice > 0 ? unitPrice * qty : 0);
    const today = getTodayIst();

    await db.insert(materials).values({
      id: materialId,
      organizationId: user.organizationId,
      siteId: existing.siteId,
      itemName: firstItem.itemName,
      quantity: qty,
      unit: firstItem.unit,
      unitPrice,
      totalCost: totalAmount,
      vendorId: data.vendorId || null,
      purchaseDate: today,
      paymentStatus: data.paymentStatus,
      paidAmount: data.paidAmount,
      receiptPhoto: data.challanPhotoKey || null,
      createdAt: new Date().toISOString(),
    });

    // If unpaid or partial, create linked due
    if (data.paymentStatus !== 'paid' && totalAmount > data.paidAmount) {
      const remainingDue = totalAmount - data.paidAmount;
      await db.insert(expenseDues).values({
        id: crypto.randomUUID(),
        organizationId: user.organizationId,
        siteId: existing.siteId,
        vendorId: data.vendorId || null,
        materialId,
        title: `Pending for ${firstItem.itemName} (${qty} ${firstItem.unit})`,
        category: 'material',
        amountDue: remainingDue,
        amountPaid: 0,
        dueDate: today,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    }

    return reply.status(200).send({
      message: 'Delivery confirmed (GRN) and ledger updated successfully',
      fulfilledAt: today,
      createdMaterialId: materialId,
    });
  });
};
