/**
 * A stdio MCP server that forwards every message to Namechan's remote MCP
 * endpoint. The remote server is stateless and answers each JSON-RPC message
 * with one JSON body, so the bridge needs no protocol logic of its own: read a
 * line, POST it, write back what comes back.
 *
 * It exists for clients that can only start local servers (Claude Desktop's
 * config file, Codex). Clients that speak Streamable HTTP can connect to
 * https://namechan.com/mcp directly.
 */

export const DEFAULT_URL = 'https://namechan.com/mcp';

/** Sent as the User-Agent; kept in step with package.json. */
const VERSION = '1.1.1';

/**
 * Sends one message (or batch) upstream. Returns the parsed answer, or null
 * when the server accepted it without one (a notification).
 */
export async function forward(message, { url, key, fetchImpl = fetch }) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'User-Agent': `domain-availability-mcp/${VERSION}`,
  };
  if (key) headers.Authorization = `Bearer ${key}`;

  const res = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(message) });
  if (res.status === 202 || res.status === 204) return null;

  const text = await res.text();
  const type = res.headers.get('content-type') ?? '';
  if (type.includes('text/event-stream')) {
    // Not what the server sends today, but the transport allows it: take the
    // data lines of each event.
    const answers = text
      .split(/\n\n+/)
      .map((event) => event.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join(''))
      .filter(Boolean)
      .map((data) => JSON.parse(data));
    return answers.length === 1 ? answers[0] : answers;
  }
  if (!text) return null;
  return JSON.parse(text);
}

/** A JSON-RPC error for a request the bridge could not deliver. */
export function bridgeError(message, error) {
  const id = message && typeof message === 'object' && 'id' in message ? message.id : null;
  if (id === null || id === undefined) return null; // nobody is waiting on a notification
  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32603, message: `Could not reach Namechan: ${error?.message ?? String(error)}` },
  };
}

/**
 * Runs the bridge over the given streams: newline-delimited JSON-RPC in,
 * newline-delimited JSON-RPC out, as the stdio transport specifies.
 */
export function runBridge({ input, output, log, url, key, fetchImpl }) {
  let buffer = '';

  const write = (value) => {
    if (value === null || value === undefined) return;
    output.write(`${JSON.stringify(value)}\n`);
  };

  const handleLine = async (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      return;
    }
    try {
      write(await forward(message, { url, key, fetchImpl }));
    } catch (error) {
      log(`domain-availability-mcp: ${error?.message ?? error}`);
      write(bridgeError(message, error));
    }
  };

  input.setEncoding('utf8');
  input.on('data', (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      // Answered in parallel; the ids keep the answers apart. A client waits
      // for initialize before sending anything else, so no ordering is needed.
      handleLine(line);
    }
  });

  return new Promise((resolve) => input.on('end', resolve));
}
