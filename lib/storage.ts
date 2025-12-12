import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const storageRoot = process.env.STORAGE_ROOT || path.join(process.cwd(), 'uploads');
const spacesBucket = process.env.SPACES_BUCKET;
const spacesEndpoint = process.env.SPACES_ENDPOINT;
const spacesRegion = process.env.SPACES_REGION || 'us-east-1';
const spacesAccessKey = process.env.SPACES_ACCESS_KEY;
const spacesSecretKey = process.env.SPACES_SECRET_KEY;

const spacesEnabled = Boolean(spacesBucket && spacesEndpoint && spacesAccessKey && spacesSecretKey);

const s3Client = spacesEnabled
  ? new S3Client({
      forcePathStyle: true,
      endpoint: spacesEndpoint,
      region: spacesRegion,
      credentials: {
        accessKeyId: spacesAccessKey as string,
        secretAccessKey: spacesSecretKey as string,
      },
    })
  : null;

export type StoredFile = {
  path: string;
  name: string;
  mimeType: string;
  size: number;
  ext?: string;
  storageProvider: 'spaces' | 'local';
};

export function isSpacesStorage() {
  return spacesEnabled;
}

export async function saveFile(file: File, buffer?: Buffer): Promise<StoredFile> {
  const fileBuffer = buffer ?? Buffer.from(await file.arrayBuffer());
  const ext = file.name.split('.').pop();
  const filename = `${randomUUID()}.${ext || 'bin'}`;

  if (spacesEnabled && s3Client) {
    const key = `uploads/${filename}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: spacesBucket,
        Key: key,
        Body: fileBuffer,
        ContentType: file.type || 'application/octet-stream',
      })
    );
    return {
      path: `spaces:${key}`,
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: fileBuffer.length,
      ext,
      storageProvider: 'spaces',
    };
  }

  const folder = storageRoot;
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
  const fullPath = path.join(folder, filename);
  fs.writeFileSync(fullPath, fileBuffer);
  return {
    path: fullPath,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: fileBuffer.length,
    ext,
    storageProvider: 'local',
  };
}

export function getStorageRoot() {
  return storageRoot;
}

export async function getFileStream(storedPath: string) {
  if (storedPath.startsWith('spaces:')) {
    if (!s3Client) throw new Error('Spaces client not configured');
    const key = storedPath.replace('spaces:', '');
    const result = await s3Client.send(new GetObjectCommand({ Bucket: spacesBucket, Key: key }));
    return { stream: result.Body as any, contentType: result.ContentType };
  }
  const stream = fs.createReadStream(storedPath);
  return { stream, contentType: undefined };
}

export async function deleteStoredFile(storedPath: string | null | undefined) {
  if (!storedPath) return;
  if (storedPath.startsWith('spaces:')) {
    if (!s3Client) return;
    const key = storedPath.replace('spaces:', '');
    await s3Client.send(new DeleteObjectCommand({ Bucket: spacesBucket, Key: key })).catch(() => {});
    return;
  }
  if (fs.existsSync(storedPath)) {
    fs.unlinkSync(storedPath);
  }
}
