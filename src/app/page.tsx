'use client';

import { useState, useCallback, useMemo } from 'react';
import useSWRInfinite from 'swr/infinite';
import {
  ArrowRightOnRectangleIcon,
  ClipboardDocumentIcon,
  ArrowsRightLeftIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import { AuthForm } from '@/components/auth/AuthForm';
import { ClipboardStats } from '@/components/clipboard/ClipboardStats';
import { ClipboardInput } from '@/components/clipboard/ClipboardInput';
import { ClipboardList } from '@/components/clipboard/ClipboardList';
import { FileTransferPanel } from '@/components/transfer/FileTransferPanel';
import { Tooltip, TooltipIconButton } from '@/components/ui/Tooltip';
import { SUPPORTED_LANGUAGES } from '@/lib/clipboard/constants';
import type { ClipboardItem, ClipboardItemsResponse } from '@/types/clipboard';

type Tab = 'clipboard' | 'transfer';
const pageSize = 20;
const allLanguagesValue = 'all';

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} aria-hidden="true" />;
}

function ClipboardItemSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-md">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <SkeletonBlock className="h-6 w-16 bg-blue-100" />
          <SkeletonBlock className="h-4 w-28" />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-8 w-8" />
          <SkeletonBlock className="h-8 w-8" />
          <SkeletonBlock className="h-8 w-8" />
        </div>
      </div>

      <div className="rounded bg-gray-50 p-4">
        <SkeletonBlock className="mb-3 h-4 w-11/12" />
        <SkeletonBlock className="mb-3 h-4 w-full" />
        <SkeletonBlock className="mb-3 h-4 w-4/5" />
        <SkeletonBlock className="h-4 w-2/3" />
      </div>
    </div>
  );
}

function ClipboardPageSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading clipboard" role="status">
      <span className="sr-only">Loading clipboard items</span>

      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-3 w-3 rounded-full bg-green-100" />
          <SkeletonBlock className="h-4 w-24" />
        </div>
        <SkeletonBlock className="h-4 w-16" />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
        <div className="mb-4 flex items-center gap-2">
          <SkeletonBlock className="h-10 w-20 bg-blue-100" />
          <SkeletonBlock className="h-10 w-20" />
        </div>
        <SkeletonBlock className="h-40 w-full" />
        <div className="mt-4 flex items-center justify-between gap-4">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-10 w-28 bg-blue-100" />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SkeletonBlock className="h-10 flex-1" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SkeletonBlock className="h-10 w-full sm:w-36" />
            <SkeletonBlock className="h-10 w-full sm:w-20 bg-blue-100" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <SkeletonBlock className="h-4 w-20" />
          <SkeletonBlock className="h-4 w-28" />
        </div>
      </div>

      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <ClipboardItemSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

function AuthenticatedHomeSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <SkeletonBlock className="h-8 w-56" />
          <div className="flex items-center gap-4">
            <SkeletonBlock className="h-5 w-32" />
            <SkeletonBlock className="h-10 w-24" />
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-4">
          <nav className="flex gap-1">
            <div className="border-b-2 border-blue-600 px-4 py-2.5">
              <SkeletonBlock className="h-5 w-24 bg-blue-100" />
            </div>
            <div className="border-b-2 border-transparent px-4 py-2.5">
              <SkeletonBlock className="h-5 w-28" />
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <ClipboardPageSkeleton />
      </main>
    </div>
  );
}

function ResultsRefreshingSkeleton() {
  return (
    <div className="flex items-center gap-2 text-blue-600" role="status">
      <span className="sr-only">Updating results</span>
      <SkeletonBlock className="h-3 w-3 rounded-full bg-blue-200" />
      <SkeletonBlock className="h-4 w-28 bg-blue-100" />
    </div>
  );
}

export default function Home() {
  const {
    user,
    token,
    isLoading: authLoading,
    login,
    register,
    logout,
    isAuthenticated,
  } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('clipboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [submittedSearchTerm, setSubmittedSearchTerm] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState(allLanguagesValue);

  const fetcher = useCallback(
    async (url: string) => {
      if (!token) throw new Error('No token');

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch');
      }

      return response.json();
    },
    [token]
  );

  const {
    data: clipboardPages,
    error,
    mutate,
    size,
    setSize,
    isValidating,
  } = useSWRInfinite<ClipboardItemsResponse>(
    (pageIndex, previousPageData) => {
      if (!isAuthenticated || (previousPageData && !previousPageData.hasMore)) {
        return null;
      }

      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(pageIndex * pageSize),
      });

      if (submittedSearchTerm) {
        params.set('search', submittedSearchTerm);
      }

      if (selectedLanguage !== allLanguagesValue) {
        params.set('language', selectedLanguage);
      }

      return `/api/clipboard?${params.toString()}`;
    },
    fetcher,
    {
      // refreshInterval: 3000, // 轮询已关闭以节省 Vercel 资源
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      keepPreviousData: true,
    }
  );

  const items = useMemo(() => clipboardPages?.flatMap(page => page.items) || [], [clipboardPages]);
  const firstPage = clipboardPages?.[0];
  const lastPage = clipboardPages?.[clipboardPages.length - 1];
  const totalItems = firstPage?.total || 0;
  const hasMore = lastPage?.hasMore || false;
  const isLoadingMore =
    isValidating && (!clipboardPages || typeof clipboardPages[size - 1] === 'undefined');
  const hasActiveFilters = submittedSearchTerm.length > 0 || selectedLanguage !== allLanguagesValue;
  const isRefreshingResults = isValidating && !!clipboardPages && !isLoadingMore;

  const handleCreate = useCallback(
    async (content: string, contentType: 'text/plain' | 'text/code', language?: string) => {
      if (!token) return;

      setIsCreating(true);

      try {
        const response = await fetch('/api/clipboard', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content,
            content_type: contentType,
            language,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create clipboard item');
        }

        await mutate();
      } catch (error) {
        console.error('Failed to create clipboard item:', error);
        alert('Failed to create clipboard item. Please try again.');
      } finally {
        setIsCreating(false);
      }
    },
    [mutate, token]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!token) return;

      try {
        await mutate(
          async currentPages => {
            const response = await fetch(`/api/clipboard/${id}`, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!response.ok) {
              throw new Error('Failed to delete clipboard item');
            }

            return (currentPages || []).map(page => {
              const nextItems = page.items.filter(item => item.id !== id);
              const nextTotal = Math.max(page.total - 1, 0);

              return {
                ...page,
                items: nextItems,
                total: nextTotal,
                hasMore: page.offset + nextItems.length < nextTotal,
              };
            });
          },
          {
            optimisticData: (clipboardPages || []).map(page => {
              const nextItems = page.items.filter(item => item.id !== id);
              const nextTotal = Math.max(page.total - 1, 0);

              return {
                ...page,
                items: nextItems,
                total: nextTotal,
                hasMore: page.offset + nextItems.length < nextTotal,
              };
            }),
            rollbackOnError: true,
            revalidate: false,
          }
        );
      } catch (error) {
        console.error('Failed to delete clipboard item:', error);
        alert('Failed to delete clipboard item. Please try again.');
      }
    },
    [mutate, token, clipboardPages]
  );

  const handleUpdate = useCallback(
    async (
      id: number,
      data: {
        content: string;
        content_type: 'text/plain' | 'text/code';
        language?: string;
      }
    ) => {
      if (!token) return;

      try {
        await mutate(
          async currentPages => {
            const response = await fetch(`/api/clipboard/${id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(data),
            });

            if (!response.ok) {
              throw new Error('Failed to update clipboard item');
            }

            const updatedItem = await response.json();
            return (currentPages || []).map(page => ({
              ...page,
              items: page.items.map(item => (item.id === id ? updatedItem : item)),
            }));
          },
          {
            optimisticData: (clipboardPages || []).map(page => ({
              ...page,
              items: page.items.map(item =>
                item.id === id ? { ...item, ...data, updated_at: Date.now() } : item
              ),
            })),
            rollbackOnError: true,
            revalidate: false,
          }
        );

        if (hasActiveFilters) {
          await mutate();
        }
      } catch (error) {
        console.error('Failed to update clipboard item:', error);
        alert('Failed to update clipboard item. Please try again.');
        throw error;
      }
    },
    [mutate, token, clipboardPages, hasActiveFilters]
  );

  const handleShare = useCallback(
    async (id: number) => {
      if (!token) return;

      try {
        await mutate(
          async currentPages => {
            const response = await fetch(`/api/clipboard/${id}/share`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!response.ok) {
              throw new Error('Failed to enable sharing');
            }

            const data = await response.json();

            if (data.share_url && navigator.clipboard) {
              await navigator.clipboard.writeText(data.share_url);
            }

            return (currentPages || []).map(page => ({
              ...page,
              items: page.items.map(item => (item.id === id ? data.item : item)),
            }));
          },
          {
            optimisticData: (clipboardPages || []).map(page => ({
              ...page,
              items: page.items.map(item =>
                item.id === id ? { ...item, share_token: item.share_token || 'pending' } : item
              ),
            })),
            rollbackOnError: true,
            revalidate: false,
          }
        );
      } catch (error) {
        console.error('Failed to enable sharing:', error);
        alert('Failed to create share link. Please try again.');
        throw error;
      }
    },
    [mutate, token, clipboardPages]
  );

  const handleUnshare = useCallback(
    async (id: number) => {
      if (!token) return;

      try {
        await mutate(
          async currentPages => {
            const response = await fetch(`/api/clipboard/${id}/share`, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!response.ok) {
              throw new Error('Failed to disable sharing');
            }

            const data = await response.json();
            return (currentPages || []).map(page => ({
              ...page,
              items: page.items.map(item => (item.id === id ? data.item : item)),
            }));
          },
          {
            optimisticData: (clipboardPages || []).map(page => ({
              ...page,
              items: page.items.map(item =>
                item.id === id ? { ...item, share_token: null } : item
              ),
            })),
            rollbackOnError: true,
            revalidate: false,
          }
        );
      } catch (error) {
        console.error('Failed to disable sharing:', error);
        alert('Failed to stop sharing. Please try again.');
        throw error;
      }
    },
    [mutate, token, clipboardPages]
  );

  const handleClearFilters = () => {
    setSearchTerm('');
    setSubmittedSearchTerm('');
    setSelectedLanguage(allLanguagesValue);
    setSize(1);
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmittedSearchTerm(searchTerm.trim());
    setSize(1);
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    setSize(1);
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  if (authLoading) {
    return <AuthenticatedHomeSkeleton />;
  }

  // Show auth form if not authenticated
  if (!isAuthenticated) {
    return <AuthForm onLogin={login} onRegister={register} isLoading={false} />;
  }

  const isLoading = !clipboardPages && !error;
  const isConnected = !error && !isLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Online Clipboard</h1>
            <Tooltip label="View on GitHub">
              <a
                href="https://github.com/CUinspace233/online-clipboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-900 transition-colors"
                aria-label="View on GitHub"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </Tooltip>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Welcome, <span className="font-semibold">{user?.username}</span>
            </span>
            <Tooltip label="Sign out">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
                Logout
              </button>
            </Tooltip>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4">
          <nav className="flex gap-1">
            <button
              onClick={() => setActiveTab('clipboard')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'clipboard'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ClipboardDocumentIcon className="w-4 h-4" />
              Clipboard
            </button>
            <button
              onClick={() => setActiveTab('transfer')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === 'transfer'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ArrowsRightLeftIcon className="w-4 h-4" />
              File Transfer
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {activeTab === 'clipboard' ? (
          isLoading ? (
            <ClipboardPageSkeleton />
          ) : error ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center max-w-md">
                <h2 className="text-xl font-bold text-red-600 mb-2">Connection Error</h2>
                <p className="text-gray-600 mb-4">
                  Failed to connect to the clipboard service. Please check your internet connection
                  and try again.
                </p>
                <button
                  onClick={() => mutate()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <ClipboardStats totalItems={totalItems} isConnected={isConnected} />
              <ClipboardInput onCreate={handleCreate} isLoading={isCreating} />
              <form
                onSubmit={handleSearchSubmit}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative flex-1">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      value={searchTerm}
                      onChange={event => setSearchTerm(event.target.value)}
                      placeholder="Search content..."
                      className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-10 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500"
                    />
                    {searchTerm && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <TooltipIconButton
                          tooltip="Clear search"
                          onClick={() => {
                            setSearchTerm('');
                            if (submittedSearchTerm) {
                              setSubmittedSearchTerm('');
                              setSize(1);
                            }
                          }}
                          className="!p-1.5 text-gray-500 hover:text-gray-900"
                          aria-label="Clear search"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </TooltipIconButton>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <select
                      value={selectedLanguage}
                      onChange={event => handleLanguageChange(event.target.value)}
                      className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value={allLanguagesValue}>All languages</option>
                      {SUPPORTED_LANGUAGES.map(language => (
                        <option key={language} value={language}>
                          {language.charAt(0).toUpperCase() + language.slice(1)}
                        </option>
                      ))}
                    </select>

                    <button
                      type="submit"
                      disabled={searchTerm.trim() === submittedSearchTerm}
                      className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400 cursor-pointer"
                    >
                      Search
                    </button>

                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-sm text-gray-600">
                  <div>
                    <span className="font-semibold text-gray-900">{totalItems}</span>{' '}
                    {totalItems === 1 ? 'result' : 'results'}
                  </div>
                  {isRefreshingResults && <ResultsRefreshingSkeleton />}
                </div>
              </form>
              <ClipboardList
                items={items}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                onShare={handleShare}
                onUnshare={handleUnshare}
                isFiltered={hasActiveFilters}
              />
              {isLoadingMore && (
                <div className="space-y-4" aria-label="Loading more clipboard items" role="status">
                  <span className="sr-only">Loading more clipboard items</span>
                  {Array.from({ length: 2 }).map((_, index) => (
                    <ClipboardItemSkeleton key={index} />
                  ))}
                </div>
              )}
              {items.length > 0 && (
                <div className="flex justify-center">
                  {hasMore ? (
                    <button
                      type="button"
                      onClick={() => setSize(size + 1)}
                      disabled={isLoadingMore}
                      className="min-w-32 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400 cursor-pointer"
                    >
                      {isLoadingMore ? 'Loading...' : 'Load more'}
                    </button>
                  ) : (
                    <p className="text-sm text-gray-500">No more items</p>
                  )}
                </div>
              )}
            </div>
          )
        ) : (
          <FileTransferPanel />
        )}
      </main>
    </div>
  );
}
