import assert from 'node:assert/strict';
import {test} from 'node:test';
import {coordsFromText, isMapsLink, resolveLink} from '../src/maps.ts';

// Port of apps/api tests/test_marketplace.py::test_maps_link_parsing_and_host_allowlist.
test('maps link parsing and host allowlist', () => {
  assert.deepEqual(coordsFromText('30.3165, 78.0322'), [30.3165, 78.0322]);
  assert.deepEqual(coordsFromText('https://www.google.com/maps/place/X/@30.31,78.03,17z/data=!3d30.3165!4d78.0322'), [30.3165, 78.0322]);
  assert.deepEqual(coordsFromText('https://maps.google.com/?q=30.3165,78.0322'), [30.3165, 78.0322]);
  assert.deepEqual(coordsFromText('https://www.google.com/maps/search/?api=1&query=30.3165%2C78.0322'), [30.3165, 78.0322]);
  assert.equal(coordsFromText('0, 0'), null);
  assert.equal(coordsFromText('https://maps.app.goo.gl/AbCd123'), null);
  assert.ok(isMapsLink('https://maps.app.goo.gl/AbCd123'));
  assert.ok(isMapsLink('https://www.google.com/maps/place/X'));
  for (const evil of [
    'https://evil.example/maps',
    'https://goo.gl/notmaps',
    'ftp://maps.google.com/x',
    'https://google.com.evil.example/maps',
    'https://www.google.com/search?q=x',
    'https://evil.example\\@www.google.com/maps',
    'not a url',
  ]) {
    assert.ok(!isMapsLink(evil), evil);
  }
});

// Port of test_short_link_is_followed_only_within_google_hosts.
test('short links are followed only within Google hosts', async () => {
  const seen: string[] = [];
  const fake = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    seen.push(url.host);
    if (url.host === 'maps.app.goo.gl' && url.pathname === '/good') {
      return new Response(null, {status: 302, headers: {location: 'https://www.google.com/maps/place/X/@30.3165,78.0322,17z'}});
    }
    if (url.host === 'maps.app.goo.gl' && url.pathname === '/evil') {
      return new Response(null, {status: 302, headers: {location: 'http://169.254.169.254/latest/meta-data'}});
    }
    if (url.host === 'maps.app.goo.gl' && url.pathname === '/broken') throw new TypeError('network down');
    return new Response('ok', {status: 200});
  }) as typeof fetch;
  assert.deepEqual(await resolveLink('https://maps.app.goo.gl/good', fake), [30.3165, 78.0322]);
  assert.equal(await resolveLink('https://maps.app.goo.gl/evil', fake), null);
  assert.equal(await resolveLink('https://evil.example/x', fake), null);
  assert.equal(await resolveLink('https://maps.app.goo.gl/broken', fake), null);
  assert.ok(!seen.includes('169.254.169.254') && !seen.includes('evil.example'));
});

test('a slow chain of short links stops at the overall deadline', {timeout: 15_000}, async () => {
  let hops = 0;
  const slow = (async (input: string | URL | Request, init: RequestInit = {}) => {
    hops++;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 4000);
      init.signal?.addEventListener('abort', () => (clearTimeout(timer), reject(init.signal!.reason)));
    });
    return new Response(null, {status: 302, headers: {location: `https://maps.app.goo.gl/hop${hops}`}});
  }) as typeof fetch;
  const started = Date.now();
  assert.equal(await resolveLink('https://maps.app.goo.gl/start', slow), null);
  assert.ok(Date.now() - started < 9000, 'gave up within the total budget');
  assert.ok(hops <= 3);
});
