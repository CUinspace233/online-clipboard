'use client';

import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { ClipboardItem } from './ClipboardItem';
import type { ClipboardItem as ClipboardItemType } from '@/types/clipboard';

interface ClipboardListProps {
  items: ClipboardItemType[];
  onDelete: (id: number) => void;
}

export function ClipboardList({ items, onDelete }: ClipboardListProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <ClipboardDocumentListIcon className="w-16 h-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          No clipboard items yet
        </h3>
        <p className="text-sm text-gray-500 text-center max-w-md">
          Create your first clipboard item by typing or pasting content in the form above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map(item => (
        <ClipboardItem key={item.id} item={item} onDelete={onDelete} />
      ))}
    </div>
  );
}
