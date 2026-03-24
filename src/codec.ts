import os from 'os';
import { type Payload } from './proto-loader';

export interface MessageFns<T> {
  toJSON(message: T): unknown;
  fromJSON(object: any): T;
  fromPartial(object: any): T;
}

/**
 * Build a Nacos Payload from a ts-proto message.
 * Uses MessageFns.toJSON() for type-safe serialization.
 */
export function buildPayload<T>(msg: T, typeName: string, fns?: MessageFns<T>): Payload {
  const obj = fns ? fns.toJSON(msg) : msg;
  const jsonBytes = Buffer.from(JSON.stringify(obj));
  return {
    metadata: { type: typeName, clientIp: localIP(), headers: {} },
    body: { value: jsonBytes },
  };
}

/**
 * Parse a Nacos Payload into a ts-proto message.
 */
export function parsePayload<T>(payload: Payload, fns?: MessageFns<T>): [T, string] {
  const typeName = payload.metadata?.type ?? '';
  if (!typeName) throw new Error('Empty type in payload metadata');
  const jsonStr = Buffer.from(payload.body.value).toString('utf-8');
  const obj = JSON.parse(jsonStr);
  const msg = fns ? fns.fromJSON(obj) : obj;
  return [msg, typeName];
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
