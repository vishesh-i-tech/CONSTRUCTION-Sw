import { db } from '../db/database';
import { SyncOutboxItem } from '../../types';
import {
  apiPresignUpload,
  apiUploadToR2,
  apiSubmitDailyRecord,
  apiCreateMaterialRequest,
  apiCreateTask,
} from '../../services/apiClient';

let isProcessing = false;
type SyncListener = (status: { isSyncing: boolean; pendingCount: number; lastSyncedAt: string | null }) => void;
const listeners = new Set<SyncListener>();
let lastSyncedAt: string | null = null;

function notifyListeners(isSyncing: boolean, pendingCount: number) {
  listeners.forEach((listener) => {
    try {
      listener({ isSyncing, pendingCount, lastSyncedAt });
    } catch {
      // ignore
    }
  });
}

export function subscribeSyncStatus(listener: SyncListener): () => void {
  listeners.add(listener);
  db.syncOutbox.count().then((count) => {
    listener({ isSyncing: isProcessing, pendingCount: count, lastSyncedAt });
  });
  return () => listeners.delete(listener);
}

/**
 * Helper to convert base64 data URL to binary Blob for direct cloud PUT upload.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binaryStr = atob(parts[1]);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Enqueues a mutation into the persistent Dexie outbox and triggers sync attempt.
 */
export async function enqueueSyncMutation(
  entity: SyncOutboxItem['entity'],
  action: 'create' | 'update' | 'delete',
  payload: any,
  mediaBlobs?: { kind: 'photo' | 'audio'; siteId: string; mimeType: string; dataUrl: string }[]
): Promise<string> {
  const id = crypto.randomUUID();
  const outboxItem: SyncOutboxItem = {
    id,
    entity,
    action,
    payload,
    mediaBlobs,
    status: 'pending',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };

  await db.syncOutbox.add(outboxItem);
  const pendingCount = await db.syncOutbox.count();
  notifyListeners(isProcessing, pendingCount);

  // Trigger sync in the background
  processSyncOutbox().catch(() => {});
  return id;
}

/**
 * Process pending outbox queue items.
 */
export async function processSyncOutbox(): Promise<{ processed: number; failed: number }> {
  if (isProcessing) return { processed: 0, failed: 0 };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { processed: 0, failed: 0 };
  }

  isProcessing = true;
  let processed = 0;
  let failed = 0;

  try {
    const pendingItems = await db.syncOutbox.where('status').equals('pending').toArray();
    notifyListeners(true, pendingItems.length);

    for (const item of pendingItems) {
      try {
        if (item.entity === 'daily_record') {
          const payload = { ...item.payload };

          // 1. If item has media blobs (photos or voice notes), upload each to R2 via presigned PUT
          if (item.mediaBlobs && item.mediaBlobs.length > 0) {
            const uploadedPhotos: any[] = payload.photos || [];

            for (const media of item.mediaBlobs) {
              const presignRes = await apiPresignUpload(media.siteId, media.kind, media.mimeType);
              if (presignRes.data?.uploadUrl) {
                const blob = dataUrlToBlob(media.dataUrl);
                const uploadOk = await apiUploadToR2(presignRes.data.uploadUrl, blob, media.mimeType);

                if (uploadOk) {
                  if (media.kind === 'photo') {
                    uploadedPhotos.push({
                      storageKey: presignRes.data.storageKey,
                      mimeType: media.mimeType,
                      sizeBytes: blob.size,
                      capturedAt: new Date().toISOString(),
                    });
                  } else if (media.kind === 'audio') {
                    payload.audio = {
                      storageKey: presignRes.data.storageKey,
                      mimeType: media.mimeType,
                      sizeBytes: blob.size,
                      capturedAt: new Date().toISOString(),
                    };
                  }
                }
              }
            }
            payload.photos = uploadedPhotos;
          }

          // 2. Submit record payload to Fastify backend
          const submitRes = await apiSubmitDailyRecord(payload);

          if (submitRes.data?.record) {
            // Success: update local Dexie daily_records entry
            const localRecord = await db.dailyRecords.where('clientId').equals(payload.clientId).first();
            if (localRecord) {
              await db.dailyRecords.update(localRecord.id, {
                synced: true,
                receivedAt: submitRes.data.record.receivedAt,
              });
            }
            await db.syncOutbox.delete(item.id);
            processed++;
          } else {
            // Validation or business error
            const status = 'statusCode' in submitRes ? submitRes.statusCode : undefined;
            if (status && status >= 400 && status < 500) {
              await db.syncOutbox.update(item.id, {
                status: 'failed',
                errorMessage: submitRes.error || 'Validation error on server',
              });
              failed++;
            } else {
              // Network error or 5xx: increment retry
              await db.syncOutbox.update(item.id, {
                retryCount: item.retryCount + 1,
                errorMessage: submitRes.error || 'Server error',
              });
              failed++;
            }
          }
        } else if (item.entity === 'material_request') {
          const payload = { ...item.payload };
          const res = await apiCreateMaterialRequest(payload);
          if (res.data?.materialRequest) {
            const local = await db.materialRequests.where('clientId').equals(payload.clientId).first();
            if (local) {
              await db.materialRequests.update(local.id, { synced: true });
            }
            await db.syncOutbox.delete(item.id);
            processed++;
          } else {
            await db.syncOutbox.update(item.id, {
              retryCount: item.retryCount + 1,
              errorMessage: res.error || 'Failed to sync material request',
            });
            failed++;
          }
        } else if (item.entity === 'site_task') {
          const payload = { ...item.payload };
          const res = await apiCreateTask(payload);
          if (res.data?.task) {
            const local = await db.siteTasks.where('clientId').equals(payload.clientId).first();
            if (local) {
              await db.siteTasks.update(local.id, { synced: true });
            }
            await db.syncOutbox.delete(item.id);
            processed++;
          } else {
            await db.syncOutbox.update(item.id, {
              retryCount: item.retryCount + 1,
              errorMessage: res.error || 'Failed to sync site task',
            });
            failed++;
          }
        }
      } catch (err: any) {
        await db.syncOutbox.update(item.id, {
          retryCount: item.retryCount + 1,
          errorMessage: err.message || 'Sync processing exception',
        });
        failed++;
      }
    }

    lastSyncedAt = new Date().toISOString();
  } finally {
    isProcessing = false;
    const remaining = await db.syncOutbox.count();
    notifyListeners(false, remaining);
  }

  return { processed, failed };
}

// Attach automatic online and app-resume listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processSyncOutbox().catch(() => {});
  });
}
