import {chmod, mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {settings} from './config.ts';

/** Private document bytes. Keys are server-generated UUIDs; nothing here is ever publicly addressable. */
export interface Storage {
  put(key: string, content: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
}

/** Development and tests only: files on the server's own disk, readable by the server user alone. */
export class LocalStorage implements Storage {
  dir: string;
  constructor(dir: string) {
    this.dir = resolve(dir);
  }
  async put(key: string, content: Buffer) {
    await mkdir(this.dir, {recursive: true, mode: 0o700});
    const path = resolve(this.dir, key);
    await writeFile(path, content, {mode: 0o600, flag: 'wx'});
    await chmod(path, 0o600);
  }
  async get(key: string) {
    try {
      return await readFile(resolve(this.dir, key));
    } catch {
      return null;
    }
  }
}

/**
 * A private Supabase Storage bucket (Decision 31), reached with the service-role key, which stays on the server.
 * The bucket must be created private; the API streams files to authorized users, so no public or signed URL is
 * ever handed out.
 */
export class SupabaseStorage implements Storage {
  base: string;
  bucket: string;
  key: string;
  fetcher: typeof fetch;
  constructor(url: string, serviceKey: string, bucket: string, fetcher: typeof fetch = fetch) {
    this.base = url.replace(/\/+$/, '') + '/storage/v1/object';
    this.bucket = bucket;
    this.key = serviceKey;
    this.fetcher = fetcher;
  }
  headers(extra: Record<string, string> = {}) {
    return {Authorization: 'Bearer ' + this.key, apikey: this.key, ...extra};
  }
  async put(key: string, content: Buffer, mimeType: string) {
    const r = await this.fetcher(`${this.base}/${this.bucket}/${key}`, {
      method: 'POST',
      headers: this.headers({'Content-Type': mimeType, 'x-upsert': 'false', 'Cache-Control': 'no-store'}),
      body: new Uint8Array(content),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) throw new Error(`Storage upload failed with HTTP ${r.status}`);
  }
  async get(key: string) {
    const r = await this.fetcher(`${this.base}/authenticated/${this.bucket}/${key}`, {headers: this.headers(), signal: AbortSignal.timeout(30_000)});
    if (r.status === 400 || r.status === 404) return null;
    if (!r.ok) throw new Error(`Storage download failed with HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
}

let cached: Storage | undefined;
export function storage(): Storage {
  if (cached) return cached;
  const cfg = settings();
  cached =
    cfg.storageDriver === 'supabase'
      ? new SupabaseStorage(cfg.supabaseUrl, cfg.supabaseServiceRoleKey, cfg.supabaseStorageBucket)
      : new LocalStorage(cfg.privateStoragePath);
  return cached;
}
