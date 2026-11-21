import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  sites,
  dailyRecords,
  materialRequests,
  siteTasks,
  notificationLog,
  users,
} from '../db/schema.js';
import { getTodayIst } from '../utils/date.js';

export interface EscalationSummary {
  missingDprCount: number;
  urgentMaterialsCount: number;
  overdueTasksCount: number;
  alertsLogged: number;
}

export async function runEscalationCheck(orgId: string): Promise<EscalationSummary> {
  const db = getDb();
  if (!db) {
    return { missingDprCount: 0, urgentMaterialsCount: 0, overdueTasksCount: 0, alertsLogged: 0 };
  }

  const today = getTodayIst();
  let alertsLogged = 0;

  // 1. Missing DPR Check for Today
  const orgSites = await db.query.sites.findMany({
    where: eq(sites.organizationId, orgId),
  });

  const todayRecords = await db.query.dailyRecords.findMany({
    where: and(eq(dailyRecords.recordDate, today)),
  });
  const sitesWithRecord = new Set(todayRecords.map((r) => r.siteId));

  const missingSites = orgSites.filter((s) => !sitesWithRecord.has(s.id));

  // Find owner to alert
  const owner = await db.query.users.findFirst({
    where: and(eq(users.organizationId, orgId), eq(users.role, 'owner')),
  });

  if (owner && missingSites.length > 0) {
    // Check if alert already logged for today
    const alreadyLogged = await db.query.notificationLog.findFirst({
      where: and(
        eq(notificationLog.userId, owner.id),
        eq(notificationLog.type, `missing_dpr_${today}`)
      ),
    });

    if (!alreadyLogged) {
      await db.insert(notificationLog).values({
        id: crypto.randomUUID(),
        userId: owner.id,
        type: `missing_dpr_${today}`,
        status: 'sent',
        sentAt: new Date().toISOString(),
      });
      alertsLogged++;
    }
  }

  // 2. Urgent Unapproved Material Requests Check
  const pendingUrgentMaterials = await db.query.materialRequests.findMany({
    where: and(
      eq(materialRequests.organizationId, orgId),
      eq(materialRequests.status, 'pending'),
      eq(materialRequests.urgency, 'urgent')
    ),
  });

  if (owner && pendingUrgentMaterials.length > 0) {
    const alertKey = `urgent_materials_${today}`;
    const alreadyLogged = await db.query.notificationLog.findFirst({
      where: and(eq(notificationLog.userId, owner.id), eq(notificationLog.type, alertKey)),
    });

    if (!alreadyLogged) {
      await db.insert(notificationLog).values({
        id: crypto.randomUUID(),
        userId: owner.id,
        type: alertKey,
        status: 'sent',
        sentAt: new Date().toISOString(),
      });
      alertsLogged++;
    }
  }

  // 3. Overdue Tasks Check
  const allTasks = await db.query.siteTasks.findMany({
    where: eq(siteTasks.organizationId, orgId),
  });

  const overdueTasks = allTasks.filter(
    (t) => t.status !== 'done' && t.dueDate && t.dueDate < today
  );

  if (owner && overdueTasks.length > 0) {
    const alertKey = `overdue_tasks_${today}`;
    const alreadyLogged = await db.query.notificationLog.findFirst({
      where: and(eq(notificationLog.userId, owner.id), eq(notificationLog.type, alertKey)),
    });

    if (!alreadyLogged) {
      await db.insert(notificationLog).values({
        id: crypto.randomUUID(),
        userId: owner.id,
        type: alertKey,
        status: 'sent',
        sentAt: new Date().toISOString(),
      });
      alertsLogged++;
    }
  }

  return {
    missingDprCount: missingSites.length,
    urgentMaterialsCount: pendingUrgentMaterials.length,
    overdueTasksCount: overdueTasks.length,
    alertsLogged,
  };
}
