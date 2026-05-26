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
  | 'paused'
  | 'error';

interface IncomingRequest {
  sessionId: string;
  fromDeviceId: string;
  fromDeviceName: string;
  files: TransferFileInfo[];
}

interface TransferSession {
  sessionId: string;
  remoteDeviceId: string;
  role: 'sender' | 'receiver';
  fileInfos: TransferFileInfo[];
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
  const senderRef = useRef<FileSender | null>(null);
  const receiverRef = useRef<FileReceiver | null>(null);
  const pendingIceCandidatesRef = useRef<string[]>([]);
  const resumeOffsetsRef = useRef<number[]>([]);
  const lastAckOffsetsRef = useRef<number[]>([]);
  const sessionRef = useRef<TransferSession | null>(null);
  const stateRef = useRef<TransferState>('idle');
  const onlineDevicesRef = useRef(onlineDevices);
  onlineDevicesRef.current = onlineDevices;
  stateRef.current = state;

  const sendSignalRef = useRef<
    (toDeviceId: string, type: SignalingMessage['type'], payload: string) => Promise<void>
  >(async () => {});

  const canResume = state === 'paused';

  const handleDisconnect = useCallback((message: string) => {
    if (senderRef.current && filesToSendRef.current.length > 0) {
      lastAckOffsetsRef.current = senderRef.current.getAckOffsets(filesToSendRef.current);
    } else if (receiverRef.current && sessionRef.current) {
      lastAckOffsetsRef.current = receiverRef.current.getResumeOffsets(sessionRef.current.fileInfos);
    }

    peerRef.current?.close();
    peerRef.current = null;
    senderRef.current = null;
    setFastPolling(false);

    if (sessionRef.current && stateRef.current === 'transferring') {
      setState('paused');
      setError(message);
    } else {
      setState('error');
      setError(message);
    }
  }, []);

  const startSending = useCallback((peer: PeerConnection, isResume: boolean) => {
    const channel = peer.getDataChannel();
    if (!channel) {
      setState('error');
      setError('DataChannel not available');
      return;
    }

    const files = filesToSendRef.current;
    const sender = new FileSender(channel);
    senderRef.current = sender;
    sender.onProgress = setProgress;

    const offsets = resumeOffsetsRef.current;
    const resume =
      isResume && offsets.length > 0
        ? {
            startFileIndex: sender.findStartFileIndex(files, offsets),
            offsets,
          }
        : undefined;

    sender
      .sendFiles(files, resume)
      .then(() => {
        setState('complete');
        setFastPolling(false);
        sessionRef.current = null;
        resumeOffsetsRef.current = [];
        lastAckOffsetsRef.current = [];
      })
      .catch(() => {
        handleDisconnect('Transfer failed');
      });
  }, [handleDisconnect]);

  const ensureReceiver = useCallback((channel: RTCDataChannel) => {
    if (!receiverRef.current) {
      receiverRef.current = new FileReceiver();
      receiverRef.current.onProgress = setProgress;
      receiverRef.current.onFileReceived = file => {
        setReceivedFiles(prev => [...prev, file]);
      };
      receiverRef.current.onTransferComplete = () => {
        setState('complete');
        setFastPolling(false);
        sessionRef.current = null;
        resumeOffsetsRef.current = [];
        lastAckOffsetsRef.current = [];
      };
    }
    receiverRef.current.setSendAck(msg => {
      if (channel.readyState === 'open') {
        channel.send(JSON.stringify(msg));
      }
    });
    return receiverRef.current;
  }, []);

  const createPeerConnection = useCallback(
    (targetDeviceId: string, isSender: boolean): PeerConnection => {
      const isResume = resumeOffsetsRef.current.length > 0;

      const peer = new PeerConnection({
        sendSignal: async (type, payload) => {
          await sendSignalRef.current(targetDeviceId, type, payload);
        },
        onDataChannelOpen: () => {
          setState('transferring');
          if (isSender && filesToSendRef.current.length > 0) {
            startSending(peer, isResume);
          }
        },
        onDataChannelMessage: data => {
          if (isSender) {
            if (typeof data === 'string') {
              try {
                const msg = JSON.parse(data);
                if (msg.type === 'chunk-ack') {
                  senderRef.current?.handleAck(msg);
                }
              } catch {
                // ignore non-JSON control messages
              }
            }
            return;
          }

          const channel = peer.getDataChannel();
          if (!channel) return;
          const receiver = ensureReceiver(channel);
          receiver.handleMessage(data);
        },
        onDataChannelClose: () => {
          if (stateRef.current === 'transferring') {
            handleDisconnect('Connection lost');
          } else {
            setFastPolling(false);
          }
        },
        onError: err => {
          if (stateRef.current === 'transferring' || stateRef.current === 'connecting') {
            handleDisconnect(err.message || 'Connection failed. This may be due to network restrictions.');
          } else {
            setState('error');
            setError(err.message || 'Connection failed. This may be due to network restrictions.');
            setFastPolling(false);
          }
        },
      });

      return peer;
    },
    [startSending, ensureReceiver, handleDisconnect]
  );

  const handleSignalingMessage = useCallback(
    async (msg: SignalingMessage) => {
      switch (msg.type) {
        case 'transfer-request': {
          const payload = JSON.parse(msg.payload);
          const device = onlineDevicesRef.current.find(d => d.device_id === msg.from_device_id);
          setIncomingRequest({
            sessionId: payload.sessionId,
            fromDeviceId: msg.from_device_id,
            fromDeviceName: device?.device_name || 'Unknown Device',
            files: payload.files,
          });
          break;
        }

        case 'transfer-accept': {
          setState('connecting');
          setFastPolling(true);
          resumeOffsetsRef.current = [];
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
          sessionRef.current = null;
          setError('Transfer was rejected');
          break;
        }

        case 'transfer-resume-request': {
          const payload = JSON.parse(msg.payload);
          const isSender = filesToSendRef.current.length > 0;

          sessionRef.current = {
            sessionId: payload.sessionId,
            remoteDeviceId: msg.from_device_id,
            role: isSender ? 'sender' : 'receiver',
            fileInfos: payload.files,
          };

          setState('connecting');
          setFastPolling(true);

          if (isSender) {
            // Receiver initiated resume — trust receiver's received offsets
            resumeOffsetsRef.current = payload.offsets;
            peerRef.current = createPeerConnection(msg.from_device_id, true);
            await sendSignalRef.current(
              msg.from_device_id,
              'transfer-resume-accept',
              JSON.stringify({ sessionId: payload.sessionId, offsets: payload.offsets })
            );
            try {
              await peerRef.current.createOffer();
            } catch (e) {
              console.error('Failed to create offer:', e);
              handleDisconnect('Failed to create connection offer');
            }
          } else {
            // Sender initiated resume — use our received offsets as source of truth
            const offsets =
              receiverRef.current?.getResumeOffsets(payload.files) ??
              payload.files.map(() => 0);
            resumeOffsetsRef.current = offsets;
            peerRef.current = createPeerConnection(msg.from_device_id, false);
            await sendSignalRef.current(
              msg.from_device_id,
              'transfer-resume-accept',
              JSON.stringify({ sessionId: payload.sessionId, offsets })
            );
          }
          break;
        }

        case 'transfer-resume-accept': {
          const payload = JSON.parse(msg.payload);
          resumeOffsetsRef.current = payload.offsets;

          setState('connecting');
          setFastPolling(true);

          if (sessionRef.current?.role === 'receiver' && filesToSendRef.current.length === 0) {
            // We initiated resume — wait for sender's offer
            if (!peerRef.current) {
              peerRef.current = createPeerConnection(msg.from_device_id, false);
            }
          } else {
            const peer = createPeerConnection(msg.from_device_id, true);
            peerRef.current = peer;
            try {
              await peer.createOffer();
            } catch (e) {
              console.error('Failed to create offer:', e);
              handleDisconnect('Failed to create connection offer');
            }
          }
          break;
        }

        case 'offer': {
          setFastPolling(true);
          if (!peerRef.current) {
            peerRef.current = createPeerConnection(msg.from_device_id, false);
          }
          try {
            await peerRef.current.handleOffer(msg.payload);
            const pending = pendingIceCandidatesRef.current;
            pendingIceCandidatesRef.current = [];
            for (const c of pending) {
              try {
                await peerRef.current.addIceCandidate(c);
              } catch {
                console.warn('Failed to add buffered ICE candidate');
              }
            }
          } catch (e) {
            console.error('Failed to handle offer:', e);
            handleDisconnect('Failed to handle connection offer');
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
            const pending = pendingIceCandidatesRef.current;
            pendingIceCandidatesRef.current = [];
            for (const c of pending) {
              try {
                await peerRef.current.addIceCandidate(c);
              } catch {
                console.warn('Failed to add buffered ICE candidate');
              }
            }
          } catch (e) {
            console.error('Failed to handle answer:', e);
            handleDisconnect('Failed to handle connection answer');
          }
          break;
        }

        case 'ice-candidate': {
          if (!peerRef.current) {
            console.log('[Signal] Buffering ICE candidate (peer not ready)');
            pendingIceCandidatesRef.current.push(msg.payload);
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
    [createPeerConnection, handleDisconnect]
  );

  const { sendSignal } = useSignaling({
    deviceId: myDeviceId,
    fastPolling,
    onMessage: handleSignalingMessage,
  });

  sendSignalRef.current = sendSignal;

  const sendFiles = useCallback(
    async (targetDeviceId: string, files: File[]) => {
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > 300 * 1024 * 1024) {
        setError('Total file size exceeds 300MB limit');
        setState('error');
        return;
      }

      const sessionId = crypto.randomUUID();
      const fileInfos: TransferFileInfo[] = files.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type || 'application/octet-stream',
      }));

      sessionRef.current = {
        sessionId,
        remoteDeviceId: targetDeviceId,
        role: 'sender',
        fileInfos,
      };

      setState('requesting');
      filesToSendRef.current = files;
      resumeOffsetsRef.current = [];
      lastAckOffsetsRef.current = [];
      setFastPolling(true);

      await sendSignal(
        targetDeviceId,
        'transfer-request',
        JSON.stringify({ sessionId, files: fileInfos })
      );
    },
    [sendSignal]
  );

  const acceptTransfer = useCallback(async () => {
    if (!incomingRequest) return;

    sessionRef.current = {
      sessionId: incomingRequest.sessionId,
      remoteDeviceId: incomingRequest.fromDeviceId,
      role: 'receiver',
      fileInfos: incomingRequest.files,
    };

    setState('connecting');
    setFastPolling(true);
    resumeOffsetsRef.current = [];

    peerRef.current = createPeerConnection(incomingRequest.fromDeviceId, false);

    await sendSignal(incomingRequest.fromDeviceId, 'transfer-accept', '{}');
    setIncomingRequest(null);
  }, [incomingRequest, sendSignal, createPeerConnection]);

  const rejectTransfer = useCallback(async () => {
    if (!incomingRequest) return;

    await sendSignal(incomingRequest.fromDeviceId, 'transfer-reject', '{}');
    setIncomingRequest(null);
  }, [incomingRequest, sendSignal]);

  const resumeTransfer = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;

    if (session.role === 'sender' && filesToSendRef.current.length === 0) {
      setState('error');
      setError('Cannot resume — original files are no longer available. Please re-select and send again.');
      sessionRef.current = null;
      return;
    }

    setState('requesting');
    setError('');
    setFastPolling(true);

    const proposedOffsets =
      session.role === 'receiver' && receiverRef.current
        ? receiverRef.current.getResumeOffsets(session.fileInfos)
        : lastAckOffsetsRef.current.length > 0
          ? lastAckOffsetsRef.current
          : session.fileInfos.map(() => 0);

    await sendSignal(
      session.remoteDeviceId,
      'transfer-resume-request',
      JSON.stringify({
        sessionId: session.sessionId,
        files: session.fileInfos,
        offsets: proposedOffsets,
      })
    );
  }, [sendSignal]);

  const cancelTransfer = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    senderRef.current = null;
    receiverRef.current = null;
    pendingIceCandidatesRef.current = [];
    resumeOffsetsRef.current = [];
    lastAckOffsetsRef.current = [];
    sessionRef.current = null;
    setState('idle');
    setProgress(null);
    setError('');
    setFastPolling(false);
  }, []);

  const resetTransfer = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    senderRef.current = null;
    receiverRef.current = null;
    pendingIceCandidatesRef.current = [];
    resumeOffsetsRef.current = [];
    lastAckOffsetsRef.current = [];
    sessionRef.current = null;
    setState('idle');
    setProgress(null);
    setError('');
    setReceivedFiles([]);
    setFastPolling(false);
  }, []);

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
    canResume,
    onlineDevices,
    myDeviceId,
    isActive,
    sendFiles,
    acceptTransfer,
    rejectTransfer,
    cancelTransfer,
    resetTransfer,
    resumeTransfer,
  };
}