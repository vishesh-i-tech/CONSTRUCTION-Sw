import { FastifyPluginAsync } from 'fastify';
import { authenticate, requireOwner } from '../middleware/auth.js';
import { generateDailyDigest, sendViaMetaCloudApi } from '../services/whatsapp.service.js';
import { z } from 'zod';

const sendDigestSchema = z.object({
  recipientPhone: z.string().optional(),
});

export const whatsappRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  /**
   * GET /api/v1/whatsapp/daily-digest
   * Previews today's 8:30 PM IST Daily Site Digest and returns 1-tap wa.me link
   */
  fastify.get('/api/v1/whatsapp/daily-digest', async (request, reply) => {
    const user = request.user!;
    const query = request.query as { phone?: string };

    const digest = await generateDailyDigest(user.organizationId, query.phone);
    return reply.code(200).send({
      message: 'Daily digest compiled',
      digest,
    });
  });

  /**
   * POST /api/v1/whatsapp/send-digest
   * Owner-only: dispatches today's digest via Meta WhatsApp Cloud API (Pro Tier)
   */
  fastify.post('/api/v1/whatsapp/send-digest', { preHandler: [requireOwner] }, async (request, reply) => {
    const user = request.user!;
    const body = sendDigestSchema.safeParse(request.body || {});
    const recipientPhone = body.success ? body.data.recipientPhone : undefined;

    const digest = await generateDailyDigest(user.organizationId, recipientPhone);

    let sendResult: { success: boolean; messageId?: string; error?: string } = {
      success: false,
      error: 'Recipient phone not provided',
    };
    if (recipientPhone) {
      sendResult = await sendViaMetaCloudApi(recipientPhone, digest.messageText);
    }

    return reply.code(200).send({
      message: 'Digest processed',
      digest,
      sendResult,
    });
  });
};
