import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const storageRoot = process.env.STORAGE_ROOT || path.join(process.cwd(), 'uploads');

export async function saveLocalFile(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const folder = storageRoot;
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
  const ext = file.name.split('.').pop();
  const filename = `${randomUUID()}.${ext || 'bin'}`;
  const fullPath = path.join(folder, filename);
  fs.writeFileSync(fullPath, buffer);
  return { path: fullPath, name: file.name, mimeType: file.type };
}

export function getStorageRoot() {
  return storageRoot;
}
