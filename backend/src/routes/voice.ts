import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { extractVoiceAction } from '../services/aiVoice.service.js';
import { z } from 'zod';

const extractActionSchema = z.object({
  transcript: z.string().min(1, 'Transcript cannot be empty'),
  siteId: z.string().optional(),
});

export const voiceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  /**
   * POST /api/v1/voice/extract-action
   * Extracts structured action from spoken audio transcript
   */
  fastify.post('/api/v1/voice/extract-action', async (request, reply) => {
    const parseResult = extractActionSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        error: 'Validation Error',
        details: parseResult.error.format(),
      });
    }

    const { transcript, siteId } = parseResult.data;
    const action = await extractVoiceAction(transcript, siteId);

    return reply.code(200).send({
      message: 'Voice action extracted successfully',
      action,
    });
  });
};
