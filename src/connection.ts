import * as grpc from '@grpc/grpc-js';
import { RequestService, BiRequestStreamService, type Payload } from './proto-loader';
import { buildPayload, parsePayload } from './codec';

export class Connection {
  private channel: grpc.Channel | null = null;
  private requestClient: any;
  private biStream: any;
  public connectionId = '';
  private pushHandler: ((typeName: string, msg: any) => void) | null = null;
  private setupDone: Promise<void>;
  private resolveSetup!: () => void;

  constructor(private serverAddr: string) {
    this.setupDone = new Promise(resolve => { this.resolveSetup = resolve; });
  }

  async connect(): Promise<void> {
    const creds = grpc.credentials.createInsecure();
    // Share a single gRPC channel so unary + BiStream use the same connection
    this.channel = new grpc.Channel(this.serverAddr, creds, {});
    this.requestClient = new RequestService(this.serverAddr, creds, { channelOverride: this.channel });
    const biClient = new BiRequestStreamService(this.serverAddr, creds, { channelOverride: this.channel });

    // Step 1: ServerCheck
    await this.serverCheck();

    // Step 2: Open BiStream
    this.biStream = biClient.requestBiStream();

    // Step 3: Start receiver
    this.biStream.on('data', (payload: Payload) => this.onBiStreamData(payload));
    this.biStream.on('error', (err: any) => console.log('BiStream error:', err.message));

    // Step 4: ConnectionSetup
    this.connectionSetup();

    // Step 5: Wait for SetupAck (5s timeout)
    await Promise.race([
      this.setupDone,
      new Promise(resolve => setTimeout(resolve, 5000)),
    ]);

    // Give server time to register
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private serverCheck(): Promise<void> {
    return new Promise((resolve, reject) => {
      const payload = buildPayload({}, 'ServerCheckRequest');
      this.requestClient.request(payload, (err: any, resp: Payload) => {
        if (err) return reject(err);
        const [msg] = parsePayload(resp);
        this.connectionId = msg.connectionId || '';
        console.log(`ServerCheck OK, connectionId=${this.connectionId}`);
        resolve();
      });
    });
  }

  private connectionSetup(): void {
    const payload = buildPayload({
      clientVersion: 'nacos-proto-validation-nodejs/1.0',
      labels: { source: 'proto-validation', module: 'naming' },
      abilityTable: {},
    }, 'ConnectionSetupRequest');
    this.biStream.write(payload);
  }

  private onBiStreamData(payload: Payload): void {
    let msg: any;
    let typeName: string;
    try {
      [msg, typeName] = parsePayload(payload);
    } catch {
      typeName = payload.metadata?.type ?? '';
      if (typeName === 'SetupAckRequest') this.replySetupAck(payload);
      return;
    }

    switch (typeName) {
      case 'SetupAckRequest':
        console.log('Received SetupAckRequest, replying');
        this.replySetupAck(payload);
        break;
      case 'ClientDetectionRequest':
        console.log('Received ClientDetectionRequest, replying');
        this.replyClientDetection(msg);
        break;
      case 'ConnectResetRequest':
        console.log('Received ConnectResetRequest (log only)');
        break;
      default:
        if (this.pushHandler) this.pushHandler(typeName, msg);
        else console.log(`Received push: ${typeName}`);
    }
  }

  private replySetupAck(reqPayload: Payload): void {
    let requestId = '';
    try {
      const jsonStr = Buffer.from(reqPayload.body.value).toString('utf-8');
      requestId = JSON.parse(jsonStr).requestId || '';
    } catch {}
    const payload = buildPayload({ resultCode: 200, requestId }, 'SetupAckResponse');
    this.biStream.write(payload);
    this.resolveSetup();
  }

  private replyClientDetection(msg: any): void {
    const payload = buildPayload(
      { resultCode: 200, requestId: msg.requestId || '' },
      'ClientDetectionResponse'
    );
    this.biStream.write(payload);
  }

  unaryRequest(payload: Payload): Promise<Payload> {
    return new Promise((resolve, reject) => {
      this.requestClient.request(payload, (err: any, resp: Payload) => {
        if (err) reject(err);
        else resolve(resp);
      });
    });
  }

  biStreamWrite(payload: Payload): void {
    this.biStream.write(payload);
  }

  setPushHandler(handler: (typeName: string, msg: any) => void): void {
    this.pushHandler = handler;
  }

  close(): void {
    this.biStream?.end();
    this.requestClient?.close();
    this.channel?.close();
  }
}
