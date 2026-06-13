'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowsPointingOutIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  LinkIcon,
  LinkSlashIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { ClipboardContent, formatJsonForDisplay } from '@/components/clipboard/ClipboardContent';
import { Tooltip, TooltipIconButton } from '@/components/ui/Tooltip';
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
  onShare: (id: number) => Promise<void>;
  onUnshare: (id: number) => Promise<void>;
}

const previewLength = 500;
const maxContentLength = 100000;

export function ClipboardItem({
  item,
  onDelete,
  onUpdate,
  onShare,
  onUnshare,
}: ClipboardItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isImmersiveOpen, setIsImmersiveOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isUnsharing, setIsUnsharing] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [editContent, setEditContent] = useState(item.content);
  const [editContentType, setEditContentType] = useState<'text/plain' | 'text/code'>(
    item.content_type
  );
  const [editLanguage, setEditLanguage] = useState(item.language || 'markdown');
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
  const isShared = Boolean(item.share_token);
  const shareUrl = item.share_token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${item.share_token}`
    : '';

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

  const handleCopyShareLink = async () => {
    if (!shareUrl || !navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
    } catch (err) {
      console.error('Copy share link failed:', err);
    }
  };

  const handleShare = async () => {
    if (isSharing || isUnsharing) return;

    setIsSharing(true);
    try {
      await onShare(item.id);
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
    } finally {
      setIsSharing(false);
    }
  };

  const handleUnshare = async () => {
    if (isSharing || isUnsharing) return;

    setIsUnsharing(true);
    try {
      await onUnshare(item.id);
    } finally {
      setIsUnsharing(false);
    }
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
    setEditLanguage(item.language || 'markdown');
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

  const renderShareControls = () => {
    if (isShared) {
      return (
        <TooltipIconButton
          tooltip={shareLinkCopied ? 'Link copied!' : 'Copy share link'}
          onClick={handleCopyShareLink}
          disabled={isSharing || isUnsharing}
          aria-label="Copy share link"
        >
          {shareLinkCopied ? (
            <CheckIcon className="w-5 h-5 text-green-600" />
          ) : (
            <LinkIcon className="w-5 h-5" />
          )}
        </TooltipIconButton>
      );
    }

    return (
      <TooltipIconButton
        tooltip={
          isSharing
            ? 'Creating share link...'
            : shareLinkCopied
              ? 'Link copied!'
              : 'Create share link'
        }
        onClick={handleShare}
        disabled={isSharing || isUnsharing}
        aria-label="Share"
      >
        {isSharing ? (
          <span className="block h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        ) : shareLinkCopied ? (
          <CheckIcon className="w-5 h-5 text-green-600" />
        ) : (
          <LinkIcon className="w-5 h-5" />
        )}
      </TooltipIconButton>
    );
  };

  const renderBadges = () => (
    <>
      {item.content_type === 'text/code' && item.language && (
        <span className="max-w-full rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
          {item.language}
        </span>
      )}
      {item.content_type === 'text/plain' && hasJsonFormat && (
        <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
          JSON
        </span>
      )}
      {isShared && (
        <Tooltip label="Stop sharing">
          <span className="inline-flex">
            <button
              type="button"
              onClick={handleUnshare}
              disabled={isSharing || isUnsharing}
              className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800 transition-colors hover:bg-green-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Stop sharing"
            >
              Shared
              <LinkSlashIcon className="h-3.5 w-3.5" />
            </button>
          </span>
        </Tooltip>
      )}
    </>
  );

  const renderTimestamps = () => (
    <div className="flex items-center gap-2 whitespace-nowrap text-xs">
      <span className="text-gray-500">created {formatTimestamp(item.created_at)}</span>
      {wasEdited && (
        <>
          <span className="text-gray-300" aria-hidden="true">
            ·
          </span>
          <span className="font-medium text-amber-700">
            edited {formatTimestamp(item.updated_at)}
          </span>
        </>
      )}
    </div>
  );

  return (
    <>
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden transition-all hover:shadow-lg">
        <div className="p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">{renderBadges()}</div>
              <div className="overflow-x-auto">{renderTimestamps()}</div>
            </div>
            <div className="flex w-full flex-wrap items-center justify-start gap-1 sm:w-auto sm:flex-nowrap sm:justify-end sm:gap-2">
              {hasJsonFormat && (
                <Tooltip label={isJsonFormatted ? 'Show raw JSON' : 'Beautify JSON'}>
                  <button
                    type="button"
                    onClick={() => setIsJsonFormatted(current => !current)}
                    className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                  >
                    {isJsonFormatted ? 'Raw' : 'Beautify'}
                  </button>
                </Tooltip>
              )}
              {renderShareControls()}
              <TooltipIconButton
                tooltip="Open fullscreen"
                onClick={() => setIsImmersiveOpen(true)}
                aria-label="Open immersive view"
              >
                <ArrowsPointingOutIcon className="w-5 h-5" />
              </TooltipIconButton>
              <TooltipIconButton tooltip="Edit" onClick={openEdit} aria-label="Edit clipboard item">
                <PencilSquareIcon className="w-5 h-5" />
              </TooltipIconButton>
              <TooltipIconButton
                tooltip={copied ? 'Copied!' : 'Copy to clipboard'}
                onClick={handleCopy}
                aria-label="Copy to clipboard"
              >
                {copied ? (
                  <CheckIcon className="w-5 h-5 text-green-600" />
                ) : (
                  <ClipboardDocumentIcon className="w-5 h-5" />
                )}
              </TooltipIconButton>
              <TooltipIconButton
                tooltip="Delete"
                variant="danger"
                onClick={handleDelete}
                aria-label="Delete"
              >
                <TrashIcon className="w-5 h-5" />
              </TooltipIconButton>
            </div>
          </div>

          <div className="relative">
            <ClipboardContent
              content={displayContent}
              contentType={item.content_type}
              language={item.language}
              mode="preview"
              isExpanded={isExpanded}
              isJsonFormatted={isJsonFormatted}
            />

            {isLongContent && !isExpanded && (
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-linear-to-t from-white to-transparent" />
            )}
          </div>

          {isLongContent && (
            <Tooltip label={isExpanded ? 'Collapse content' : 'Expand content'} side="bottom">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-3 text-sm text-blue-600 hover:underline cursor-pointer"
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            </Tooltip>
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
                <div className="mb-2 overflow-x-auto">{renderTimestamps()}</div>
                <h2 className="text-lg font-semibold text-gray-900">Clipboard item</h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {hasJsonFormat && (
                  <Tooltip label={isJsonFormatted ? 'Show raw JSON' : 'Beautify JSON'}>
                    <button
                      type="button"
                      onClick={() => setIsJsonFormatted(current => !current)}
                      className="px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                    >
                      {isJsonFormatted ? 'Raw' : 'Beautify'}
                    </button>
                  </Tooltip>
                )}
                {renderShareControls()}
                <TooltipIconButton
                  tooltip={copied ? 'Copied!' : 'Copy to clipboard'}
                  onClick={handleCopy}
                  aria-label="Copy to clipboard"
                >
                  {copied ? (
                    <CheckIcon className="w-5 h-5 text-green-600" />
                  ) : (
                    <ClipboardDocumentIcon className="w-5 h-5" />
                  )}
                </TooltipIconButton>
                <TooltipIconButton
                  tooltip="Edit"
                  onClick={openEdit}
                  aria-label="Edit clipboard item"
                >
                  <PencilSquareIcon className="w-5 h-5" />
                </TooltipIconButton>
                <TooltipIconButton
                  tooltip="Delete"
                  variant="danger"
                  onClick={handleDelete}
                  aria-label="Delete"
                >
                  <TrashIcon className="w-5 h-5" />
                </TooltipIconButton>
                <TooltipIconButton
                  tooltip="Close"
                  variant="neutral"
                  onClick={() => setIsImmersiveOpen(false)}
                  aria-label="Close immersive view"
                >
                  <XMarkIcon className="w-5 h-5" />
                </TooltipIconButton>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-3 sm:p-5">
              <ClipboardContent
                content={contentForDisplay}
                contentType={item.content_type}
                language={item.language}
                mode="immersive"
                isJsonFormatted={isJsonFormatted}
              />
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
                <div className="mb-2 overflow-x-auto">{renderTimestamps()}</div>
                <h2 className="text-lg font-semibold text-gray-900">Edit clipboard item</h2>
              </div>
              <TooltipIconButton
                tooltip="Close"
                variant="neutral"
                onClick={() => setIsEditOpen(false)}
                disabled={isSaving}
                className="self-start"
                aria-label="Close edit dialog"
              >
                <XMarkIcon className="h-5 w-5" />
              </TooltipIconButton>
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
