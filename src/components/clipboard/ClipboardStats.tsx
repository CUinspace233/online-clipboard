import { Tooltip } from '@/components/ui/Tooltip';

interface ClipboardStatsProps {
  totalItems: number;
  isConnected: boolean;
}

export function ClipboardStats({ totalItems, isConnected }: ClipboardStatsProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-white  rounded-lg shadow-sm border border-gray-200 ">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Tooltip label={isConnected ? 'Connected to server' : 'Disconnected from server'}>
            <span
              className={`inline-flex h-3 w-3 rounded-full ${
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}
              aria-hidden="true"
            />
          </Tooltip>
          <span className="text-sm text-gray-600 ">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
      <div className="text-sm text-gray-600 ">
        <span className="font-semibold text-gray-900 ">{totalItems}</span>{' '}
        {totalItems === 1 ? 'item' : 'items'}
      </div>
    </div>
  );
}
