import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env.js';
import { R2StorageProvider } from './r2.js';

export interface PresignedUploadResult {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

export interface IStorageProvider {
  generatePresignedUploadUrl(
    storageKey: string,
    mimeType: string,
    expiresInSeconds?: number
  ): Promise<PresignedUploadResult>;
  getDownloadUrl(storageKey: string, expiresInSeconds?: number): Promise<string>;
  deleteFile(storageKey: string): Promise<boolean>;
}

/**
 * Local development storage provider.
 * Stores binary files in local directory and simulates presigned URLs.
 */
export class LocalStorageProvider implements IStorageProvider {
  private baseDir: string;
  private serverBaseUrl: string;

  constructor(
    baseDir = './uploads',
    serverBaseUrl = process.env.API_BASE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:4000'
  ) {
    this.baseDir = path.resolve(process.cwd(), baseDir);
    this.serverBaseUrl = serverBaseUrl;

    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async generatePresignedUploadUrl(
    storageKey: string,
    _mimeType: string,
    expiresInSeconds = 300
  ): Promise<PresignedUploadResult> {
    const uploadUrl = `${this.serverBaseUrl}/api/v1/dev-storage/upload?key=${encodeURIComponent(storageKey)}`;
    return {
      uploadUrl,
      storageKey,
      expiresInSeconds,
    };
  }

  async getDownloadUrl(storageKey: string): Promise<string> {
    return `${this.serverBaseUrl}/api/v1/dev-storage/files/${storageKey}`;
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    const filePath = path.join(this.baseDir, storageKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
}

function initializeStorage(): IStorageProvider {
  if (
    env.STORAGE_PROVIDER === 'r2' &&
    env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET_NAME
  ) {
    return new R2StorageProvider({
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucketName: env.R2_BUCKET_NAME,
      publicDomain: env.R2_PUBLIC_DOMAIN,
    });
  }

  return new LocalStorageProvider(env.LOCAL_STORAGE_PATH);
}

export const storageProvider: IStorageProvider = initializeStorage();
