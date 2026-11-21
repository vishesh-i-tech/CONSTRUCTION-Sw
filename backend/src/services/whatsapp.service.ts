/**
 * WhatsApp Daily Digest Service
 * Generates automated 8:30 PM IST Daily Site Digest for contractors and site owners.
 * Provides instant 1-tap wa.me click-to-chat sharing (Tier 1 - zero cost) and
 * Meta WhatsApp Cloud API sending (Tier 2 - Pro).
 */

import { getDb } from '../db/index.js';
import { sites, dailyRecords, materialRequests, siteTasks } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { getTodayIst } from '../utils/date.js';

export interface DailyDigestSummary {
  date: string;
  totalSites: number;
  reportedSites: number;
  pendingSites: number;
  fullDayCount: number;
  halfDayCount: number;
  stoppedCount: number;
  pendingMaterialsCount: number;
  overdueTasksCount: number;
  messageText: string;
  waLink: string;
}

export async function generateDailyDigest(
  organizationId: string,
  recipientPhone?: string
): Promise<DailyDigestSummary> {
  const database = getDb();
  if (!database) {
    throw new Error('Database not initialized');
  }

  const today = getTodayIst();

  // 1. Fetch all sites for the organization
  const allSites = await database
    .select()
    .from(sites)
    .where(eq(sites.organizationId, organizationId));

  const totalSites = allSites.length;
  const siteIds = allSites.map((s) => s.id);

  if (totalSites === 0) {
    const emptyText = `🏗️ *SiteSaathi Daily Digest* (${today})\n\nNo active construction sites found in your workspace.`;
    return {
      date: today,
      totalSites: 0,
      reportedSites: 0,
      pendingSites: 0,
      fullDayCount: 0,
      halfDayCount: 0,
      stoppedCount: 0,
      pendingMaterialsCount: 0,
      overdueTasksCount: 0,
      messageText: emptyText,
      waLink: `https://wa.me/${recipientPhone || ''}?text=${encodeURIComponent(emptyText)}`,
    };
  }

  // 2. Fetch today's DPR records
  const todayRecords = await database
    .select()
    .from(dailyRecords)
    .where(
      and(
        eq(dailyRecords.organizationId, organizationId),
        eq(dailyRecords.recordDate, today)
      )
    );

  const reportedSiteIds = new Set(todayRecords.map((r) => r.siteId));
  const reportedSites = reportedSiteIds.size;
  const pendingSites = Math.max(0, totalSites - reportedSites);

  const fullDayCount = todayRecords.filter((r) => r.status === 'full').length;
  const halfDayCount = todayRecords.filter((r) => r.status === 'half').length;
  const stoppedCount = todayRecords.filter((r) => r.status === 'stopped').length;

  // 3. Pending material requests needing owner review
  const pendingRequests = await database
    .select()
    .from(materialRequests)
    .where(
      and(
        eq(materialRequests.organizationId, organizationId),
        eq(materialRequests.status, 'pending')
      )
    );

  // 4. Overdue punch tasks
  const overdueTasks = await database
    .select()
    .from(siteTasks)
    .where(
      and(
        eq(siteTasks.organizationId, organizationId),
        sql`${siteTasks.status} != 'done'`,
        sql`${siteTasks.dueDate} < ${today}`
      )
    );

  // 5. Construct cleanly formatted WhatsApp message
  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(new Date());

  const lines: string[] = [
    `🏗️ *SiteSaathi — Daily Site Digest*`,
    `📅 *Date:* ${formattedDate} (IST)`,
    `━━━━━━━━━━━━━━━━━━`,
    `📊 *Sites Progress Status:*`,
    `• Total Active Sites: *${totalSites}*`,
    `• Reports Submitted: *${reportedSites}* / ${totalSites}`,
    `• Pending Submissions: *${pendingSites}*`,
    ``,
    `🟢 Full Day: *${fullDayCount}* | 🟡 Half Day: *${halfDayCount}* | 🔴 Stopped: *${stoppedCount}*`,
    `━━━━━━━━━━━━━━━━━━`,
  ];

  if (pendingRequests.length > 0) {
    lines.push(`📦 *Material Indents Pending:* *${pendingRequests.length}* item(s) awaiting approval`);
  } else {
    lines.push(`📦 *Material Indents:* All requests approved/fulfilled ✓`);
  }

  if (overdueTasks.length > 0) {
    lines.push(`⚠️ *Overdue Punch Tasks:* *${overdueTasks.length}* task(s) require attention`);
  } else {
    lines.push(`🔨 *Site Tasks:* Zero overdue items on site ✓`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(`📲 *Open SiteSaathi to view live photos & audio:*`);
  lines.push(`https://sitesaathi.app/dashboard`);

  const messageText = lines.join('\n');
  const cleanPhone = recipientPhone ? recipientPhone.replace(/\D/g, '') : '';
  const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;

  return {
    date: today,
    totalSites,
    reportedSites,
    pendingSites,
    fullDayCount,
    halfDayCount,
    stoppedCount,
    pendingMaterialsCount: pendingRequests.length,
    overdueTasksCount: overdueTasks.length,
    messageText,
    waLink,
  };
}

/**
 * Sends WhatsApp notification via Meta WhatsApp Cloud API (Pro Tier)
 */
export async function sendViaMetaCloudApi(
  recipientPhone: string,
  messageText: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiToken = process.env.WHATSAPP_API_TOKEN;

  if (!phoneNumberId || !apiToken) {
    return {
      success: false,
      error: 'WhatsApp Cloud API credentials not configured (WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_API_TOKEN missing)',
    };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone.replace(/\D/g, ''),
        type: 'text',
        text: { preview_url: true, body: messageText },
      }),
    });

    const data: any = await res.json();
    if (!res.ok) {
      return { success: false, error: data?.error?.message || 'Failed to send WhatsApp message' };
    }

    return { success: true, messageId: data?.messages?.[0]?.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'WhatsApp network error' };
  }
}
