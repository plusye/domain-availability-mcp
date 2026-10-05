import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PassThrough } from 'node:stream';
import { forward, bridgeError, runBridge } from '../src/bridge.js';
import { readKey } from '../src/key.js';

const reply = (status, body, type = 'application/json') =>
  new Response(body === null ? null : typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': type },
  });

test('forward sends the key as a bearer token', async () => {
  let seen;
  await forward({ jsonrpc: '2.0', id: 1, method: 'ping' }, {
    url: 'https://x/mcp',
    key: 'nck_k',
    fetchImpl: async (url, init) => { seen = init; return reply(200, { jsonrpc: '2.0', id: 1, result: {} }); },
  });
  assert.equal(seen.headers.Authorization, 'Bearer nck_k');
});

test('forward sends no Authorization header without a key', async () => {
  let seen;
  await forward({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, {
    url: 'https://x/mcp', key: '',
    fetchImpl: async (url, init) => { seen = init; return reply(200, { jsonrpc: '2.0', id: 1, result: { tools: [] } }); },
  });
  assert.equal(seen.headers.Authorization, undefined);
});

test('a notification accepted with 202 yields nothing to write', async () => {
  const out = await forward({ jsonrpc: '2.0', method: 'notifications/initialized' }, {
    url: 'https://x/mcp', key: 'k', fetchImpl: async () => reply(202, null),
  });
  assert.equal(out, null);
});

test('an event-stream answer is read from its data lines', async () => {
  const out = await forward({ jsonrpc: '2.0', id: 2, method: 'ping' }, {
    url: 'https://x/mcp', key: 'k',
    fetchImpl: async () => reply(200, 'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{}}\n\n', 'text/event-stream'),
  });
  assert.deepEqual(out, { jsonrpc: '2.0', id: 2, result: {} });
});

test('an undeliverable request becomes a JSON-RPC error; a notification stays silent', () => {
  assert.equal(bridgeError({ jsonrpc: '2.0', id: 7, method: 'x' }, new Error('offline')).id, 7);
  assert.equal(bridgeError({ jsonrpc: '2.0', method: 'notifications/x' }, new Error('offline')), null);
});

test('the bridge answers line by line over stdio', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let written = '';
  output.on('data', (c) => { written += c; });
  const done = runBridge({
    input, output, log: () => {}, url: 'https://x/mcp', key: 'k',
    fetchImpl: async (url, init) => {
      const msg = JSON.parse(init.body);
      return msg.id === undefined ? reply(202, null) : reply(200, { jsonrpc: '2.0', id: msg.id, result: { ok: true } });
    },
  });
  input.write('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n');
  input.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
  input.write('not json\n');
  input.end();
  await done;
  await new Promise((r) => setTimeout(r, 20));
  const lines = written.trim().split('\n').map((l) => JSON.parse(l));
  assert.ok(lines.some((l) => l.id === 1 && l.result.ok));
  assert.ok(lines.some((l) => l.error?.code === -32700));
  assert.equal(lines.length, 2);
});

test('the key comes from the environment before the file', async () => {
  assert.equal(await readKey({ NAMECHAN_API_KEY: ' nck_env ' }, '/nonexistent'), 'nck_env');
  assert.equal(await readKey({}, '/nonexistent'), '');
});

test('the User-Agent version matches the package', async () => {
  const { readFileSync } = await import('node:fs');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  let seen;
  await forward({ jsonrpc: '2.0', id: 1, method: 'ping' }, {
    url: 'https://x/mcp', key: '',
    fetchImpl: async (url, init) => { seen = init; return reply(200, { jsonrpc: '2.0', id: 1, result: {} }); },
  });
  assert.equal(seen.headers['User-Agent'], `domain-availability-mcp/${pkg.version}`);
});
