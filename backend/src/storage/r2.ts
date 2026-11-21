import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageProvider, PresignedUploadResult } from './index.js';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicDomain?: string;
}

export class R2StorageProvider implements IStorageProvider {
  private s3: S3Client;
  private bucket: string;
  private publicDomain?: string;

  constructor(config: R2Config) {
    this.bucket = config.bucketName;
    this.publicDomain = config.publicDomain;

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async generatePresignedUploadUrl(
    storageKey: string,
    mimeType: string,
    expiresInSeconds = 300
  ): Promise<PresignedUploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: expiresInSeconds,
    });

    return {
      uploadUrl,
      storageKey,
      expiresInSeconds,
    };
  }

  async getDownloadUrl(storageKey: string, expiresInSeconds = 3600): Promise<string> {
    if (this.publicDomain) {
      return `https://${this.publicDomain}/${storageKey}`;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });

    return getSignedUrl(this.s3, command, {
      expiresIn: expiresInSeconds,
    });
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });

    await this.s3.send(command);
    return true;
  }
}
