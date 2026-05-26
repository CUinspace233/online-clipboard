'use client';

import type { TransferProgress as TransferProgressType } from '@/lib/webrtc/FileTransfer';

interface TransferProgressProps {
  progress: TransferProgressType | null;
  state: 'transferring' | 'complete' | 'paused' | 'error';
  error?: string;
  canResume?: boolean;
  onCancel?: () => void;
  onReset?: () => void;
  onResume?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function TransferProgress({
  progress,
  state,
  error,
  canResume,
  onCancel,
  onReset,
  onResume,
}: TransferProgressProps) {
  const percent = progress
    ? Math.round((progress.bytesTransferred / progress.totalBytes) * 100)
    : 0;

  const title =
    state === 'complete'
      ? 'Transfer Complete'
      : state === 'error'
        ? 'Transfer Failed'
        : state === 'paused'
          ? 'Transfer Paused'
          : progress?.fileName || 'Preparing...';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{title}</span>
        {progress && progress.totalFiles > 1 && (
          <span className="text-xs text-gray-500">
            File {progress.filesCompleted + 1}/{progress.totalFiles}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            state === 'complete'
              ? 'bg-green-500'
              : state === 'error'
                ? 'bg-red-500'
                : state === 'paused'
                  ? 'bg-yellow-500'
                  : 'bg-blue-500'
          }`}
          style={{ width: `${state === 'complete' ? 100 : percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        {state === 'error' || state === 'paused' ? (
          <span className={state === 'error' ? 'text-red-600' : 'text-yellow-700'}>
            {error || (state === 'paused' ? 'Connection lost' : 'An error occurred')}
          </span>
        ) : progress ? (
          <>
            <span>
              {formatBytes(progress.bytesTransferred)} / {formatBytes(progress.totalBytes)}
            </span>
            {state === 'transferring' && <span>{formatSpeed(progress.speed)}</span>}
          </>
        ) : (
          <span>Waiting...</span>
        )}
      </div>

      <div className="flex justify-end mt-3 gap-2">
        {state === 'transferring' && onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-1 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}
        {state === 'paused' && canResume && onResume && (
          <button
            onClick={onResume}
            className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
          >
            Resume
          </button>
        )}
        {state === 'paused' && onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-1 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}
        {(state === 'complete' || state === 'error') && onReset && (
          <button
            onClick={onReset}
            className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
