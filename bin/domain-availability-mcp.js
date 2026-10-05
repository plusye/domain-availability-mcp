#!/usr/bin/env node
import { runBridge, DEFAULT_URL } from '../src/bridge.js';
import { readKey, KEY_FILE } from '../src/key.js';

const key = await readKey();
if (!key) {
  // Works without one, on the per-address limits. Said on stderr, which
  // clients show in their logs, so the way to more is not a secret.
  process.stderr.write(
    `domain-availability-mcp: no API key, using the free per-address limits. For a larger allowance tied to your account, create a free key at https://namechan.com/api-keys and set NAMECHAN_API_KEY or save it to ${KEY_FILE}.\n`
  );
}

await runBridge({
  input: process.stdin,
  output: process.stdout,
  log: (line) => process.stderr.write(`${line}\n`),
  url: process.env.NAMECHAN_MCP_URL || DEFAULT_URL,
  key,
});
