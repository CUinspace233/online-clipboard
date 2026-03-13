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
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;

  constructor(options: PeerConnectionOptions) {
    this.options = options;
    this.sendSignal = options.sendSignal;

    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.pc.onicecandidate = (event) => {
      if (event.candidate && !this.closed) {
        this.sendSignal('ice-candidate', JSON.stringify(event.candidate)).catch((err) =>
          console.error('[WebRTC] Failed to send ICE candidate:', err)
        );
      }
    };

    this.pc.ondatachannel = (event) => {
      console.log('[WebRTC] Remote data channel received');
      this.setupDataChannel(event.channel);
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', this.pc.iceConnectionState);
      if (this.pc.iceConnectionState === 'failed') {
        this.options.onError?.(
          new Error('Connection failed — unable to establish direct connection')
        );
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', this.pc.connectionState);
      if (this.pc.connectionState === 'failed') {
        this.options.onError?.(
          new Error('Connection failed — unable to establish direct connection')
        );
      }
    };
  }

  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      console.log('[WebRTC] DataChannel open');
      this.options.onDataChannelOpen?.();
    };

    channel.onclose = () => {
      console.log('[WebRTC] DataChannel closed');
      this.options.onDataChannelClose?.();
    };

    channel.onmessage = (event) => {
      this.options.onDataChannelMessage?.(event.data);
    };

    channel.onerror = (event) => {
      console.error('[WebRTC] DataChannel error:', event);
      this.options.onError?.(new Error('DataChannel error'));
    };
  }

  private async flushPendingCandidates(): Promise<void> {
    const candidates = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of candidates) {
      try {
        await this.pc.addIceCandidate(candidate);
      } catch (e) {
        console.warn('[WebRTC] Failed to add buffered ICE candidate:', e);
      }
    }
  }

  async createOffer(): Promise<void> {
    const channel = this.pc.createDataChannel('fileTransfer', {
      ordered: true,
    });
    this.setupDataChannel(channel);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    console.log('[WebRTC] Offer created and set as local description');
    await this.sendSignal('offer', JSON.stringify(offer));
  }

  async handleOffer(offerSdp: string): Promise<void> {
    const offer = JSON.parse(offerSdp) as RTCSessionDescriptionInit;
    await this.pc.setRemoteDescription(offer);
    this.remoteDescriptionSet = true;
    console.log('[WebRTC] Remote offer set, flushing pending candidates');
    await this.flushPendingCandidates();

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    console.log('[WebRTC] Answer created and set as local description');
    await this.sendSignal('answer', JSON.stringify(answer));
  }

  async handleAnswer(answerSdp: string): Promise<void> {
    const answer = JSON.parse(answerSdp) as RTCSessionDescriptionInit;
    await this.pc.setRemoteDescription(answer);
    this.remoteDescriptionSet = true;
    console.log('[WebRTC] Remote answer set, flushing pending candidates');
    await this.flushPendingCandidates();
  }

  async addIceCandidate(candidateJson: string): Promise<void> {
    const candidate = JSON.parse(candidateJson) as RTCIceCandidateInit;
    if (!this.remoteDescriptionSet) {
      console.log('[WebRTC] Buffering ICE candidate (remote description not set yet)');
      this.pendingCandidates.push(candidate);
      return;
    }
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
