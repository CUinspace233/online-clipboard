'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { SignalingMessage } from '@/types/transfer';

interface UseSignalingOptions {
  deviceId: string;
  fastPolling?: boolean;
  onMessage?: (message: SignalingMessage) => void;
}

export function useSignaling({ deviceId, fastPolling = false, onMessage }: UseSignalingOptions) {
  const { token } = useAuth();
  const [lastId, setLastId] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const pollMessages = useCallback(async () => {
    if (!token || !deviceId) return;
    try {
      const url = `/api/transfer/signal?device_id=${deviceId}${lastId ? `&after=${lastId}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const messages: SignalingMessage[] = await res.json();
      if (messages.length === 0) return;

      // Update lastId
      const maxId = Math.max(...messages.map((m) => m.id));
      setLastId(maxId);

      // Consume and process each message
      for (const msg of messages) {
        // Consume in background
        fetch(`/api/transfer/signal/${msg.id}/consume`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(console.error);

        onMessageRef.current?.(msg);
      }
    } catch {
      // silent
    }
  }, [token, deviceId, lastId]);

  useEffect(() => {
    if (!deviceId || !token) return;

    const interval = fastPolling ? 500 : 3000;
    pollRef.current = setInterval(pollMessages, interval);

    return () => {
      clearInterval(pollRef.current);
    };
  }, [deviceId, token, fastPolling, pollMessages]);

  const sendSignal = useCallback(
    async (
      toDeviceId: string,
      type: SignalingMessage['type'],
      payload: string
    ) => {
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
