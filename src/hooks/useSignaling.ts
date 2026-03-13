'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { SignalingMessage } from '@/types/transfer';

interface UseSignalingOptions {
  deviceId: string;
  fastPolling?: boolean;
  onMessage?: (message: SignalingMessage) => void;
}

export function useSignaling({ deviceId, fastPolling = false, onMessage }: UseSignalingOptions) {
  const { token } = useAuth();
  const lastIdRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const pollingRef = useRef(false);

  const pollMessages = useCallback(async () => {
    if (!token || !deviceId || pollingRef.current) return;
    pollingRef.current = true;
    try {
      const afterParam = lastIdRef.current ? `&after=${lastIdRef.current}` : '';
      const url = `/api/transfer/signal?device_id=${deviceId}${afterParam}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const messages: SignalingMessage[] = await res.json();
      if (messages.length === 0) return;

      const maxId = Math.max(...messages.map((m) => m.id));
      lastIdRef.current = maxId;

      for (const msg of messages) {
        fetch(`/api/transfer/signal/${msg.id}/consume`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(console.error);

        onMessageRef.current?.(msg);
      }
    } catch {
      // silent
    } finally {
      pollingRef.current = false;
    }
  }, [token, deviceId]);

  useEffect(() => {
    if (!deviceId || !token) return;

    // Poll immediately once
    pollMessages();

    const interval = fastPolling ? 500 : 3000;
    const id = setInterval(pollMessages, interval);

    return () => {
      clearInterval(id);
    };
  }, [deviceId, token, fastPolling, pollMessages]);

  const sendSignal = useCallback(
    async (toDeviceId: string, type: SignalingMessage['type'], payload: string) => {
      if (!token) return;
      await fetch('/api/transfer/signal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          from_device_id: deviceId,
          to_device_id: toDeviceId,
          type,
          payload,
        }),
      });
    },
    [token, deviceId]
  );

  return { sendSignal };
}
