'use client';

import { useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

export function formatJsonForDisplay(content: string) {
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

interface ClipboardContentProps {
  content: string;
  contentType: 'text/plain' | 'text/code';
  language?: string;
  mode?: 'preview' | 'immersive';
  isExpanded?: boolean;
  isJsonFormatted?: boolean;
}

export function ClipboardContent({
  content,
  contentType,
  language,
  mode = 'preview',
  isExpanded = true,
  isJsonFormatted = false,
}: ClipboardContentProps) {
  const formattedJson = useMemo(() => formatJsonForDisplay(content), [content]);
  const hasJsonFormat = formattedJson !== null;
  const shouldRenderFormattedJson = isJsonFormatted && hasJsonFormat;
  const contentForDisplay =
    shouldRenderFormattedJson && formattedJson !== null ? formattedJson : content;

  const maxHeight =
    mode === 'immersive' ? 'calc(100vh - 15rem)' : isExpanded ? 'none' : '400px';
  const plainTextClassName =
    mode === 'immersive'
      ? 'whitespace-pre-wrap font-mono text-sm text-gray-800 bg-gray-50 p-5 rounded-lg overflow-auto border border-gray-200'
      : 'whitespace-pre-wrap font-mono text-sm text-gray-800 bg-gray-50 p-4 rounded overflow-auto max-h-96';

  if (shouldRenderFormattedJson) {
    return (
      <>
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
            {contentForDisplay}
          </SyntaxHighlighter>
        </div>
      </>
    );
  }

  if (contentType === 'text/code' && language) {
    if (language === 'markdown') {
      return (
        <>
          <div
            className="prose prose-sm prose-slate max-w-none bg-white p-4 rounded-lg border border-gray-200 overflow-auto prose-ul:list-disc prose-ol:list-decimal prose-li:ml-4"
            style={{ maxHeight }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{contentForDisplay}</ReactMarkdown>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="rounded-lg overflow-hidden border border-gray-200">
          <SyntaxHighlighter
            language={language}
            style={oneLight}
            customStyle={{
              ...syntaxHighlighterCustomStyle,
              maxHeight,
              overflow: 'auto',
            }}
            lineNumberStyle={syntaxLineNumberStyle}
            showLineNumbers
          >
            {contentForDisplay}
          </SyntaxHighlighter>
        </div>
      </>
    );
  }

  return (
    <>
      <pre className={plainTextClassName} style={{ maxHeight }}>
        {contentForDisplay}
      </pre>
    </>
  );
}
