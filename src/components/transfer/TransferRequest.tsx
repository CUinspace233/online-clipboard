'use client';

import type { TransferFileInfo } from '@/types/transfer';

interface TransferRequestProps {
  fromDeviceName: string;
  files: TransferFileInfo[];
  onAccept: () => void;
  onReject: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function TransferRequest({ fromDeviceName, files, onAccept, onReject }: TransferRequestProps) {
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Incoming File Transfer</h3>
        <p className="text-sm text-gray-500 mb-4">
          From <span className="font-medium text-gray-700">{fromDeviceName}</span>
        </p>

        <div className="bg-gray-50 rounded-lg p-3 mb-4 max-h-48 overflow-y-auto">
          {files.map((file, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-gray-700 truncate mr-2">{file.name}</span>
              <span className="text-gray-400 text-xs whitespace-nowrap">
                {formatBytes(file.size)}
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mb-4">
          {files.length} file{files.length > 1 ? 's' : ''} &middot; {formatBytes(totalSize)} total
        </p>

        <div className="flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
