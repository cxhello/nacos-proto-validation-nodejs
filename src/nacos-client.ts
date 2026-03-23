import { Connection } from './connection';
import { buildPayload, parsePayload } from './codec';

export class NacosClient {
  private conn: Connection;

  get connectionId(): string {
    return this.conn.connectionId;
  }

  private constructor(conn: Connection) {
    this.conn = conn;
  }

  static async create(serverAddr: string): Promise<NacosClient> {
    const conn = new Connection(serverAddr);
    await conn.connect();
    return new NacosClient(conn);
  }

  async unaryRequest(obj: Record<string, any>, typeName: string): Promise<any> {
    const payload = buildPayload(obj, typeName);
    const resp = await this.conn.unaryRequest(payload);
    const [msg, respType] = parsePayload(resp);
    if (respType === 'ErrorResponse') {
      throw new Error(`Server error: ${JSON.stringify(msg)}`);
    }
    return msg;
  }

  waitForPush(targetType: string, callback: (msg: any) => void): void {
    this.conn.setPushHandler((typeName, msg) => {
      if (typeName === targetType) callback(msg);
    });
  }

  close(): void {
    this.conn.close();
  }
}
