import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SupabaseStorage} from '../src/storage.ts';

// No Supabase project exists yet, so this checks the requests the driver sends, not Supabase itself.
test('supabase storage sends private, authenticated requests and treats missing objects as absent', async () => {
  const calls: {url: string; init: RequestInit}[] = [];
  const objects = new Map<string, Uint8Array>();
  const fake = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({url, init});
    if (init.method === 'POST') {
      objects.set(url.split('/').pop()!, init.body as Uint8Array);
      return new Response('{}', {status: 200});
    }
    const found = objects.get(url.split('/').pop()!);
    return found ? new Response(found, {status: 200}) : new Response('{"error":"not_found"}', {status: 400});
  }) as typeof fetch;
  const store = new SupabaseStorage('https://project.supabase.co/', 'service-role-key', 'private-documents', fake);
  await store.put('k1', Buffer.from('bytes'), 'image/png');
  const upload = calls[0];
  assert.equal(upload.url, 'https://project.supabase.co/storage/v1/object/private-documents/k1');
  const headers = upload.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer service-role-key');
  assert.equal(headers['Content-Type'], 'image/png');
  assert.equal(headers['x-upsert'], 'false');
  assert.deepEqual(await store.get('k1'), Buffer.from('bytes'));
  assert.equal(calls[1].url, 'https://project.supabase.co/storage/v1/object/authenticated/private-documents/k1');
  assert.equal(await store.get('missing'), null);
  const failing = new SupabaseStorage('https://p.supabase.co', 'k', 'b', (async () => new Response('', {status: 500})) as typeof fetch);
  await assert.rejects(failing.put('x', Buffer.from('y'), 'image/png'));
  await assert.rejects(failing.get('x'));
});

test('uploads are refused before the body is read when there is no valid token', async () => {
  const {system} = await import('./helpers.ts');
  const s = await system();
  try {
    const form = new FormData();
    form.set('purpose', 'IDENTITY');
    form.set('file', new Blob([new Uint8Array(1024)], {type: 'image/png'}), 'x');
    for (const headers of [{}, {Authorization: 'Bearer forged.token.value'}] as Record<string, string>[]) {
      const r = await fetch(s.base + '/api/v1/documents', {method: 'POST', headers, body: form});
      assert.equal(r.status, 401);
      assert.equal((await r.json()).error.code, 'SESSION_EXPIRED');
      assert.match(r.headers.get('content-security-policy')!, /default-src 'none'/);
    }
  } finally {
    await s.close();
  }
});
