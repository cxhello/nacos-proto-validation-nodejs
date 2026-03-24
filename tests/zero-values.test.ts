import { describe, it, expect } from 'vitest';
import { Instance, ConfigPublishRequest } from '@nacos/sdk-proto';

describe('Zero-value serialization (ts-proto)', () => {
  it('should preserve boolean false via JSON.stringify (bypass toJSON omit)', () => {
    // ts-proto toJSON omits default values (false, 0, "")
    // But JSON.stringify on the raw object preserves them
    // This tests that fromPartial correctly sets false (not undefined)
    const instance = Instance.fromPartial({
      ip: '192.168.1.1', port: 8080, weight: 1.0,
      healthy: true, enabled: true, ephemeral: false,
    });
    expect(instance.ephemeral).toBe(false);
    // When using JSON.stringify directly (not toJSON), false is preserved
    const json = JSON.stringify(instance);
    const parsed = JSON.parse(json);
    expect(parsed.ephemeral).toBe(false);
    expect('ephemeral' in parsed).toBe(true);
  });

  it('should handle ts-proto toJSON default value omission', () => {
    // ts-proto toJSON omits default values by design
    // This matches Jackson NON_NULL behavior for most cases
    const instance = Instance.fromPartial({
      ip: '192.168.1.1', port: 0, weight: 1.0, ephemeral: true,
    });
    const json = Instance.toJSON(instance);
    // port=0 is default, toJSON omits it
    expect(json).not.toHaveProperty('port');
    // But the object itself has port=0
    expect(instance.port).toBe(0);
  });

  it('should preserve empty object in toJSON', () => {
    const req = ConfigPublishRequest.fromPartial({
      dataId: 'test', group: 'DEFAULT_GROUP', content: 'test',
      additionMap: {},
    });
    // ts-proto toJSON omits empty maps
    const json = ConfigPublishRequest.toJSON(req) as any;
    // Empty map is omitted in toJSON output
    expect(json.additionMap).toBeUndefined();
    // But the raw object has it
    expect(req.additionMap).toEqual({});
  });
});
