'use client';

import { useState } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';

interface ClipboardInputProps {
  onCreate: (content: string, contentType: 'text/plain' | 'text/code', language?: string) => void;
  isLoading: boolean;
}

const SUPPORTED_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'java',
  'cpp',
  'csharp',
  'go',
  'rust',
  'php',
  'ruby',
  'swift',
  'kotlin',
  'html',
  'css',
  'sql',
  'bash',
  'json',
  'markdown',
];

export function ClipboardInput({ onCreate, isLoading }: ClipboardInputProps) {
  const [content, setContent] = useState('');
  const [contentType, setContentType] = useState<'text/plain' | 'text/code'>('text/plain');
  const [language, setLanguage] = useState('javascript');

  const maxLength = 100000;
  const isOverLimit = content.length > maxLength;
  const isEmpty = content.trim().length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEmpty || isOverLimit || isLoading) {
      return;
    }

    onCreate(content, contentType, contentType === 'text/code' ? language : undefined);
    setContent('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg shadow-md border border-gray-200 p-6"
    >
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setContentType('text/plain')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              contentType === 'text/plain'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Text
          </button>
          <button
            type="button"
            onClick={() => setContentType('text/code')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              contentType === 'text/code'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Code
          </button>
        </div>

        {contentType === 'text/code' && (
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={
          contentType === 'text/code'
            ? 'Paste your code here...'
            : 'Type or paste your text here...'
        }
        className="w-full h-40 px-4 py-3 bg-gray-50 text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
        disabled={isLoading}
      />

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm">
          <span
            className={`font-medium ${
              isOverLimit
                ? 'text-red-600'
                : content.length > maxLength * 0.9
                  ? 'text-yellow-600'
                  : 'text-gray-600'
            }`}
          >
            {content.length.toLocaleString()}
          </span>
          <span className="text-gray-500">
            {' '}
            / {maxLength.toLocaleString()} characters
          </span>
        </div>

        <button
          type="submit"
          disabled={isEmpty || isOverLimit || isLoading}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <PaperAirplaneIcon className="w-4 h-4" />
          {isLoading ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  );
}
