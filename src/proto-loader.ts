import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROTO_DIR = path.resolve(__dirname, '../../nacos-sdk-proto/proto');

const packageDef = protoLoader.loadSync(
  path.join(PROTO_DIR, 'nacos_grpc_service.proto'),
  {
    keepCase: true,      // preserve camelCase field names
    longs: String,       // int64 as string (matches protojson behavior)
    enums: String,
    defaults: true,      // fill default values on deserialization
    oneofs: true,
    includeDirs: [PROTO_DIR],
  }
);

const proto = grpc.loadPackageDefinition(packageDef) as any;

// Since nacos_grpc_service.proto has no package, services are at root
export const RequestService = proto.Request;
export const BiRequestStreamService = proto.BiRequestStream;

export type Payload = {
  metadata: { type: string; clientIp: string; headers: Record<string, string> };
  body: { type_url?: string; value: Buffer };
};
