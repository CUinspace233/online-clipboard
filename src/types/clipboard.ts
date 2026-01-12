export interface ClipboardItem {
  id: number;
  content: string;
  content_type: 'text/plain' | 'text/code';
  language?: string;
  created_at: number;
  updated_at: number;
  metadata?: string;
}

export interface CreateClipboardItemData {
  content: string;
  content_type: 'text/plain' | 'text/code';
  language?: string;
  metadata?: Record<string, unknown>;
}
