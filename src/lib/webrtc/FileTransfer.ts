const CHUNK_SIZE = 16 * 1024; // 16KB

interface FileStartMessage {
  type: 'file-start';
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
}

interface FileEndMessage {
  type: 'file-end';
  name: string;
}

interface TransferCompleteMessage {
  type: 'transfer-complete';
}

type ControlMessage = FileStartMessage | FileEndMessage | TransferCompleteMessage;

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

export class FileSender {
  private channel: RTCDataChannel;
  onProgress?: (progress: TransferProgress) => void;

  constructor(channel: RTCDataChannel) {
    this.channel = channel;
  }

  async sendFiles(files: File[]): Promise<void> {
    for (let i = 0; i < files.length; i++) {
      await this.sendFile(files[i], i, files.length);
    }

    this.sendControl({ type: 'transfer-complete' });
  }

  private sendControl(msg: ControlMessage) {
    this.channel.send(JSON.stringify(msg));
  }

  private async sendFile(file: File, fileIndex: number, totalFiles: number): Promise<void> {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    this.sendControl({
      type: 'file-start',
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks,
    });

    const buffer = await file.arrayBuffer();
    let offset = 0;
    const startTime = Date.now();

    for (let i = 0; i < totalChunks; i++) {
      const end = Math.min(offset + CHUNK_SIZE, buffer.byteLength);
      const chunk = buffer.slice(offset, end);

      // Backpressure: wait if buffered amount is too high
      if (this.channel.bufferedAmount > 1024 * 1024) {
        await this.waitForBufferDrain();
      }

      this.channel.send(chunk);
      offset = end;

      const elapsed = (Date.now() - startTime) / 1000;
      const speed = elapsed > 0 ? offset / elapsed : 0;

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
  }

  private waitForBufferDrain(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
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

  onProgress?: (progress: TransferProgress) => void;
  onFileReceived?: (file: ReceivedFile) => void;
  onTransferComplete?: () => void;

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
        this.currentFile = msg;
        this.chunks = [];
        this.bytesReceived = 0;
        this.startTime = Date.now();
        this.totalFiles = this.totalFiles || msg.totalChunks; // will be set properly from sender
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
        }
        break;

      case 'transfer-complete':
        this.onTransferComplete?.();
        break;
    }
  }

  private handleChunk(data: ArrayBuffer) {
    if (!this.currentFile) return;

    this.chunks.push(data);
    this.bytesReceived += data.byteLength;

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
