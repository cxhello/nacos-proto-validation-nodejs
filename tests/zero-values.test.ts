import { describe, it, expect } from 'vitest';

describe('Zero-value serialization', () => {
  it('should preserve boolean false in JSON.stringify', () => {
    const instance = {
      ip: '192.168.1.1', port: 8080, weight: 1.0,
      healthy: true, enabled: true, ephemeral: false,  // persistent!
    };
    const json = JSON.stringify(instance);
    const parsed = JSON.parse(json);
    expect(parsed.ephemeral).toBe(false);
    expect('ephemeral' in parsed).toBe(true);
    console.log(`JSON.stringify output: ${json}`);
  });

  it('should preserve int zero in JSON.stringify', () => {
    const instance = {
      ip: '192.168.1.1', port: 0, weight: 1.0, ephemeral: true,
    };
    const json = JSON.stringify(instance);
    const parsed = JSON.parse(json);
    expect(parsed.port).toBe(0);
    expect('port' in parsed).toBe(true);
  });

  it('should preserve empty object in JSON.stringify', () => {
    const req = {
      dataId: 'test', group: 'DEFAULT_GROUP', content: 'test',
      additionMap: {},
    };
    const json = JSON.stringify(req);
    const parsed = JSON.parse(json);
    expect(parsed.additionMap).toEqual({});
  });
});
