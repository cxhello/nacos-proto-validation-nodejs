# Nacos Proto Node.js/TypeScript Validation

End-to-end validation that a Node.js/TypeScript gRPC client can communicate with Nacos Server using proto + JSON wire format, with **ts-proto static types**.

Part of the [multi-language SDK proto unification proposal](https://github.com/alibaba/nacos/issues/14683).

## Approach

- **ts-proto static types** — business messages use generated TypeScript interfaces from [@nacos/sdk-proto](https://github.com/cxhello/nacos-sdk-proto/tree/main/nodejs) (`fromPartial` → `toJSON` → JSON bytes)
- **@grpc/proto-loader** — gRPC transport layer still uses dynamic `.proto` loading for `Payload`/`Metadata`/`Request`/`BiRequestStream` service definitions
- **No omitempty problem** — `JSON.stringify` naturally preserves `false`/`0`/`""` (unlike Go's default JSON marshaling)

## Architecture

```
┌─────────────────────────────────────────┐
│         NacosClient (nacos-client.ts)    │
│  request<T>() / waitForPush() / close   │
├─────────────────────────────────────────┤
│         Connection (connection.ts)       │
│  ServerCheck → BiStream → Setup → Ack   │
│  Shared gRPC Channel (channelOverride)  │
├─────────────────────────────────────────┤
│           Codec (codec.ts)              │
│  buildPayload: MessageFns.toJSON → JSON │
│  parsePayload: JSON.parse → fromJSON    │
├──────────────────┬──────────────────────┤
│  ts-proto types  │  Proto Loader        │
│  @nacos/sdk-proto│  @grpc/proto-loader  │
│  (business msgs) │  (gRPC transport)    │
└──────────────────┴──────────────────────┘
```

## Prerequisites

- Node.js 20+
- pnpm
- Nacos Server running on `127.0.0.1:9848`
- `nacos-sdk-proto` cloned at `../nacos-sdk-proto/` (for `file:` dependency)

## Quick Start

```bash
# Start Nacos Server
docker run -d --name nacos -e MODE=standalone \
  -p 8848:8848 -p 9848:9848 nacos/nacos-server:v3.2.0-BETA

# Install and run tests
pnpm install
npx vitest run
```

## Test Results

| # | Test | Status |
|---|------|:------:|
| 1 | Connection Handshake | ✅ |
| 2 | Config Publish | ✅ |
| 3 | Config Query | ✅ |
| 4 | Config Remove | ✅ |
| 5 | Config Listen (push notification) | ✅ |
| 6 | Instance Register | ✅ |
| 7 | Service Query | ✅ |
| 8 | Instance Deregister | ✅ |
| 9 | Subscribe Service | ✅ |
| 10 | Zero-value: boolean false | ✅ |
| 11 | Zero-value: ts-proto toJSON default omission | ✅ |
| 12 | Zero-value: empty map | ✅ |

## Usage Example

```typescript
import { ConfigQueryRequest } from '@nacos/sdk-proto';
import { NacosClient } from './src/nacos-client';

const client = await NacosClient.create('127.0.0.1:9848');

// Type-safe request construction
const req = ConfigQueryRequest.fromPartial({
  dataId: 'app.properties',
  group: 'DEFAULT_GROUP',
});

// Type-safe serialization (toJSON) → Payload → gRPC
const resp = await client.request(req, 'ConfigQueryRequest', ConfigQueryRequest);
console.log(resp.content);
```

## Key Implementation Details

### Shared gRPC Channel

Unary RPC client and BiStream **must share the same gRPC channel** (`channelOverride`). Otherwise, Nacos Server treats them as separate connections and push notifications are never delivered.

```typescript
const channel = new grpc.Channel(addr, creds, {});
const requestClient = new RequestService(addr, creds, { channelOverride: channel });
const biClient = new BiRequestStreamService(addr, creds, { channelOverride: channel });
```

### ts-proto Zero-Value Behavior

ts-proto's `toJSON()` omits default values (`false`, `0`, `""`, `{}`), matching Jackson's `NON_NULL` behavior. For cases where zero values must be preserved, use `JSON.stringify` on the raw object instead of `toJSON()`.

## Cross-language Validation Matrix

| # | Test | Go | Python | Node.js |
|---|------|:---:|:---:|:---:|
| 1-9 | Business operations | ✅ | ✅ | ✅ |
| 10-12 | Zero-value edge cases | ✅ | ✅ | ✅ |

## License

Apache License 2.0
