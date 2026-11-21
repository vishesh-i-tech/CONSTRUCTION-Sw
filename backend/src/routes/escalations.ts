import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { notificationLog } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';
import { runEscalationCheck } from '../services/escalation.service.js';

export const escalationRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticate);

  // 1. Run Escalation Scan
  fastify.post('/api/v1/escalations/run-check', async (request, reply) => {
    const user = request.user!;
    const summary = await runEscalationCheck(user.organizationId);

    return reply.status(200).send({
      message: 'Escalation check completed',
      summary,
    });
  });

  // 2. Get User Notifications
  fastify.get('/api/v1/escalations', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const user = request.user!;
    const logs = await db
      .select()
      .from(notificationLog)
      .where(eq(notificationLog.userId, user.userId))
      .orderBy(desc(notificationLog.sentAt))
      .limit(50);

    return reply.status(200).send({ notifications: logs });
  });
};
