import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Where `namechan.com/api-keys` tells people to save their key. */
export const KEY_FILE = join(homedir(), '.config', 'namechan', 'api-key');

/** The API key: NAMECHAN_API_KEY first, then the key file. Empty when neither has one. */
export async function readKey(env = process.env, file = KEY_FILE) {
  const fromEnv = (env.NAMECHAN_API_KEY ?? '').trim();
  if (fromEnv) return fromEnv;
  try {
    return (await readFile(file, 'utf8')).trim();
  } catch {
    return '';
  }
}
