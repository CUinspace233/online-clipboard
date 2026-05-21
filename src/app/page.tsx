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
import { SUPPORTED_LANGUAGES } from '@/lib/clipboard/constants';
import type { ClipboardItem, ClipboardItemsResponse } from '@/types/clipboard';

type Tab = 'clipboard' | 'transfer';
const pageSize = 20;
const allLanguagesValue = 'all';

export default function Home() {
  const { user, token, isLoading: authLoading, login, register, logout, isAuthenticated } = useAuth();
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

  const items = useMemo(
    () => clipboardPages?.flatMap(page => page.items) || [],
    [clipboardPages]
  );
  const firstPage = clipboardPages?.[0];
  const lastPage = clipboardPages?.[clipboardPages.length - 1];
  const totalItems = firstPage?.total || 0;
  const hasMore = lastPage?.hasMore || false;
  const isLoadingMore =
    isValidating && (!clipboardPages || typeof clipboardPages[size - 1] === 'undefined');
  const hasActiveFilters =
    submittedSearchTerm.length > 0 || selectedLanguage !== allLanguagesValue;
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

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
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
          <h1 className="text-2xl font-bold text-gray-900">Clipboard Sharing</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Welcome, <span className="font-semibold">{user?.username}</span>
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title="Logout"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              Logout
            </button>
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
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-600">Loading clipboard items...</p>
              </div>
            </div>
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
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm('');
                          if (submittedSearchTerm) {
                            setSubmittedSearchTerm('');
                            setSize(1);
                          }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 cursor-pointer"
                        title="Clear search"
                        aria-label="Clear search"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
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
                  {isRefreshingResults && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      Updating results...
                    </div>
                  )}
                </div>
              </form>
              <ClipboardList
                items={items}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                isFiltered={hasActiveFilters}
              />
              {items.length > 0 && (
                <div className="flex justify-center">
                  {hasMore ? (
                    <button
                      type="button"
                      onClick={() => setSize(size + 1)}
                      disabled={isLoadingMore}
                      className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400 cursor-pointer"
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
