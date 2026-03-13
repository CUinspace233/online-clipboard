'use client';

import { ComputerDesktopIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import type { DevicePresence } from '@/types/transfer';

interface DeviceListProps {
  devices: DevicePresence[];
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
}

function getDeviceIcon(name: string) {
  if (/iPhone|iPad|Android/.test(name)) {
    return <DevicePhoneMobileIcon className="w-5 h-5" />;
  }
  return <ComputerDesktopIcon className="w-5 h-5" />;
}

export function DeviceList({ devices, selectedDeviceId, onSelectDevice }: DeviceListProps) {
  if (devices.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
        <ComputerDesktopIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">No other devices online</p>
        <p className="text-gray-400 text-xs mt-1">
          Log in with the same account on another device
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Online Devices</h3>
      <div className="space-y-2">
        {devices.map((device) => (
          <button
            key={device.device_id}
            onClick={() => onSelectDevice(device.device_id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
              selectedDeviceId === device.device_id
                ? 'bg-blue-50 border border-blue-200 text-blue-700'
                : 'hover:bg-gray-50 border border-transparent text-gray-700'
            }`}
          >
            <span className="relative">
              {getDeviceIcon(device.device_name)}
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
            </span>
            <span className="text-sm font-medium">{device.device_name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
