# Nacos Proto Node.js/TypeScript Validation

End-to-end validation that a Node.js/TypeScript gRPC client can communicate with Nacos Server using proto + JSON wire format.

Part of the [multi-language SDK proto unification proposal](https://github.com/alibaba/nacos/issues/14683).

## Key Difference from Go/Python PoC

- **No protoc code generation** — uses `@grpc/proto-loader` for dynamic `.proto` loading at runtime
- **No omitempty problem** — `JSON.stringify` naturally preserves `false`/`0`/`""` (unlike Go's default JSON marshaling)
- Business messages are plain JavaScript objects, serialized with `JSON.stringify` and stuffed into `Payload.body.value`

## Architecture

```
┌─────────────────────────────────────────┐
│         NacosClient (nacos-client.ts)    │
│  unaryRequest() / waitForPush() / close │
├─────────────────────────────────────────┤
│         Connection (connection.ts)       │
│  ServerCheck → BiStream → Setup → Ack   │
│  Shared gRPC Channel (channelOverride)  │
├─────────────────────────────────────────┤
│           Codec (codec.ts)              │
│  buildPayload: JSON.stringify → Buffer  │
│  parsePayload: Buffer → JSON.parse      │
├─────────────────────────────────────────┤
│        Proto Loader (proto-loader.ts)    │
│  @grpc/proto-loader (dynamic loading)   │
│  ../nacos-sdk-proto/proto/*.proto        │
└─────────────────────────────────────────┘
```

## Prerequisites

- Node.js 20+
- pnpm
- Nacos Server running on `127.0.0.1:9848`
- Proto definitions at `../nacos-sdk-proto/proto/`

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
| 11 | Zero-value: int zero | ✅ |
| 12 | Zero-value: empty object | ✅ |

## Key Implementation Detail

A critical finding during implementation: **unary RPC client and BiStream must share the same gRPC channel** (`channelOverride`). Otherwise, the Nacos Server treats them as separate connections and push notifications (e.g., `ConfigChangeNotifyRequest`) are never delivered to the BiStream.

```typescript
const channel = new grpc.Channel(addr, creds, {});
const requestClient = new RequestService(addr, creds, { channelOverride: channel });
const biClient = new BiRequestStreamService(addr, creds, { channelOverride: channel });
```

## Cross-language Validation Matrix

| # | Test | Go | Node.js |
|---|------|:---:|:---:|
| 1-9 | Business operations | ✅ | ✅ |
| 10-12 | Zero-value edge cases | ✅ | ✅ |

## License

Apache License 2.0
