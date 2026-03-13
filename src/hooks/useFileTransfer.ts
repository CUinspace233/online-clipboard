'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDevicePresence } from './useDevicePresence';
import { useSignaling } from './useSignaling';
import { PeerConnection } from '@/lib/webrtc/PeerConnection';
import { FileSender, FileReceiver } from '@/lib/webrtc/FileTransfer';
import type { TransferProgress, ReceivedFile } from '@/lib/webrtc/FileTransfer';
import type { SignalingMessage, TransferFileInfo } from '@/types/transfer';

export type TransferState =
  | 'idle'
  | 'requesting'
  | 'connecting'
  | 'transferring'
  | 'complete'
  | 'error';

interface IncomingRequest {
  fromDeviceId: string;
  fromDeviceName: string;
  files: TransferFileInfo[];
}

export function useFileTransfer() {
  const { onlineDevices, myDeviceId, isActive } = useDevicePresence();
  const [state, setState] = useState<TransferState>('idle');
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [error, setError] = useState<string>('');
  const [fastPolling, setFastPolling] = useState(false);

  const peerRef = useRef<PeerConnection | null>(null);
  const targetDeviceRef = useRef<string>('');
  const filesToSendRef = useRef<File[]>([]);

  const handleSignalingMessage = useCallback(
    async (msg: SignalingMessage) => {
      switch (msg.type) {
        case 'transfer-request': {
          const payload = JSON.parse(msg.payload);
          const device = onlineDevices.find((d) => d.device_id === msg.from_device_id);
          setIncomingRequest({
            fromDeviceId: msg.from_device_id,
            fromDeviceName: device?.device_name || 'Unknown Device',
            files: payload.files,
          });
          break;
        }

        case 'transfer-accept': {
          // Receiver accepted, start WebRTC connection as offerer
          setState('connecting');
          setFastPolling(true);
          const peer = createPeerConnection(msg.from_device_id, true);
          peerRef.current = peer;
          try {
            await peer.createOffer();
          } catch {
            setState('error');
            setError('Failed to create connection offer');
          }
          break;
        }

        case 'transfer-reject': {
          setState('idle');
          setError('Transfer was rejected');
          break;
        }

        case 'offer': {
          // Handle WebRTC offer (we are the receiver/answerer)
          setFastPolling(true);
          if (!peerRef.current) {
            peerRef.current = createPeerConnection(msg.from_device_id, false);
          }
          try {
            await peerRef.current.handleOffer(msg.payload);
          } catch {
            setState('error');
            setError('Failed to handle connection offer');
          }
          break;
        }

        case 'answer': {
          try {
            await peerRef.current?.handleAnswer(msg.payload);
          } catch {
            setState('error');
            setError('Failed to handle connection answer');
          }
          break;
        }

        case 'ice-candidate': {
          try {
            await peerRef.current?.addIceCandidate(msg.payload);
          } catch {
            // ICE candidate errors are often non-fatal
            console.warn('Failed to add ICE candidate');
          }
          break;
        }
      }
    },
    [onlineDevices]
  );

  const { sendSignal } = useSignaling({
    deviceId: myDeviceId,
    fastPolling,
    onMessage: handleSignalingMessage,
  });

  const createPeerConnection = useCallback(
    (targetDeviceId: string, isSender: boolean): PeerConnection => {
      const peer = new PeerConnection({
        sendSignal: async (type, payload) => {
          await sendSignal(targetDeviceId, type, payload);
        },
        onDataChannelOpen: () => {
          setState('transferring');
          if (isSender && filesToSendRef.current.length > 0) {
            const sender = new FileSender(peer.getDataChannel()!);
            sender.onProgress = setProgress;
            sender.sendFiles(filesToSendRef.current).then(() => {
              setState('complete');
              setFastPolling(false);
            }).catch(() => {
              setState('error');
              setError('Transfer failed');
              setFastPolling(false);
            });
          } else if (!isSender) {
            const receiver = new FileReceiver();
            receiver.onProgress = setProgress;
            receiver.onFileReceived = (file) => {
              setReceivedFiles((prev) => [...prev, file]);
            };
            receiver.onTransferComplete = () => {
              setState('complete');
              setFastPolling(false);
            };
            peer.getDataChannel(); // DataChannel is set via ondatachannel event
            // Re-wire the message handler since the datachannel comes from the remote
          }
        },
        onDataChannelMessage: (data) => {
          // This handles messages for the receiver side
          if (!isSender) {
            if (!receiverRef.current) {
              receiverRef.current = new FileReceiver();
              receiverRef.current.onProgress = setProgress;
              receiverRef.current.onFileReceived = (file) => {
                setReceivedFiles((prev) => [...prev, file]);
              };
              receiverRef.current.onTransferComplete = () => {
                setState('complete');
                setFastPolling(false);
              };
            }
            receiverRef.current.handleMessage(data);
          }
        },
        onDataChannelClose: () => {
          if (state === 'transferring') {
            setState('error');
            setError('Connection closed during transfer');
          }
          setFastPolling(false);
        },
        onError: (err) => {
          setState('error');
          setError(err.message || 'Connection failed. This may be due to network restrictions.');
          setFastPolling(false);
        },
      });

      return peer;
    },
    [sendSignal, state]
  );

  const receiverRef = useRef<FileReceiver | null>(null);

  const sendFiles = useCallback(
    async (targetDeviceId: string, files: File[]) => {
      // Validate total size
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > 300 * 1024 * 1024) {
        setError('Total file size exceeds 300MB limit');
        setState('error');
        return;
      }

      setState('requesting');
      targetDeviceRef.current = targetDeviceId;
      filesToSendRef.current = files;
      setFastPolling(true);

      const fileInfos: TransferFileInfo[] = files.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type || 'application/octet-stream',
      }));

      await sendSignal(targetDeviceId, 'transfer-request', JSON.stringify({ files: fileInfos }));
    },
    [sendSignal]
  );

  const acceptTransfer = useCallback(async () => {
    if (!incomingRequest) return;

    setState('connecting');
    setFastPolling(true);

    await sendSignal(incomingRequest.fromDeviceId, 'transfer-accept', '{}');

    // Create peer as answerer - will handle offer when it arrives
    peerRef.current = createPeerConnection(incomingRequest.fromDeviceId, false);
    setIncomingRequest(null);
  }, [incomingRequest, sendSignal, createPeerConnection]);

  const rejectTransfer = useCallback(async () => {
    if (!incomingRequest) return;

    await sendSignal(incomingRequest.fromDeviceId, 'transfer-reject', '{}');
    setIncomingRequest(null);
  }, [incomingRequest, sendSignal]);

  const cancelTransfer = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    receiverRef.current = null;
    setState('idle');
    setProgress(null);
    setError('');
    setFastPolling(false);
  }, []);

  const resetTransfer = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    receiverRef.current = null;
    setState('idle');
    setProgress(null);
    setError('');
    setReceivedFiles([]);
    setFastPolling(false);
  }, []);

  // Warn before closing during transfer
  useEffect(() => {
    if (state !== 'transferring') return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state]);

  return {
    state,
    progress,
    incomingRequest,
    receivedFiles,
    error,
    onlineDevices,
    myDeviceId,
    isActive,
    sendFiles,
    acceptTransfer,
    rejectTransfer,
    cancelTransfer,
    resetTransfer,
  };
}
