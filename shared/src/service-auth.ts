/**
 * Service-to-service request signing used by the Discord bot when calling the Cipher API.
 *
 * signature = hex(HMAC-SHA256(secret, `${timestamp}.${nonce}.${METHOD}.${pathWithQuery}.${sha256hex(body)}`))
 *
 * The API rejects requests older than SERVICE_MAX_SKEW_SECONDS and remembers nonces to block replays.
 */
export const SERVICE_MAX_SKEW_SECONDS = 60;

export const SERVICE_HEADERS = {
  timestamp: 'x-cipher-timestamp',
  nonce: 'x-cipher-nonce',
  signature: 'x-cipher-signature',
  actor: 'x-cipher-actor-discord-id',
  guild: 'x-cipher-guild-id',
} as const;

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256HexString(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? enc.encode(data) : data;
  return toHex(await crypto.subtle.digest('SHA-256', bytes));
}

export async function computeServiceSignature(
  secret: string,
  timestamp: string,
  nonce: string,
  method: string,
  pathWithQuery: string,
  body: string | Uint8Array,
): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const payload = `${timestamp}.${nonce}.${method.toUpperCase()}.${pathWithQuery}.${await sha256HexString(body)}`;
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
}

export function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}
