import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const storageRoot = process.env.STORAGE_ROOT || path.join(process.cwd(), 'uploads');

export async function saveLocalFile(file: File, buffer?: Buffer) {
  const fileBuffer = buffer ?? Buffer.from(await file.arrayBuffer());
  const folder = storageRoot;
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
  const ext = file.name.split('.').pop();
  const filename = `${randomUUID()}.${ext || 'bin'}`;
  const fullPath = path.join(folder, filename);
  fs.writeFileSync(fullPath, fileBuffer);
  return {
    path: fullPath,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: fileBuffer.length,
    ext,
  };
}

export function getStorageRoot() {
  return storageRoot;
}
