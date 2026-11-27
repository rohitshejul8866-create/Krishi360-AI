import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { randomUUID } from 'node:crypto';
import { buildAwsSdkOptions } from '../config/awsClient';
import type { AppConfig } from '../config/env';
import type { CropCase } from '../models/cropCase';
import { PayloadTooLargeError, ServiceUnavailableError, UnsupportedMediaTypeError, ValidationError } from '../utils/errors';

export interface UploadRequest {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface PresignedUpload {
  /** S3 POST endpoint. */
  url: string;
  /** Form fields the client must send with the file. */
  fields: Record<string, string>;
  /** Private object key to reference later (never a public URL). */
  imageKey: string;
  expiresAt: string;
  constraints: { maxSizeBytes: number; allowedTypes: readonly string[] };
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Presigned POST policy: S3 itself enforces content type and size range,
 * and the key is pinned to the case owner's private prefix. The bucket has
 * all public access blocked; objects are never publicly readable.
 */
export class UploadService {
  constructor(private config: AppConfig, private s3?: S3Client) {}

  private client(): S3Client {
    if (!this.config.uploadBucketName) {
      throw new ServiceUnavailableError(
        'UPLOAD_NOT_CONFIGURED',
        'Image uploads are not configured. Set UPLOAD_BUCKET_NAME and deploy the S3 bucket first.',
      );
    }
    return this.s3 ?? new S3Client(buildAwsSdkOptions(this.config));
  }

  validate(request: UploadRequest): void {
    if (!this.config.allowedImageTypes.includes(request.contentType)) {
      throw new UnsupportedMediaTypeError(`Only ${this.config.allowedImageTypes.join(', ')} images are allowed.`);
    }
    if (request.sizeBytes > this.config.maxUploadBytes) {
      throw new PayloadTooLargeError(`Image exceeds the ${this.config.maxUploadBytes} byte limit.`);
    }
  }

  buildKey(cropCase: CropCase, contentType: string): string {
    const ext = EXT_BY_TYPE[contentType];
    if (!ext) throw new ValidationError('Unsupported image type.');
    return `crops/${cropCase.farmerId}/${cropCase.id}/${randomUUID()}.${ext}`;
  }

  async createUpload(cropCase: CropCase, request: UploadRequest): Promise<PresignedUpload> {
    this.validate(request);
    const client = this.client();
    const imageKey = this.buildKey(cropCase, request.contentType);
    const { url, fields } = await createPresignedPost(client, {
      Bucket: this.config.uploadBucketName,
      Key: imageKey,
      Expires: this.config.uploadUrlExpirySeconds,
      Conditions: [
        ['content-length-range', 1, this.config.maxUploadBytes],
        ['eq', '$Content-Type', request.contentType],
        ['eq', '$key', imageKey],
      ],
      Fields: { 'Content-Type': request.contentType },
    });
    return {
      url,
      fields,
      imageKey,
      expiresAt: new Date(Date.now() + this.config.uploadUrlExpirySeconds * 1000).toISOString(),
      constraints: { maxSizeBytes: this.config.maxUploadBytes, allowedTypes: this.config.allowedImageTypes },
    };
  }

  /** An image key may only be attached to the case whose prefix it belongs to. */
  assertKeyBelongsToCase(cropCase: CropCase, imageKey: string): void {
    const expectedPrefix = `crops/${cropCase.farmerId}/${cropCase.id}/`;
    if (!imageKey.startsWith(expectedPrefix)) {
      throw new ValidationError('imageKey does not belong to this case.');
    }
  }
}