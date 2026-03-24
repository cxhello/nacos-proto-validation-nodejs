import { Connection } from './connection';
import { buildPayload, parsePayload, type MessageFns } from './codec';

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

  /**
   * Send a typed request and parse the response.
   * @param msg - ts-proto message (created via XxxRequest.fromPartial())
   * @param typeName - metadata.type value (e.g. "ConfigQueryRequest")
   * @param reqFns - ts-proto MessageFns for request serialization
   * @param respFns - optional ts-proto MessageFns for response deserialization
   */
  async request<TReq, TResp = any>(
    msg: TReq,
    typeName: string,
    reqFns: MessageFns<TReq>,
    respFns?: MessageFns<TResp>,
  ): Promise<TResp> {
    const payload = buildPayload(msg, typeName, reqFns);
    const resp = await this.conn.unaryRequest(payload);
    const [respMsg, respType] = parsePayload(resp, respFns);
    if (respType === 'ErrorResponse') {
      throw new Error(`Server error: ${JSON.stringify(respMsg)}`);
    }
    return respMsg;
  }

  /**
   * Legacy untyped request (for connection-level messages).
   */
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
