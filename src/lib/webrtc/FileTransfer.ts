const CHUNK_SIZE = 16 * 1024; // 16KB
const ACK_INTERVAL = 64 * 1024; // 64KB

interface FileStartMessage {
  type: 'file-start';
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
  startOffset?: number;
}

interface FileEndMessage {
  type: 'file-end';
  name: string;
}

interface TransferCompleteMessage {
  type: 'transfer-complete';
}

interface ChunkAckMessage {
  type: 'chunk-ack';
  name: string;
  bytesReceived: number;
}

type ControlMessage =
  | FileStartMessage
  | FileEndMessage
  | TransferCompleteMessage
  | ChunkAckMessage;

export interface TransferProgress {
  fileName: string;
  bytesTransferred: number;
  totalBytes: number;
  filesCompleted: number;
  totalFiles: number;
  speed: number; // bytes per second
}

export interface ReceivedFile {
  name: string;
  size: number;
  blob: Blob;
  mimeType: string;
}

export interface ResumeOptions {
  startFileIndex: number;
  offsets: number[];
}

export class FileSender {
  private channel: RTCDataChannel;
  private ackedBytes = new Map<string, number>();
  onProgress?: (progress: TransferProgress) => void;

  constructor(channel: RTCDataChannel) {
    this.channel = channel;
  }

  handleAck(msg: ChunkAckMessage) {
    const current = this.ackedBytes.get(msg.name) ?? 0;
    if (msg.bytesReceived > current) {
      this.ackedBytes.set(msg.name, msg.bytesReceived);
    }
  }

  getAckOffsets(files: File[]): number[] {
    return files.map(file => this.ackedBytes.get(file.name) ?? 0);
  }

  findStartFileIndex(files: File[], offsets: number[]): number {
    for (let i = 0; i < files.length; i++) {
      if ((offsets[i] ?? 0) < files[i].size) return i;
    }
    return files.length;
  }

  async sendFiles(files: File[], resume?: ResumeOptions): Promise<void> {
    const offsets = resume?.offsets ?? files.map(() => 0);
    const startIdx = resume?.startFileIndex ?? 0;

    for (let i = startIdx; i < files.length; i++) {
      const offset = offsets[i] ?? 0;
      if (offset >= files[i].size) continue;
      await this.sendFile(files[i], i, files.length, offset);
    }

    this.sendControl({ type: 'transfer-complete' });
  }

  private sendControl(msg: ControlMessage) {
    this.channel.send(JSON.stringify(msg));
  }

  private async sendFile(
    file: File,
    fileIndex: number,
    totalFiles: number,
    startOffset = 0
  ): Promise<void> {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    this.sendControl({
      type: 'file-start',
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks,
      ...(startOffset > 0 ? { startOffset } : {}),
    });

    const buffer = await file.arrayBuffer();
    let offset = startOffset;
    const startTime = Date.now();

    for (let i = Math.floor(startOffset / CHUNK_SIZE); i < totalChunks; i++) {
      const end = Math.min(offset + CHUNK_SIZE, buffer.byteLength);
      const chunk = buffer.slice(offset, end);

      if (this.channel.readyState !== 'open') {
        throw new Error('DataChannel closed');
      }

      // Backpressure: wait if buffered amount is too high
      if (this.channel.bufferedAmount > 1024 * 1024) {
        await this.waitForBufferDrain();
      }

      this.channel.send(chunk);
      offset = end;

      const elapsed = (Date.now() - startTime) / 1000;
      const speed = elapsed > 0 ? (offset - startOffset) / elapsed : 0;

      this.onProgress?.({
        fileName: file.name,
        bytesTransferred: offset,
        totalBytes: file.size,
        filesCompleted: fileIndex,
        totalFiles,
        speed,
      });
    }

    this.sendControl({ type: 'file-end', name: file.name });
    this.ackedBytes.set(file.name, file.size);
  }

  private waitForBufferDrain(): Promise<void> {
    return new Promise((resolve, reject) => {
      const check = () => {
        if (this.channel.readyState !== 'open') {
          reject(new Error('DataChannel closed'));
          return;
        }
        if (this.channel.bufferedAmount < 256 * 1024) {
          resolve();
        } else {
          this.channel.onbufferedamountlow = () => {
            this.channel.onbufferedamountlow = null;
            resolve();
          };
          this.channel.bufferedAmountLowThreshold = 256 * 1024;
        }
      };
      check();
    });
  }
}

export class FileReceiver {
  private chunks: ArrayBuffer[] = [];
  private currentFile: FileStartMessage | null = null;
  private bytesReceived = 0;
  private startTime = 0;
  private filesCompleted = 0;
  private totalFiles = 0;
  private lastAckAt = 0;
  private sendAck: ((msg: ChunkAckMessage) => void) | null = null;

  onProgress?: (progress: TransferProgress) => void;
  onFileReceived?: (file: ReceivedFile) => void;
  onTransferComplete?: () => void;

  setSendAck(fn: (msg: ChunkAckMessage) => void) {
    this.sendAck = fn;
  }

  getResumeOffsets(
    fileInfos: { name: string; size: number }[]
  ): number[] {
    return fileInfos.map((info, i) => {
      if (i < this.filesCompleted) return info.size;
      if (
        i === this.filesCompleted &&
        this.currentFile?.name === info.name &&
        this.bytesReceived > 0
      ) {
        return this.bytesReceived;
      }
      return 0;
    });
  }

  handleMessage(data: ArrayBuffer | string) {
    if (typeof data === 'string') {
      const msg = JSON.parse(data) as ControlMessage;
      this.handleControl(msg);
    } else {
      this.handleChunk(data);
    }
  }

  private handleControl(msg: ControlMessage) {
    switch (msg.type) {
      case 'file-start':
        this.handleFileStart(msg);
        break;

      case 'file-end':
        if (this.currentFile) {
          const blob = new Blob(this.chunks, { type: this.currentFile.mimeType });
          this.onFileReceived?.({
            name: this.currentFile.name,
            size: this.currentFile.size,
            blob,
            mimeType: this.currentFile.mimeType,
          });
          this.filesCompleted++;
          this.currentFile = null;
          this.chunks = [];
          this.bytesReceived = 0;
          this.lastAckAt = 0;
        }
        break;

      case 'transfer-complete':
        this.onTransferComplete?.();
        break;
    }
  }

  private handleFileStart(msg: FileStartMessage) {
    const isResume =
      msg.startOffset !== undefined &&
      msg.startOffset > 0 &&
      this.currentFile?.name === msg.name &&
      this.bytesReceived === msg.startOffset;

    if (!isResume) {
      this.chunks = [];
      this.bytesReceived = 0;
      this.lastAckAt = 0;
    }

    this.currentFile = msg;
    this.startTime = Date.now();
    this.totalFiles = this.totalFiles || msg.totalChunks;
  }

  private handleChunk(data: ArrayBuffer) {
    if (!this.currentFile) return;

    this.chunks.push(data);
    this.bytesReceived += data.byteLength;

    if (this.bytesReceived - this.lastAckAt >= ACK_INTERVAL) {
      this.lastAckAt = this.bytesReceived;
      this.sendAck?.({
        type: 'chunk-ack',
        name: this.currentFile.name,
        bytesReceived: this.bytesReceived,
      });
    }

    const elapsed = (Date.now() - this.startTime) / 1000;
    const speed = elapsed > 0 ? this.bytesReceived / elapsed : 0;

    this.onProgress?.({
      fileName: this.currentFile.name,
      bytesTransferred: this.bytesReceived,
      totalBytes: this.currentFile.size,
      filesCompleted: this.filesCompleted,
      totalFiles: this.totalFiles,
      speed,
    });
  }
}
