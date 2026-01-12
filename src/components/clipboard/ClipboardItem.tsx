'use client';

import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ClipboardDocumentIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useClipboard } from '@/hooks/useClipboard';
import type { ClipboardItem as ClipboardItemType } from '@/types/clipboard';

interface ClipboardItemProps {
  item: ClipboardItemType;
  onDelete: (id: number) => void;
}

export function ClipboardItem({ item, onDelete }: ClipboardItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { copied, copyToClipboard } = useClipboard();

  const isLongContent = item.content.length > 500;
  const displayContent = isExpanded ? item.content : item.content.slice(0, 500);

  const handleCopy = () => {
    copyToClipboard(item.content);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this item?')) {
      onDelete(item.id);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden transition-all hover:shadow-lg">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {item.content_type === 'text/code' && item.language && (
              <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded">
                {item.language}
              </span>
            )}
            <span className="text-xs text-gray-500">
              {formatTimestamp(item.created_at)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-2 text-gray-600 hover:text-blue-600 transition-colors cursor-pointer"
              title="Copy to clipboard"
            >
              {copied ? (
                <CheckIcon className="w-5 h-5 text-green-600" />
              ) : (
                <ClipboardDocumentIcon className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={handleDelete}
              className="p-2 text-gray-600 hover:text-red-600 transition-colors cursor-pointer"
              title="Delete"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="relative">
          {item.content_type === 'text/code' && item.language ? (
            item.language === 'markdown' ? (
              <div className="prose prose-sm prose-slate max-w-none bg-white p-4 rounded border border-gray-200 overflow-auto prose-ul:list-disc prose-ol:list-decimal prose-li:ml-4" style={{ maxHeight: isExpanded ? 'none' : '400px' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {displayContent}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="rounded overflow-hidden">
                <SyntaxHighlighter
                  language={item.language}
                  style={vs}
                  customStyle={{
                    margin: 0,
                    padding: '1rem',
                    fontSize: '0.875rem',
                    maxHeight: isExpanded ? 'none' : '400px',
                    overflow: 'auto',
                  }}
                  showLineNumbers
                >
                  {displayContent}
                </SyntaxHighlighter>
              </div>
            )
          ) : (
            <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 bg-gray-50 p-4 rounded overflow-auto max-h-96">
              {displayContent}
            </pre>
          )}

          {isLongContent && !isExpanded && (
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent" />
          )}
        </div>

        {isLongContent && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-3 text-sm text-blue-600 hover:underline cursor-pointer"
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    </div>
  );
}
