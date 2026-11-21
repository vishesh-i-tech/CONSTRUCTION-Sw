import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { siteTasks, sites, users, siteAssignments } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';

const createTaskSchema = z.object({
  siteId: z.string().uuid(),
  title: z.string().min(2, 'Task title is required').max(255),
  description: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.string().optional(),
});

const updateTaskStatusSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'done']),
  completionPhotoKey: z.string().optional(),
  completionPhotoUrl: z.string().optional(),
  notes: z.string().optional(),
});

const convertIssueToTaskSchema = z.object({
  siteId: z.string().uuid(),
  issueTitle: z.string().min(2, 'Issue title is required'),
  issueDescription: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('high'),
  dueDate: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
});

export const taskRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticate);

  // 1. Create a Site Task
  fastify.post('/api/v1/tasks', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const parseRes = createTaskSchema.safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseRes.error.flatten().fieldErrors,
      });
    }

    const { siteId, title, description, assignedTo, priority, dueDate } = parseRes.data;
    const user = request.user!;

    if (user.role === 'supervisor') {
      const [assignment] = await db
        .select()
        .from(siteAssignments)
        .where(and(eq(siteAssignments.siteId, siteId), eq(siteAssignments.userId, user.userId)));

      if (!assignment) {
        return reply.status(403).send({ error: 'You are not assigned to this site' });
      }
    }

    const site = await db.query.sites.findFirst({
      where: and(eq(sites.id, siteId), eq(sites.organizationId, user.organizationId)),
    });
    if (!site) {
      return reply.status(404).send({ error: 'Site not found in organization' });
    }

    const id = crypto.randomUUID();
    const newTask = {
      id,
      organizationId: user.organizationId,
      siteId,
      title,
      description: description || null,
      assignedTo: assignedTo || null,
      priority,
      status: 'todo' as const,
      dueDate: dueDate || null,
      createdAt: new Date().toISOString(),
    };

    await db.insert(siteTasks).values(newTask);

    return reply.status(201).send({
      message: 'Site task created successfully',
      task: newTask,
    });
  });

  // 2. List Tasks
  fastify.get('/api/v1/tasks', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const user = request.user!;
    const query = request.query as { siteId?: string; status?: string; assignedTo?: string };

    let tasks = await db
      .select({
        id: siteTasks.id,
        organizationId: siteTasks.organizationId,
        siteId: siteTasks.siteId,
        siteName: sites.name,
        title: siteTasks.title,
        description: siteTasks.description,
        assignedTo: siteTasks.assignedTo,
        assignedToName: users.name,
        priority: siteTasks.priority,
        status: siteTasks.status,
        dueDate: siteTasks.dueDate,
        createdAt: siteTasks.createdAt,
      })
      .from(siteTasks)
      .innerJoin(sites, eq(siteTasks.siteId, sites.id))
      .leftJoin(users, eq(siteTasks.assignedTo, users.id))
      .where(eq(siteTasks.organizationId, user.organizationId))
      .orderBy(desc(siteTasks.createdAt));

    if (query.siteId) {
      tasks = tasks.filter((t) => t.siteId === query.siteId);
    }
    if (query.status) {
      tasks = tasks.filter((t) => t.status === query.status);
    }
    if (query.assignedTo) {
      tasks = tasks.filter((t) => t.assignedTo === query.assignedTo);
    }

    return reply.status(200).send({ tasks });
  });

  // 3. Update Task Status (With Mandatory Completion Photo Proof for 'done')
  fastify.patch('/api/v1/tasks/:id/status', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const { id } = request.params as { id: string };
    const parseRes = updateTaskStatusSchema.safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseRes.error.flatten().fieldErrors,
      });
    }

    const user = request.user!;
    const existing = await db.query.siteTasks.findFirst({
      where: and(eq(siteTasks.id, id), eq(siteTasks.organizationId, user.organizationId)),
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Site task not found' });
    }

    const { status, completionPhotoKey, completionPhotoUrl, notes } = parseRes.data;

    // Subphase 4.2 Enforce photo proof before a task can be marked Completed
    if (status === 'done' && !completionPhotoKey && !completionPhotoUrl) {
      return reply.status(400).send({
        error: 'Mandatory completion photo proof is required to mark task as done',
      });
    }

    const updatedDesc = notes
      ? `${existing.description ? `${existing.description}\n` : ''}[${new Date().toISOString().slice(0, 10)}] ${notes}`
      : existing.description;

    await db
      .update(siteTasks)
      .set({
        status,
        description: updatedDesc,
      })
      .where(eq(siteTasks.id, id));

    return reply.status(200).send({
      message: `Task status updated to ${status}`,
      taskId: id,
      status,
    });
  });

  // 4. 1-Tap Convert Issue to Task
  fastify.post('/api/v1/tasks/from-issue', async (request, reply) => {
    const db = getDb();
    if (!db) return reply.status(503).send({ error: 'Database unavailable' });

    const parseRes = convertIssueToTaskSchema.safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseRes.error.flatten().fieldErrors,
      });
    }

    const { siteId, issueTitle, issueDescription, priority, dueDate, assignedTo } = parseRes.data;
    const user = request.user!;

    const id = crypto.randomUUID();
    const newTask = {
      id,
      organizationId: user.organizationId,
      siteId,
      title: `[Issue] ${issueTitle}`,
      description: issueDescription || `Created from on-site issue tag: ${issueTitle}`,
      assignedTo: assignedTo || null,
      priority,
      status: 'todo' as const,
      dueDate: dueDate || null,
      createdAt: new Date().toISOString(),
    };

    await db.insert(siteTasks).values(newTask);

    return reply.status(201).send({
      message: 'Issue converted to site action task',
      task: newTask,
    });
  });
};
