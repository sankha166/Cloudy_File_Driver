export type ResourceKind = 'file' | 'folder';
export type FileKind = 'folder' | 'pdf' | 'image' | 'spreadsheet' | 'document' | 'archive' | 'other';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_color: string;
  created_at: string;
}

export interface FolderRow {
  id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface FileRow {
  id: string;
  owner_id: string;
  folder_id: string | null;
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  version_id: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface StarRow {
  user_id: string;
  resource_type: ResourceKind;
  resource_id: string;
  created_at: string;
}

export interface ShareRow {
  id: string;
  resource_type: ResourceKind;
  resource_id: string;
  grantee_user_id: string;
  role: 'viewer' | 'editor';
  created_by: string;
  created_at: string;
}

export interface LinkShareRow {
  id: string;
  resource_type: ResourceKind;
  resource_id: string;
  token: string;
  password_hash: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
}

export interface ActivityRow {
  id: string;
  actor_id: string;
  action: string;
  resource_type: ResourceKind;
  resource_id: string;
  context: Record<string, unknown>;
  created_at: string;
}

export interface UnifiedItem {
  id: string;
  kind: ResourceKind;
  name: string;
  parentId: string | null;
  mimeType?: string;
  sizeBytes?: number;
  storageKey?: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  starred: boolean;
  shared: boolean;
  sharedRole?: 'viewer' | 'editor';
  ownerId: string;
}

export interface Breadcrumb {
  id: string | null;
  name: string;
}

export function fileKindFromMime(mime: string, name: string): FileKind {
  if (mime.includes('image/')) return 'image';
  if (mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (mime.includes('spreadsheet') || name.match(/\.(xlsx|xls|csv)$/i)) return 'spreadsheet';
  if (mime.includes('word') || mime.includes('presentation') || name.match(/\.(docx?|pptx?|key|pages|txt|md|json|rtf)$/i)) return 'document';
  if (mime.includes('zip') || mime.includes('compressed') || name.match(/\.(zip|rar|7z|tar|gz)$/i)) return 'archive';
  return 'other';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatRelativeTime(iso: string): string {
  const now = new Date();
  const date = new Date(iso);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return diffHr === 1 ? '1 hour ago' : `${diffHr} hours ago`;
  if (diffDay < 7) return diffDay === 1 ? 'Yesterday' : `${diffDay} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: diffDay > 365 ? 'numeric' : undefined });
}

export function fileColorFromKind(kind: FileKind): string {
  const map: Record<FileKind, string> = {
    folder: 'blue',
    pdf: 'red',
    image: 'sky',
    spreadsheet: 'green',
    document: 'violet',
    archive: 'orange',
    other: 'slate',
  };
  return map[kind] ?? 'slate';
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 180);
}
