import os from 'os';
import { type Payload } from './proto-loader';

/**
 * Build a Nacos Payload from a plain object.
 * JSON.stringify preserves false/0/"" — no omitempty issue.
 */
export function buildPayload(obj: Record<string, any>, typeName: string): Payload {
  const jsonBytes = Buffer.from(JSON.stringify(obj));
  return {
    metadata: { type: typeName, clientIp: localIP(), headers: {} },
    body: { value: jsonBytes },
  };
}

/**
 * Parse a Nacos Payload into a plain object.
 */
export function parsePayload(payload: Payload): [Record<string, any>, string] {
  const typeName = payload.metadata?.type ?? '';
  if (!typeName) throw new Error('Empty type in payload metadata');
  const jsonStr = Buffer.from(payload.body.value).toString('utf-8');
  const obj = JSON.parse(jsonStr);
  return [obj, typeName];
}

function localIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}
