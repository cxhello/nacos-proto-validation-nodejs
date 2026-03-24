import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { NacosClient } from '../src/nacos-client';
import {
  InstanceRequest,
  ServiceQueryRequest,
  SubscribeServiceRequest,
} from '@nacos/sdk-proto';

describe('Naming (ts-proto)', () => {
  let client: NacosClient;

  beforeEach(async () => {
    client = await NacosClient.create('127.0.0.1:9848');
  });
  afterEach(() => client?.close());

  it('should register instance', async () => {
    const req = InstanceRequest.fromPartial({
      namespace: 'public',
      serviceName: 'node-proto-test-svc',
      groupName: 'DEFAULT_GROUP',
      type: 'registerInstance',
      instance: {
        ip: '192.168.1.150',
        port: 8080,
        weight: 1.0,
        healthy: true,
        enabled: true,
        ephemeral: true,
        clusterName: 'DEFAULT',
        serviceName: 'node-proto-test-svc',
        metadata: { version: '1.0', lang: 'nodejs' },
      },
    });
    const resp = await client.request(req, 'InstanceRequest', InstanceRequest);
    expect(resp.resultCode).toBe(200);
  });

  it('should query service', async () => {
    // Register first
    const reg = InstanceRequest.fromPartial({
      namespace: 'public',
      serviceName: 'node-proto-test-query',
      groupName: 'DEFAULT_GROUP',
      type: 'registerInstance',
      instance: {
        ip: '192.168.1.151', port: 8081, weight: 1.0,
        healthy: true, enabled: true, ephemeral: true, clusterName: 'DEFAULT',
      },
    });
    await client.request(reg, 'InstanceRequest', InstanceRequest);
    await new Promise(r => setTimeout(r, 1000));

    const req = ServiceQueryRequest.fromPartial({
      namespace: 'public',
      serviceName: 'node-proto-test-query',
      groupName: 'DEFAULT_GROUP',
      cluster: 'DEFAULT',
    });
    const resp = await client.request(req, 'ServiceQueryRequest', ServiceQueryRequest);
    expect(resp.serviceInfo).toBeTruthy();
  });

  it('should deregister instance', async () => {
    // Register
    const reg = InstanceRequest.fromPartial({
      namespace: 'public',
      serviceName: 'node-proto-test-dereg',
      groupName: 'DEFAULT_GROUP',
      type: 'registerInstance',
      instance: {
        ip: '192.168.1.152', port: 8082, weight: 1.0,
        healthy: true, enabled: true, ephemeral: true, clusterName: 'DEFAULT',
      },
    });
    await client.request(reg, 'InstanceRequest', InstanceRequest);
    await new Promise(r => setTimeout(r, 1000));

    // Deregister
    const dereg = InstanceRequest.fromPartial({
      namespace: 'public',
      serviceName: 'node-proto-test-dereg',
      groupName: 'DEFAULT_GROUP',
      type: 'deregisterInstance',
      instance: {
        ip: '192.168.1.152', port: 8082, ephemeral: true, clusterName: 'DEFAULT',
      },
    });
    const resp = await client.request(dereg, 'InstanceRequest', InstanceRequest);
    expect(resp.resultCode).toBe(200);
  });

  it('should subscribe service', async () => {
    // Register
    const reg = InstanceRequest.fromPartial({
      namespace: 'public',
      serviceName: 'node-proto-test-sub',
      groupName: 'DEFAULT_GROUP',
      type: 'registerInstance',
      instance: {
        ip: '192.168.1.153', port: 8083, weight: 1.0,
        healthy: true, enabled: true, ephemeral: true, clusterName: 'DEFAULT',
      },
    });
    await client.request(reg, 'InstanceRequest', InstanceRequest);
    await new Promise(r => setTimeout(r, 1000));

    const req = SubscribeServiceRequest.fromPartial({
      namespace: 'public',
      serviceName: 'node-proto-test-sub',
      groupName: 'DEFAULT_GROUP',
      subscribe: true,
      clusters: '',
    });
    const resp = await client.request(req, 'SubscribeServiceRequest', SubscribeServiceRequest);
    expect(resp.serviceInfo).toBeTruthy();
    expect(resp.serviceInfo.hosts.length).toBeGreaterThan(0);
  });
});
