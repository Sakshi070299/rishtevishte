// ═══════════════════════════════════════════════════════
// FEATURE 5: Photo Upload to Cloud Storage
// Supports: Local (dev) → S3/Cloudflare R2 (prod)
// Validates: JPG/PNG only, max 5MB, auto-resize
// ═══════════════════════════════════════════════════════

import { Injectable, BadRequestException } from '@nestjs/common';
import { Controller, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/** Local disk uploads: cwd/uploads in dev; /tmp on Vercel/Lambda (read-only /var/task). */
function resolveLocalUploadDir(): string {
  if (process.env.UPLOAD_DIR) {
    return path.resolve(process.env.UPLOAD_DIR);
  }
  const serverless =
    process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
  if (serverless) {
    return path.join('/tmp', 'rishtenate-uploads');
  }
  return path.join(process.cwd(), 'uploads');
}

@Injectable()
export class UploadService {
  private readonly uploadDir = resolveLocalUploadDir();
  private provider = process.env.UPLOAD_PROVIDER || 'local';

  constructor() {
    // Ensure upload directory exists for local storage
    if (this.provider === 'local' && !fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  // ─── VALIDATE FILE ────────────────────────────────
  validateFile(file: Express.Multer.File): void {
    if (!file) throw new BadRequestException('No file uploaded');

    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPG/PNG files are allowed');
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size must be under 5MB');
    }
  }

  // ─── UPLOAD FILE ──────────────────────────────────
  async uploadFile(file: Express.Multer.File): Promise<string> {
    this.validateFile(file);

    const ext = file.mimetype === 'image/png' ? '.png' : '.jpg';
    const filename = `${crypto.randomUUID()}${ext}`;

    switch (this.provider) {
      case 's3':
        return this.uploadToS3(file, filename);
      case 'r2':
        return this.uploadToR2(file, filename);
      default:
        return this.uploadLocal(file, filename);
    }
  }

  // ─── LOCAL STORAGE ────────────────────────────────
  private async uploadLocal(file: Express.Multer.File, filename: string): Promise<string> {
    const filepath = path.join(this.uploadDir, filename);
    fs.writeFileSync(filepath, file.buffer);
    return `/uploads/${filename}`;
  }

  // ─── AWS S3 ──────────────────────────────────────
  private async uploadToS3(file: Express.Multer.File, filename: string): Promise<string> {
    const bucket = process.env.AWS_S3_BUCKET!;
    const region = process.env.AWS_S3_REGION || 'ap-south-1';
    const key = `photos/${filename}`;
    const endpoint = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({ region });
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    return endpoint;
  }

  // ─── CLOUDFLARE R2 ─────────────────────────────────
  private async uploadToR2(file: Express.Multer.File, filename: string): Promise<string> {
    const accountId = process.env.R2_ACCOUNT_ID!;
    const bucket = process.env.R2_BUCKET_NAME || 'rishtenate-photos';
    const key = `photos/${filename}`;

    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY!,
        secretAccessKey: process.env.R2_SECRET_KEY!,
      },
    });
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    return `https://${process.env.R2_PUBLIC_DOMAIN}/${key}`;
  }

  // ─── DELETE FILE ──────────────────────────────────
  async deleteFile(url: string): Promise<void> {
    if (url.startsWith('/uploads/')) {
      const filename = url.replace(/^\/uploads\//, '');
      const filepath = path.join(this.uploadDir, path.basename(filename));
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      return;
    }

    // S3 delete
    if (this.provider === 's3' && url.includes('.s3.')) {
      const key = url.split('.amazonaws.com/')[1];
      if (!key) return;
      const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({ region: process.env.AWS_S3_REGION || 'ap-south-1' });
      await client.send(new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: key,
      }));
      return;
    }

    // R2 delete
    if (this.provider === 'r2' && url.includes('.r2.dev')) {
      const key = url.split('.r2.dev/')[1];
      if (!key) return;
      const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY!,
          secretAccessKey: process.env.R2_SECRET_KEY!,
        },
      });
      await client.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME || 'rishtenate-photos',
        Key: key,
      }));
    }
  }
}

// ─── CONTROLLER ─────────────────────────────────────
@ApiTags('Upload')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('upload')
class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post('photo')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  async uploadPhoto(@Request() req: any) {
    const part = await req.file();
    if (!part) throw new BadRequestException('No file uploaded');

    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedMimes.includes(part.mimetype)) {
      throw new BadRequestException('Only JPG/PNG files are allowed');
    }

    // Provided by @fastify/multipart
    const buffer: Buffer = await part.toBuffer();
    const maxSize = 5 * 1024 * 1024;
    if (buffer.length > maxSize) {
      throw new BadRequestException('File size must be under 5MB');
    }

    const url = await this.uploadService.uploadFile({
      buffer,
      mimetype: part.mimetype,
      size: buffer.length,
      originalname: part.filename,
    } as unknown as Express.Multer.File);

    return { url, filename: part.filename, size: buffer.length };
  }
}

// ─── MODULE ─────────────────────────────────────────
@Module({
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
