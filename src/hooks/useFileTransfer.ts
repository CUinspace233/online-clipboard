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
  const filesToSendRef = useRef<File[]>([]);
  const receiverRef = useRef<FileReceiver | null>(null);
  const onlineDevicesRef = useRef(onlineDevices);
  onlineDevicesRef.current = onlineDevices;

  // Use a ref for sendSignal so createPeerConnection never goes stale
  const sendSignalRef = useRef<
    (toDeviceId: string, type: SignalingMessage['type'], payload: string) => Promise<void>
  >(async () => {});

  const createPeerConnection = useCallback(
    (targetDeviceId: string, isSender: boolean): PeerConnection => {
      const peer = new PeerConnection({
        sendSignal: async (type, payload) => {
          await sendSignalRef.current(targetDeviceId, type, payload);
        },
        onDataChannelOpen: () => {
          setState('transferring');
          if (isSender && filesToSendRef.current.length > 0) {
            const channel = peer.getDataChannel();
            if (!channel) {
              setState('error');
              setError('DataChannel not available');
              return;
            }
            const sender = new FileSender(channel);
            sender.onProgress = setProgress;
            sender
              .sendFiles(filesToSendRef.current)
              .then(() => {
                setState('complete');
                setFastPolling(false);
              })
              .catch(() => {
                setState('error');
                setError('Transfer failed');
                setFastPolling(false);
              });
          }
        },
        onDataChannelMessage: (data) => {
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
    []
  );

  const handleSignalingMessage = useCallback(
    async (msg: SignalingMessage) => {
      switch (msg.type) {
        case 'transfer-request': {
          const payload = JSON.parse(msg.payload);
          const device = onlineDevicesRef.current.find(
            (d) => d.device_id === msg.from_device_id
          );
          setIncomingRequest({
            fromDeviceId: msg.from_device_id,
            fromDeviceName: device?.device_name || 'Unknown Device',
            files: payload.files,
          });
          break;
        }

        case 'transfer-accept': {
          // Receiver accepted — we are the sender/offerer
          setState('connecting');
          setFastPolling(true);
          const peer = createPeerConnection(msg.from_device_id, true);
          peerRef.current = peer;
          try {
            await peer.createOffer();
          } catch (e) {
            console.error('Failed to create offer:', e);
            setState('error');
            setError('Failed to create connection offer');
          }
          break;
        }

        case 'transfer-reject': {
          setState('idle');
          setFastPolling(false);
          setError('Transfer was rejected');
          break;
        }

        case 'offer': {
          // We are the receiver/answerer
          setFastPolling(true);
          if (!peerRef.current) {
            peerRef.current = createPeerConnection(msg.from_device_id, false);
          }
          try {
            await peerRef.current.handleOffer(msg.payload);
          } catch (e) {
            console.error('Failed to handle offer:', e);
            setState('error');
            setError('Failed to handle connection offer');
          }
          break;
        }

        case 'answer': {
          if (!peerRef.current) {
            console.error('Received answer but no peer connection exists');
            return;
          }
          try {
            await peerRef.current.handleAnswer(msg.payload);
          } catch (e) {
            console.error('Failed to handle answer:', e);
            setState('error');
            setError('Failed to handle connection answer');
          }
          break;
        }

        case 'ice-candidate': {
          if (!peerRef.current) {
            console.warn('Received ICE candidate but no peer connection exists');
            return;
          }
          try {
            await peerRef.current.addIceCandidate(msg.payload);
          } catch {
            console.warn('Failed to add ICE candidate (non-fatal)');
          }
          break;
        }
      }
    },
    [createPeerConnection]
  );

  const { sendSignal } = useSignaling({
    deviceId: myDeviceId,
    fastPolling,
    onMessage: handleSignalingMessage,
  });

  // Keep sendSignalRef in sync so PeerConnection always uses the latest
  sendSignalRef.current = sendSignal;

  const sendFiles = useCallback(
    async (targetDeviceId: string, files: File[]) => {
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > 300 * 1024 * 1024) {
        setError('Total file size exceeds 300MB limit');
        setState('error');
        return;
      }

      setState('requesting');
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

    // Create peer as answerer first, so it's ready when the offer arrives
    peerRef.current = createPeerConnection(incomingRequest.fromDeviceId, false);

    await sendSignal(incomingRequest.fromDeviceId, 'transfer-accept', '{}');
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
