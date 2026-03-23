import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { NacosClient } from '../src/nacos-client';

describe('Config', () => {
  let client: NacosClient;

  beforeEach(async () => {
    client = await NacosClient.create('127.0.0.1:9848');
  });
  afterEach(() => client?.close());

  it('should publish config', async () => {
    const resp = await client.unaryRequest({
      dataId: 'node-proto-test.yaml',
      group: 'DEFAULT_GROUP',
      tenant: '',
      content: 'server:\n  port: 8080',
      additionMap: { type: 'yaml' },
    }, 'ConfigPublishRequest');
    expect(resp.resultCode).toBe(200);
  });

  it('should query config', async () => {
    // Publish first
    await client.unaryRequest({
      dataId: 'node-proto-test.yaml', group: 'DEFAULT_GROUP',
      content: 'server:\n  port: 9090',
    }, 'ConfigPublishRequest');
    await new Promise(r => setTimeout(r, 1000));

    const resp = await client.unaryRequest({
      dataId: 'node-proto-test.yaml', group: 'DEFAULT_GROUP',
    }, 'ConfigQueryRequest');
    expect(resp.content).toBe('server:\n  port: 9090');
  });

  it('should remove config', async () => {
    await client.unaryRequest({
      dataId: 'node-proto-test-rm.yaml', group: 'DEFAULT_GROUP',
      content: 'to-be-removed',
    }, 'ConfigPublishRequest');
    await new Promise(r => setTimeout(r, 1000));

    const resp = await client.unaryRequest({
      dataId: 'node-proto-test-rm.yaml', group: 'DEFAULT_GROUP',
    }, 'ConfigRemoveRequest');
    expect(resp.resultCode).toBe(200);
  });

  it('should listen for config changes', async () => {
    // Publish initial
    await client.unaryRequest({
      dataId: 'node-proto-test-listen.yaml', group: 'DEFAULT_GROUP',
      content: 'version: 1',
    }, 'ConfigPublishRequest');
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
    await client.unaryRequest({
      listen: true,
      configListenContexts: [
        { dataId: 'node-proto-test-listen.yaml', group: 'DEFAULT_GROUP', md5: '' },
      ],
    }, 'ConfigBatchListenRequest');

    // Modify from another connection
    const c2 = await NacosClient.create('127.0.0.1:9848');
    await c2.unaryRequest({
      dataId: 'node-proto-test-listen.yaml', group: 'DEFAULT_GROUP',
      content: 'version: 2',
    }, 'ConfigPublishRequest');
    c2.close();

    const notify = await pushPromise;
    expect(notify.dataId).toBe('node-proto-test-listen.yaml');
  });
});
