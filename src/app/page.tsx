'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import { AuthForm } from '@/components/auth/AuthForm';
import { ClipboardStats } from '@/components/clipboard/ClipboardStats';
import { ClipboardInput } from '@/components/clipboard/ClipboardInput';
import { ClipboardList } from '@/components/clipboard/ClipboardList';
import type { ClipboardItem } from '@/types/clipboard';

export default function Home() {
  const { user, token, isLoading: authLoading, login, register, logout, isAuthenticated } = useAuth();
  const [isCreating, setIsCreating] = useState(false);

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
    data: items,
    error,
    mutate,
  } = useSWR<ClipboardItem[]>(
    isAuthenticated ? '/api/clipboard' : null,
    fetcher,
    {
      // refreshInterval: 3000, // 轮询已关闭以节省 Vercel 资源
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  const handleCreate = useCallback(
    async (content: string, contentType: 'text/plain' | 'text/code', language?: string) => {
      if (!token) return;

      setIsCreating(true);

      try {
        mutate(async currentItems => {
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

          const createdItem = await response.json();
          return [createdItem, ...(currentItems || [])];
        }, false);

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
        mutate(
          async currentItems => {
            const response = await fetch(`/api/clipboard/${id}`, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!response.ok) {
              throw new Error('Failed to delete clipboard item');
            }

            return (currentItems || []).filter(item => item.id !== id);
          },
          {
            optimisticData: (items || []).filter(item => item.id !== id),
            rollbackOnError: true,
          }
        );
      } catch (error) {
        console.error('Failed to delete clipboard item:', error);
        alert('Failed to delete clipboard item. Please try again.');
      }
    },
    [mutate, token, items]
  );

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

  const isLoading = !items && !error;
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
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {isLoading ? (
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
            <ClipboardStats totalItems={items?.length || 0} isConnected={isConnected} />
            <ClipboardInput onCreate={handleCreate} isLoading={isCreating} />
            <ClipboardList items={items || []} onDelete={handleDelete} />
          </div>
        )}
      </main>
    </div>
  );
}
