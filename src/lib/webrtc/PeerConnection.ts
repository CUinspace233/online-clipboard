export type SignalSender = (
  type: 'offer' | 'answer' | 'ice-candidate',
  payload: string
) => Promise<void>;

export interface PeerConnectionOptions {
  sendSignal: SignalSender;
  onDataChannelOpen?: () => void;
  onDataChannelClose?: () => void;
  onDataChannelMessage?: (data: ArrayBuffer | string) => void;
  onError?: (error: Error) => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export class PeerConnection {
  private pc: RTCPeerConnection;
  private dataChannel: RTCDataChannel | null = null;
  private sendSignal: SignalSender;
  private options: PeerConnectionOptions;
  private closed = false;

  constructor(options: PeerConnectionOptions) {
    this.options = options;
    this.sendSignal = options.sendSignal;

    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.pc.onicecandidate = (event) => {
      if (event.candidate && !this.closed) {
        this.sendSignal('ice-candidate', JSON.stringify(event.candidate)).catch((err) =>
          console.error('Failed to send ICE candidate:', err)
        );
      }
    };

    this.pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'disconnected') {
        this.options.onError?.(new Error(`Connection ${this.pc.connectionState}`));
      }
    };
  }

  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      this.options.onDataChannelOpen?.();
    };

    channel.onclose = () => {
      this.options.onDataChannelClose?.();
    };

    channel.onmessage = (event) => {
      this.options.onDataChannelMessage?.(event.data);
    };

    channel.onerror = (event) => {
      this.options.onError?.(new Error(`DataChannel error: ${event}`));
    };
  }

  async createOffer(): Promise<void> {
    const channel = this.pc.createDataChannel('fileTransfer', {
      ordered: true,
    });
    this.setupDataChannel(channel);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.sendSignal('offer', JSON.stringify(offer));
  }

  async handleOffer(offerSdp: string): Promise<void> {
    const offer = JSON.parse(offerSdp) as RTCSessionDescriptionInit;
    await this.pc.setRemoteDescription(offer);

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await this.sendSignal('answer', JSON.stringify(answer));
  }

  async handleAnswer(answerSdp: string): Promise<void> {
    const answer = JSON.parse(answerSdp) as RTCSessionDescriptionInit;
    await this.pc.setRemoteDescription(answer);
  }

  async addIceCandidate(candidateJson: string): Promise<void> {
    const candidate = JSON.parse(candidateJson) as RTCIceCandidateInit;
    await this.pc.addIceCandidate(candidate);
  }

  getDataChannel(): RTCDataChannel | null {
    return this.dataChannel;
  }

  close() {
    this.closed = true;
    this.dataChannel?.close();
    this.pc.close();
  }
}
