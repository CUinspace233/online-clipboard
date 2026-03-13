'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { DevicePresence } from '@/types/transfer';

function getDeviceId(): string {
  let id = sessionStorage.getItem('device_id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('device_id', id);
  }
  return id;
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown Device';
}

export function useDevicePresence() {
  const { token, isAuthenticated } = useAuth();
  const [onlineDevices, setOnlineDevices] = useState<DevicePresence[]>([]);
  const [myDeviceId, setMyDeviceId] = useState<string>('');
  const [isActive, setIsActive] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const sendHeartbeat = useCallback(async () => {
    if (!token || !myDeviceId) return;
    try {
      const res = await fetch('/api/transfer/presence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          device_id: myDeviceId,
          device_name: getDeviceName(),
        }),
      });
      if (res.ok) setIsActive(true);
    } catch {
      // silent
    }
  }, [token, myDeviceId]);

  const fetchDevices = useCallback(async () => {
    if (!token || !myDeviceId) return;
    try {
      const res = await fetch(`/api/transfer/presence?device_id=${myDeviceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const devices: DevicePresence[] = await res.json();
        // Only update state if the device list actually changed, to avoid
        // unnecessary re-renders that can interrupt the file picker dialog
        setOnlineDevices((prev) => {
          const prevIds = prev.map((d) => d.device_id).sort().join(',');
          const newIds = devices.map((d) => d.device_id).sort().join(',');
          return prevIds === newIds ? prev : devices;
        });
      }
    } catch {
      // silent
    }
  }, [token, myDeviceId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setMyDeviceId(getDeviceId());
  }, [isAuthenticated]);

  useEffect(() => {
    if (!myDeviceId || !token) return;

    // Initial heartbeat and fetch
    sendHeartbeat();
    fetchDevices();

    // Heartbeat every 10 seconds
    heartbeatRef.current = setInterval(sendHeartbeat, 10_000);
    // Poll devices every 5 seconds
    pollRef.current = setInterval(fetchDevices, 5_000);

    // Cleanup on leave — sendBeacon can't set headers, so pass token in body
    const handleBeforeUnload = () => {
      const body = JSON.stringify({ device_id: myDeviceId, token });
      navigator.sendBeacon(
        '/api/transfer/presence/leave',
        new Blob([body], { type: 'application/json' })
      );
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeatRef.current);
      clearInterval(pollRef.current);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [myDeviceId, token, sendHeartbeat, fetchDevices]);

  return { onlineDevices, myDeviceId, isActive };
}
