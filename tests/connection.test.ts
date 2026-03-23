import { describe, it, expect, afterEach } from 'vitest';
import { NacosClient } from '../src/nacos-client';

describe('Connection', () => {
  let client: NacosClient;

  afterEach(() => client?.close());

  it('should complete handshake and get connectionId', async () => {
    client = await NacosClient.create('127.0.0.1:9848');
    expect(client.connectionId).toBeTruthy();
    console.log(`connectionId=${client.connectionId}`);
  });
});
