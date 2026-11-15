import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { createApiHandler } from '../server/http.mts';
import { createElevenLabs } from '../server/elevenlabs.mts';
import { createGemini } from '../server/gemini.mts';
test('localhost API rejects foreign origins, rebinding hosts, malformed and oversized requests without provider work', async () => {
  let calls = 0;
  const eleven = createElevenLabs({}, async () => { calls++; throw Error('no network'); });
  const gemini = createGemini({}, async () => { calls++; return ''; });
  const server = createServer(createApiHandler(eleven, gemini));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  // http.request lets this ephemeral-port test exercise the fixed production Host
  // allowlist; fetch controls Host itself and ignores that override.
  const call = (path: string, headers: Record<string, string>, body?: string) => new Promise<Response>((resolve, reject) => {
    const request = httpRequest(url + path, { method: body === undefined ? 'GET' : 'POST', headers }, response => {
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(chunk)); response.on('error', reject);
      response.on('end', () => resolve(new Response(new Uint8Array(Buffer.concat(chunks)), { status: response.statusCode,
        headers: Object.fromEntries(Object.entries(response.headers).map(([k, v]) => [k, String(v)])) })));
    }); request.on('error', reject); request.end(body);
  });
  const headers = { host: '127.0.0.1:5174', origin: 'http://127.0.0.1:5173', 'content-type': 'application/json' };
  try {
    const status = await call('/api/status', headers); assert.equal(status.status, 200);
    const info = await status.json(); assert.equal(info.elevenlabs.available, false); assert.equal(info.gemini.available, false);
    assert.equal(JSON.stringify(info).includes('API_KEY'), false);
    for (const [change, body, expected] of [
      [{ origin: 'https://untrusted.example' }, '{}', 403], [{ host: 'untrusted.example:5174' }, '{}', 403],
      [{ 'content-type': 'text/plain' }, '{}', 415], [{}, 'invalid', 400], [{}, JSON.stringify({ text: 'x'.repeat(40_000) }), 413],
      [{}, '{}', 403],
    ] as const) {
      const response = await call('/api/voices', { ...headers, ...change }, body);
      assert.equal(response.status, expected); assert.equal(response.headers.get('access-control-allow-origin'), null); await response.text();
    }
    assert.equal(calls, 0);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
