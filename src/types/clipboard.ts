export interface ClipboardItem {
  id: number;
  content: string;
  content_type: 'text/plain' | 'text/code';
  language?: string;
  created_at: number;
  updated_at: number;
  metadata?: string;
  share_token?: string | null;
}

export interface SharedClipboardItem {
  content: string;
  content_type: 'text/plain' | 'text/code';
  language?: string;
  created_at: number;
}

export interface CreateClipboardItemData {
  content: string;
  content_type: 'text/plain' | 'text/code';
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateClipboardItemData {
  content: string;
  content_type: 'text/plain' | 'text/code';
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface ClipboardItemsResponse {
  items: ClipboardItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
