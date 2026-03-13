'use client';

import { useState, useRef, useCallback } from 'react';
import { ArrowUpTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useFileTransfer } from '@/hooks/useFileTransfer';
import { DeviceList } from './DeviceList';
import { TransferProgress } from './TransferProgress';
import { TransferRequest } from './TransferRequest';

const MAX_TOTAL_SIZE = 300 * 1024 * 1024; // 300MB

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function FileTransferPanel() {
  const {
    state,
    progress,
    incomingRequest,
    receivedFiles,
    error,
    onlineDevices,
    sendFiles,
    acceptTransfer,
    rejectTransfer,
    cancelTransfer,
    resetTransfer,
  } = useFileTransfer();

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const isOverLimit = totalSize > MAX_TOTAL_SIZE;
  const canSend =
    selectedDeviceId && files.length > 0 && !isOverLimit && state === 'idle';

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const unique = Array.from(newFiles).filter(
        (f) => !existing.has(`${f.name}-${f.size}`)
      );
      return [...prev, ...unique];
    });
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
      e.target.value = '';
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleSend = useCallback(async () => {
    if (!canSend || !selectedDeviceId) return;
    await sendFiles(selectedDeviceId, files);
  }, [canSend, selectedDeviceId, files, sendFiles]);

  const handleDownload = useCallback((file: { name: string; blob: Blob }) => {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="space-y-4">
      {/* Hidden file input — kept outside conditionals so it's never unmounted while the file picker is open */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Incoming request modal */}
      {incomingRequest && (
        <TransferRequest
          fromDeviceName={incomingRequest.fromDeviceName}
          files={incomingRequest.files}
          onAccept={acceptTransfer}
          onReject={rejectTransfer}
        />
      )}

      {/* Device list */}
      <DeviceList
        devices={onlineDevices}
        selectedDeviceId={selectedDeviceId}
        onSelectDevice={setSelectedDeviceId}
      />

      {/* Transfer in progress */}
      {(state === 'transferring' || state === 'complete' || state === 'error') && (
        <TransferProgress
          progress={progress}
          state={state as 'transferring' | 'complete' | 'error'}
          error={error}
          onCancel={cancelTransfer}
          onReset={resetTransfer}
        />
      )}

      {/* Received files */}
      {receivedFiles.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Received Files</h3>
          <div className="space-y-2">
            {receivedFiles.map((file, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-700 truncate mr-2">{file.name}</span>
                <button
                  onClick={() => handleDownload(file)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap cursor-pointer"
                >
                  Download ({formatBytes(file.size)})
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status messages */}
      {state === 'requesting' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <p className="text-sm text-yellow-700">Waiting for the other device to accept...</p>
        </div>
      )}
      {state === 'connecting' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-sm text-blue-700">Establishing peer-to-peer connection...</p>
        </div>
      )}

      {/* File selection (only when idle) */}
      {state === 'idle' && (
        <>
          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`bg-white rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
              dragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <ArrowUpTrayIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              Drop files here or <span className="text-blue-600 font-medium">browse</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">Max 300MB total</p>
          </div>

          {/* Selected files list */}
          {files.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">
                  Selected Files ({files.length})
                </h3>
                <span
                  className={`text-xs font-medium ${isOverLimit ? 'text-red-600' : 'text-gray-500'}`}
                >
                  {formatBytes(totalSize)}
                  {isOverLimit && ' — exceeds 300MB limit'}
                </span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {files.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5 text-sm"
                  >
                    <span className="text-gray-700 truncate mr-2">{file.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs whitespace-nowrap">
                        {formatBytes(file.size)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(i);
                        }}
                        className="text-gray-400 hover:text-red-500 cursor-pointer"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Send button */}
          {files.length > 0 && (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {!selectedDeviceId
                ? 'Select a device first'
                : isOverLimit
                  ? 'File size exceeds limit'
                  : `Send ${files.length} file${files.length > 1 ? 's' : ''}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
