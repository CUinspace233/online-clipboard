'use client';

import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { ClipboardItem } from './ClipboardItem';
import type { ClipboardItem as ClipboardItemType } from '@/types/clipboard';

interface ClipboardListProps {
  items: ClipboardItemType[];
  isFiltered?: boolean;
  onDelete: (id: number) => void;
  onUpdate: (
    id: number,
    data: {
      content: string;
      content_type: 'text/plain' | 'text/code';
      language?: string;
    }
  ) => Promise<void>;
  onShare: (id: number) => Promise<void>;
  onUnshare: (id: number) => Promise<void>;
}

export function ClipboardList({
  items,
  isFiltered = false,
  onDelete,
  onUpdate,
  onShare,
  onUnshare,
}: ClipboardListProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <ClipboardDocumentListIcon className="w-16 h-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          {isFiltered ? 'No matching items' : 'No clipboard items yet'}
        </h3>
        <p className="text-sm text-gray-500 text-center max-w-md">
          {isFiltered
            ? 'Try a different search term or language filter.'
            : 'Create your first clipboard item by typing or pasting content in the form above.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map(item => (
        <ClipboardItem
          key={item.id}
          item={item}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onShare={onShare}
          onUnshare={onUnshare}
        />
      ))}
    </div>
  );
}
