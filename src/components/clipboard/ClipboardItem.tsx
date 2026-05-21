'use client';

import { useEffect, useMemo, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowsPointingOutIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useClipboard } from '@/hooks/useClipboard';
import { SUPPORTED_LANGUAGES } from '@/lib/clipboard/constants';
import type { ClipboardItem as ClipboardItemType } from '@/types/clipboard';

interface ClipboardItemProps {
  item: ClipboardItemType;
  onDelete: (id: number) => void;
  onUpdate: (
    id: number,
    data: {
      content: string;
      content_type: 'text/plain' | 'text/code';
      language?: string;
    }
  ) => Promise<void>;
}

const previewLength = 500;
const maxContentLength = 100000;
const syntaxHighlighterCustomStyle = {
  margin: 0,
  padding: '1rem',
  fontSize: '0.875rem',
  lineHeight: '1.6',
  background: '#f8fafc',
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
} as const;
const syntaxLineNumberStyle = {
  color: '#94a3b8',
  fontStyle: 'normal',
  minWidth: '2.75em',
} as const;

function formatJsonForDisplay(content: string) {
  const trimmedContent = content.trim();

  if (!trimmedContent.startsWith('{') && !trimmedContent.startsWith('[')) {
    return null;
  }

  try {
    return JSON.stringify(JSON.parse(trimmedContent), null, 2);
  } catch {
    return null;
  }
}

export function ClipboardItem({ item, onDelete, onUpdate }: ClipboardItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isImmersiveOpen, setIsImmersiveOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editContent, setEditContent] = useState(item.content);
  const [editContentType, setEditContentType] = useState<'text/plain' | 'text/code'>(
    item.content_type
  );
  const [editLanguage, setEditLanguage] = useState(item.language || 'javascript');
  const [isJsonFormatted, setIsJsonFormatted] = useState(false);
  const { copied, copyToClipboard } = useClipboard();

  const formattedJson = useMemo(() => formatJsonForDisplay(item.content), [item.content]);
  const hasJsonFormat = formattedJson !== null;
  const shouldRenderFormattedJson = isJsonFormatted && hasJsonFormat;
  const contentForDisplay =
    shouldRenderFormattedJson && formattedJson !== null ? formattedJson : item.content;
  const isLongContent = contentForDisplay.length > previewLength;
  const displayContent = isExpanded ? contentForDisplay : contentForDisplay.slice(0, previewLength);
  const isEditingOverLimit = editContent.length > maxContentLength;
  const isEditingEmpty = editContent.trim().length === 0;
  const wasEdited = item.updated_at - item.created_at > 1000;

  useEffect(() => {
    if (!isImmersiveOpen && !isEditOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isEditOpen) {
          setIsEditOpen(false);
        } else {
          setIsImmersiveOpen(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isImmersiveOpen, isEditOpen]);

  const handleCopy = () => {
    copyToClipboard(item.content);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this item?')) {
      setIsEditOpen(false);
      setIsImmersiveOpen(false);
      onDelete(item.id);
    }
  };

  const openEdit = () => {
    setEditContent(item.content);
    setEditContentType(item.content_type);
    setEditLanguage(item.language || 'javascript');
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (isEditingEmpty || isEditingOverLimit || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      await onUpdate(item.id, {
        content: editContent,
        content_type: editContentType,
        language: editContentType === 'text/code' ? editLanguage : undefined,
      });
      setIsExpanded(false);
      setIsJsonFormatted(false);
      setIsEditOpen(false);
    } finally {
      setIsSaving(false);
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

  const renderBadges = () => (
    <>
      {item.content_type === 'text/code' && item.language && (
        <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded">
          {item.language}
        </span>
      )}
      {item.content_type === 'text/plain' && hasJsonFormat && (
        <span className="px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded">
          JSON
        </span>
      )}
      <span className="text-xs text-gray-500">created {formatTimestamp(item.created_at)}</span>
      {wasEdited && (
        <span className="text-xs font-medium text-amber-700">
          edited {formatTimestamp(item.updated_at)}
        </span>
      )}
    </>
  );

  const renderContent = (content: string, mode: 'preview' | 'immersive') => {
    const maxHeight = mode === 'immersive' ? 'calc(100vh - 15rem)' : isExpanded ? 'none' : '400px';
    const plainTextClassName =
      mode === 'immersive'
        ? 'whitespace-pre-wrap font-mono text-sm text-gray-800 bg-gray-50 p-5 rounded-lg overflow-auto border border-gray-200'
        : 'whitespace-pre-wrap font-mono text-sm text-gray-800 bg-gray-50 p-4 rounded overflow-auto max-h-96';

    if (shouldRenderFormattedJson) {
      return (
        <div className="rounded-lg overflow-hidden border border-gray-200">
          <SyntaxHighlighter
            language="json"
            style={oneLight}
            customStyle={{
              ...syntaxHighlighterCustomStyle,
              maxHeight,
              overflow: 'auto',
            }}
            lineNumberStyle={syntaxLineNumberStyle}
            showLineNumbers
          >
            {content}
          </SyntaxHighlighter>
        </div>
      );
    }

    if (item.content_type === 'text/code' && item.language) {
      if (item.language === 'markdown') {
        return (
          <div
            className="prose prose-sm prose-slate max-w-none bg-white p-4 rounded-lg border border-gray-200 overflow-auto prose-ul:list-disc prose-ol:list-decimal prose-li:ml-4"
            style={{ maxHeight }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        );
      }

      return (
        <div className="rounded-lg overflow-hidden border border-gray-200">
          <SyntaxHighlighter
            language={item.language}
            style={oneLight}
            customStyle={{
              ...syntaxHighlighterCustomStyle,
              maxHeight,
              overflow: 'auto',
            }}
            lineNumberStyle={syntaxLineNumberStyle}
            showLineNumbers
          >
            {content}
          </SyntaxHighlighter>
        </div>
      );
    }

    return (
      <pre className={plainTextClassName} style={{ maxHeight }}>
        {content}
      </pre>
    );
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden transition-all hover:shadow-lg">
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">{renderBadges()}</div>
            <div className="flex items-center gap-2">
              {hasJsonFormat && (
                <button
                  onClick={() => setIsJsonFormatted(current => !current)}
                  className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                  title={isJsonFormatted ? 'Show raw JSON' : 'Beautify JSON'}
                >
                  {isJsonFormatted ? 'Raw' : 'Beautify'}
                </button>
              )}
              <button
                onClick={() => setIsImmersiveOpen(true)}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                title="Open immersive view"
                aria-label="Open immersive view"
              >
                <ArrowsPointingOutIcon className="w-5 h-5" />
              </button>
              <button
                onClick={openEdit}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                title="Edit"
                aria-label="Edit clipboard item"
              >
                <PencilSquareIcon className="w-5 h-5" />
              </button>
              <button
                onClick={handleCopy}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                title="Copy to clipboard"
                aria-label="Copy to clipboard"
              >
                {copied ? (
                  <CheckIcon className="w-5 h-5 text-green-600" />
                ) : (
                  <ClipboardDocumentIcon className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={handleDelete}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Delete"
                aria-label="Delete"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="relative">
            {renderContent(displayContent, 'preview')}

            {isLongContent && !isExpanded && (
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-linear-to-t from-white to-transparent" />
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

      {isImmersiveOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-3 py-4 backdrop-blur-sm sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-label="Immersive clipboard item view"
          onClick={() => setIsImmersiveOpen(false)}
        >
          <div
            className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-white/20"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex flex-col gap-3 border-b border-gray-200 bg-white px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">{renderBadges()}</div>
                <h2 className="text-lg font-semibold text-gray-900">Clipboard item</h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {hasJsonFormat && (
                  <button
                    onClick={() => setIsJsonFormatted(current => !current)}
                    className="px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                    title={isJsonFormatted ? 'Show raw JSON' : 'Beautify JSON'}
                  >
                    {isJsonFormatted ? 'Raw' : 'Beautify'}
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  title="Copy to clipboard"
                  aria-label="Copy to clipboard"
                >
                  {copied ? (
                    <CheckIcon className="w-5 h-5 text-green-600" />
                  ) : (
                    <ClipboardDocumentIcon className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={openEdit}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  title="Edit"
                  aria-label="Edit clipboard item"
                >
                  <PencilSquareIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Delete"
                  aria-label="Delete"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIsImmersiveOpen(false)}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  title="Close"
                  aria-label="Close immersive view"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-3 sm:p-5">
              {renderContent(contentForDisplay, 'immersive')}
            </div>
          </div>
        </div>
      )}

      {isEditOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 px-3 py-4 backdrop-blur-sm sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-label="Edit clipboard item"
          onClick={() => {
            if (!isSaving) setIsEditOpen(false);
          }}
        >
          <form
            onSubmit={handleEditSubmit}
            className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-white/20"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex flex-col gap-3 border-b border-gray-200 bg-white px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">{renderBadges()}</div>
                <h2 className="text-lg font-semibold text-gray-900">Edit clipboard item</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                disabled={isSaving}
                className="self-start rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                title="Close"
                aria-label="Close edit dialog"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100 p-3 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditContentType('text/plain')}
                    disabled={isSaving}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                      editContentType === 'text/plain'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditContentType('text/code')}
                    disabled={isSaving}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                      editContentType === 'text/code'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Code
                  </button>
                </div>

                {editContentType === 'text/code' && (
                  <select
                    value={editLanguage}
                    onChange={event => setEditLanguage(event.target.value)}
                    disabled={isSaving}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <option key={lang} value={lang}>
                        {lang.charAt(0).toUpperCase() + lang.slice(1)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <textarea
                value={editContent}
                onChange={event => setEditContent(event.target.value)}
                disabled={isSaving}
                className="h-[55vh] min-h-80 w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="text-sm">
                <span
                  className={`font-medium ${
                    isEditingOverLimit
                      ? 'text-red-600'
                      : editContent.length > maxContentLength * 0.9
                        ? 'text-yellow-600'
                        : 'text-gray-600'
                  }`}
                >
                  {editContent.length.toLocaleString()}
                </span>
                <span className="text-gray-500">
                  {' '}
                  / {maxContentLength.toLocaleString()} characters
                </span>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  disabled={isSaving}
                  className="rounded-lg px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditingEmpty || isEditingOverLimit || isSaving}
                  className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white transition-colors hover:bg-blue-700 cursor-pointer disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {isSaving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
