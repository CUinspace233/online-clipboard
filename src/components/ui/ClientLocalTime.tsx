'use client';

import { useEffect, useState } from 'react';

interface ClientLocalTimeProps {
  timestamp: number;
  className?: string;
}

const formatOptions: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

export function ClientLocalTime({ timestamp, className }: ClientLocalTimeProps) {
  const iso = new Date(timestamp).toISOString();
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(new Date(timestamp).toLocaleString(undefined, formatOptions));
  }, [timestamp]);

  return (
    <time dateTime={iso} className={className}>
      {label ?? <span className="inline-block h-4 w-28 animate-pulse rounded bg-gray-200" />}
    </time>
  );
}
