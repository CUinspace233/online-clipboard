'use client';

import { CheckIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { ClipboardContent, formatJsonForDisplay } from '@/components/clipboard/ClipboardContent';
import { ClientLocalTime } from '@/components/ui/ClientLocalTime';
import { useClipboard } from '@/hooks/useClipboard';
import type { SharedClipboardItem } from '@/types/clipboard';

interface SharedItemViewProps {
  item: SharedClipboardItem;
}

export function SharedItemView({ item }: SharedItemViewProps) {
  const { copied, copyToClipboard } = useClipboard();
  const hasJsonFormat = formatJsonForDisplay(item.content) !== null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Online Clipboard</h1>
            <p className="text-sm text-gray-500">
              Shared content · <ClientLocalTime timestamp={item.created_at} />
            </p>
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(item.content)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 cursor-pointer"
          >
            {copied ? (
              <>
                <CheckIcon className="h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <ClipboardDocumentIcon className="h-4 w-4" />
                Copy
              </>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {item.content_type === 'text/code' && item.language && (
              <span className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                {item.language}
              </span>
            )}
            {item.content_type === 'text/plain' && hasJsonFormat && (
              <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                JSON
              </span>
            )}
            <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
              Shared
            </span>
          </div>

          <ClipboardContent
            content={item.content}
            contentType={item.content_type}
            language={item.language}
            mode="immersive"
          />
        </div>
      </main>
    </div>
  );
}
