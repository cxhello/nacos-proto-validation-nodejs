import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { NacosClient } from '../src/nacos-client';
import {
  ConfigPublishRequest,
  ConfigQueryRequest,
  ConfigRemoveRequest,
  ConfigBatchListenRequest,
} from '@nacos/sdk-proto';

describe('Config (ts-proto)', () => {
  let client: NacosClient;

  beforeEach(async () => {
    client = await NacosClient.create('127.0.0.1:9848');
  });
  afterEach(() => client?.close());

  it('should publish config', async () => {
    const req = ConfigPublishRequest.fromPartial({
      dataId: 'node-proto-test.yaml',
      group: 'DEFAULT_GROUP',
      tenant: '',
      content: 'server:\n  port: 8080',
      additionMap: { type: 'yaml' },
    });
    const resp = await client.request(req, 'ConfigPublishRequest', ConfigPublishRequest);
    expect(resp.resultCode).toBe(200);
  });

  it('should query config', async () => {
    // Publish first
    const pub = ConfigPublishRequest.fromPartial({
      dataId: 'node-proto-test.yaml',
      group: 'DEFAULT_GROUP',
      content: 'server:\n  port: 9090',
    });
    await client.request(pub, 'ConfigPublishRequest', ConfigPublishRequest);
    await new Promise(r => setTimeout(r, 1000));

    const req = ConfigQueryRequest.fromPartial({
      dataId: 'node-proto-test.yaml',
      group: 'DEFAULT_GROUP',
    });
    const resp = await client.request(req, 'ConfigQueryRequest', ConfigQueryRequest);
    expect(resp.content).toBe('server:\n  port: 9090');
  });

  it('should remove config', async () => {
    const pub = ConfigPublishRequest.fromPartial({
      dataId: 'node-proto-test-rm.yaml',
      group: 'DEFAULT_GROUP',
      content: 'to-be-removed',
    });
    await client.request(pub, 'ConfigPublishRequest', ConfigPublishRequest);
    await new Promise(r => setTimeout(r, 1000));

    const req = ConfigRemoveRequest.fromPartial({
      dataId: 'node-proto-test-rm.yaml',
      group: 'DEFAULT_GROUP',
    });
    const resp = await client.request(req, 'ConfigRemoveRequest', ConfigRemoveRequest);
    expect(resp.resultCode).toBe(200);
  });

  it('should listen for config changes', async () => {
    // Publish initial
    const pub = ConfigPublishRequest.fromPartial({
      dataId: 'node-proto-test-listen.yaml',
      group: 'DEFAULT_GROUP',
      content: 'version: 1',
    });
    await client.request(pub, 'ConfigPublishRequest', ConfigPublishRequest);
    await new Promise(r => setTimeout(r, 1000));

    // Set up push receiver BEFORE listen (avoid race)
    const pushPromise = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Push timeout')), 10000);
      client.waitForPush('ConfigChangeNotifyRequest', (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
    });

    // BatchListen
    const listen = ConfigBatchListenRequest.fromPartial({
      listen: true,
      configListenContexts: [
        { dataId: 'node-proto-test-listen.yaml', group: 'DEFAULT_GROUP', md5: '' },
      ],
    });
    await client.request(listen, 'ConfigBatchListenRequest', ConfigBatchListenRequest);

    // Modify from another connection
    const c2 = await NacosClient.create('127.0.0.1:9848');
    const pub2 = ConfigPublishRequest.fromPartial({
      dataId: 'node-proto-test-listen.yaml',
      group: 'DEFAULT_GROUP',
      content: 'version: 2',
    });
    await c2.request(pub2, 'ConfigPublishRequest', ConfigPublishRequest);
    c2.close();

    const notify = await pushPromise;
    expect(notify.dataId).toBe('node-proto-test-listen.yaml');
  });
});
