'use client';

import { useState } from 'react';
import { UserIcon, LockClosedIcon } from '@heroicons/react/24/outline';

interface AuthFormProps {
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, password: string) => Promise<void>;
  isLoading: boolean;
}

export function AuthForm({ onLogin, onRegister, isLoading }: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitPulse, setSubmitPulse] = useState(false);
  const isRegister = mode === 'register';
  const isBusy = isLoading || isSubmitting;
  const submitLabel = isRegister ? 'Create Account' : 'Sign In';
  const submittingLabel = isRegister ? 'Creating account...' : 'Signing in...';

  const switchMode = (nextMode: 'login' | 'register') => {
    if (nextMode === mode || isBusy) {
      return;
    }

    setMode(nextMode);
    setError('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitPulse(true);
    window.setTimeout(() => setSubmitPulse(false), 360);

    // Validation
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (isRegister) {
      if (username.length < 3) {
        setError('Username must be at least 3 characters');
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setError('Username can only contain letters, numbers, and underscores');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const authRequest =
        mode === 'login' ? onLogin(username, password) : onRegister(username, password);

      await Promise.all([
        authRequest,
        new Promise(resolve => {
          window.setTimeout(resolve, 520);
        }),
      ]);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Clipboard Sharing</h1>
          <p key={mode} className="text-gray-600 auth-mode-copy">
            {isRegister ? 'Create a new account' : 'Sign in to your account'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-8">
          <div className="relative grid grid-cols-2 gap-2 mb-6 rounded-lg bg-gray-100 p-1">
            <span
              className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-md bg-blue-600 shadow-sm transition-transform duration-300 ease-out ${
                isRegister ? 'translate-x-[calc(100%+0.5rem)]' : 'translate-x-0'
              }`}
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => switchMode('login')}
              disabled={isBusy}
              className={`relative z-10 py-2 rounded-md font-medium transition-colors duration-300 cursor-pointer active:scale-[0.98] ${
                mode === 'login' ? 'text-white' : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              disabled={isBusy}
              className={`relative z-10 py-2 rounded-md font-medium transition-colors duration-300 cursor-pointer active:scale-[0.98] ${
                isRegister ? 'text-white' : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm auth-error">
              {error}
            </div>
          )}

          <form key={mode} onSubmit={handleSubmit} className="space-y-4 auth-form-panel">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your username"
                  disabled={isBusy}
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your password"
                  disabled={isBusy}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                />
              </div>
            </div>

            {isRegister && (
              <div className="auth-register-field">
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirm your password"
                    disabled={isBusy}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isBusy}
              className={`relative flex w-full items-center justify-center overflow-hidden py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-500 disabled:cursor-wait transition-all duration-200 cursor-pointer active:scale-[0.99] ${
                submitPulse ? 'auth-submit-pulse' : ''
              } ${isBusy ? 'auth-submit-loading' : ''}`}
            >
              <span className={`transition-transform duration-200 ${isBusy ? 'translate-x-2' : ''}`}>
                {isBusy ? submittingLabel : submitLabel}
              </span>
              {isBusy && (
                <span
                  className="absolute left-4 h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin"
                  aria-hidden="true"
                />
              )}
            </button>
          </form>

          {isRegister && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg auth-register-field">
              <p className="text-xs text-blue-800">
                <strong>Requirements:</strong>
                <br />• Username: 3-50 characters (letters, numbers, underscores only)
                <br />• Password: minimum 6 characters
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
