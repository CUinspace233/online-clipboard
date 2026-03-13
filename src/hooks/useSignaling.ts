'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { SignalingMessage } from '@/types/transfer';

interface UseSignalingOptions {
  deviceId: string;
  fastPolling?: boolean;
  onMessage?: (message: SignalingMessage) => void | Promise<void>;
}

export function useSignaling({ deviceId, fastPolling = false, onMessage }: UseSignalingOptions) {
  const { token } = useAuth();
  const lastIdRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const pollingRef = useRef(false);
  // Use ref so the polling loop picks up changes immediately without re-render
  const fastPollingRef = useRef(fastPolling);
  fastPollingRef.current = fastPolling;

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

        // Must await — handlers are async (e.g. handleOffer/handleAnswer)
        // and subsequent messages (ice-candidates) depend on prior ones completing
        await onMessageRef.current?.(msg);
      }
    } catch {
      // silent
    } finally {
      pollingRef.current = false;
    }
  }, [token, deviceId]);

  useEffect(() => {
    if (!deviceId || !token) return;

    let stopped = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const loop = async () => {
      if (stopped) return;
      await pollMessages();
      if (stopped) return;
      const delay = fastPollingRef.current ? 500 : 3000;
      timeoutId = setTimeout(loop, delay);
    };

    // Start immediately
    loop();

    return () => {
      stopped = true;
      clearTimeout(timeoutId);
    };
    // Only restart loop when token/deviceId change, NOT on fastPolling change
    // fastPolling is read via ref inside the loop
  }, [deviceId, token, pollMessages]);

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
