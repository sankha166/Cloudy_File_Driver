import { useEffect, useState } from 'react';
import { Cloud, Download, FileImage, FileText, Loader2, Lock, Eye, EyeOff, File } from 'lucide-react';
import type { UnifiedItem } from '@/lib/types';
import { fileKindFromMime, formatBytes, formatRelativeTime } from '@/lib/types';
import { supabase } from '@/lib/supabase';

type PublicLink = { resource_type: 'file' | 'folder'; resource_id: string; expires_at: string | null; password_protected: boolean };

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export function PublicSharePage({ token }: { token: string }) {
  const [item, setItem] = useState<UnifiedItem | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [accessGranted, setAccessGranted] = useState(false);
  const [folderItems, setFolderItems] = useState<UnifiedItem[]>([]);

  useEffect(() => {
    verifyAndLoadLink();
  }, [token]);

  const verifyAndLoadLink = async () => {
    try {
      const { data: linkShareData, error: linkError } = await supabase
        .rpc('resolve_link_share', { p_token: token })
        .maybeSingle();
      const linkShare = linkShareData as PublicLink | null;

      if (linkError || !linkShare) {
        setError('Share link not found or has expired.');
        setLoading(false);
        return;
      }

      if (linkShare.expires_at && new Date(linkShare.expires_at) < new Date()) {
        setError('This share link has expired.');
        setLoading(false);
        return;
      }

      if (linkShare.password_protected) {
        setPasswordProtected(true);
        setLoading(false);
        return;
      }

      await loadSharedItem(linkShare);
    } catch {
      setError('Failed to load shared item.');
      setLoading(false);
    }
  };

  const loadSharedItem = async (linkShare: PublicLink, password?: string) => {
    try {
      let itemData: UnifiedItem | null = null;

      if (linkShare.resource_type === 'file') {
        const { data: fileRow, error: fileError } = await supabase
          .from('files')
          .select('*')
          .eq('id', linkShare.resource_id)
          .maybeSingle();

        if (fileError || !fileRow) {
          setError('File not found.');
          setLoading(false);
          return;
        }

        itemData = {
          id: fileRow.id,
          kind: 'file',
          name: fileRow.name,
          parentId: fileRow.folder_id,
          mimeType: fileRow.mime_type,
          sizeBytes: fileRow.size_bytes,
          storageKey: fileRow.storage_key,
          isDeleted: fileRow.is_deleted,
          createdAt: fileRow.created_at,
          updatedAt: fileRow.updated_at,
          starred: false,
          shared: true,
          ownerId: fileRow.owner_id,
        };

        const params = new URLSearchParams({ token });
        if (password) params.set('password', password);
        const shareResponse = await fetch(`${supabaseUrl}/functions/v1/download-share?${params.toString()}`, {
          headers: { apikey: supabaseAnonKey },
        });
        const shareData = await shareResponse.json() as { download_url?: string; error?: string; requires_password?: boolean };
        if (!shareResponse.ok || !shareData.download_url) {
          setError(shareData.requires_password ? 'Enter the link password to continue.' : shareData.error || 'Could not load the shared file.');
          setLoading(false);
          return;
        }
        setUrl(shareData.download_url);
      } else if (linkShare.resource_type === 'folder') {
        const { data: folderRow, error: folderError } = await supabase
          .from('folders')
          .select('*')
          .eq('id', linkShare.resource_id)
          .maybeSingle();

        if (folderError || !folderRow) {
          setError('Folder not found.');
          setLoading(false);
          return;
        }

        itemData = {
          id: folderRow.id,
          kind: 'folder',
          name: folderRow.name,
          parentId: folderRow.parent_id,
          isDeleted: folderRow.is_deleted,
          createdAt: folderRow.created_at,
          updatedAt: folderRow.updated_at,
          starred: false,
          shared: true,
          ownerId: folderRow.owner_id,
        };
        const [{ data: files }, { data: folders }] = await Promise.all([
          supabase.from('files').select('*').eq('folder_id', folderRow.id).eq('is_deleted', false),
          supabase.from('folders').select('*').eq('parent_id', folderRow.id).eq('is_deleted', false),
        ]);
        setFolderItems([
          ...(folders ?? []).map((folder) => ({ id: folder.id, kind: 'folder' as const, name: folder.name, parentId: folder.parent_id, isDeleted: folder.is_deleted, createdAt: folder.created_at, updatedAt: folder.updated_at, starred: false, shared: true, ownerId: folder.owner_id })),
          ...(files ?? []).map((file) => ({ id: file.id, kind: 'file' as const, name: file.name, parentId: file.folder_id, mimeType: file.mime_type, sizeBytes: file.size_bytes, storageKey: file.storage_key, isDeleted: file.is_deleted, createdAt: file.created_at, updatedAt: file.updated_at, starred: false, shared: true, ownerId: file.owner_id })),
        ]);
      }

      if (itemData) {
        setItem(itemData);
        setAccessGranted(true);
      }
    } catch {
      setError('Failed to load shared item.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    try {
      const { data: linkShareData, error: linkError } = await supabase
        .rpc('resolve_link_share', { p_token: token })
        .maybeSingle();
      const linkShare = linkShareData as PublicLink | null;

      if (linkError || !linkShare) {
        setPasswordError('Link not found.');
        return;
      }

      // Simple password verification (server should handle this)
      const { data: passwordMatch, error: passwordError } = await supabase.rpc('verify_link_share_password', { p_token: token, p_password: passwordInput });
      if (passwordError) throw passwordError;
      if (!passwordMatch) {
        setPasswordError('Incorrect password.');
        return;
      }

      setAccessGranted(true);
      await loadSharedItem(linkShare, passwordInput);
    } catch {
      setPasswordError('Failed to verify password.');
    }
  };


  const handleDownload = async () => {
    if (!item || !url) return;
    setDownloading(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = item.name;
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      setError('Download failed.');
    } finally {
      setDownloading(false);
    }
  };

  const isImage = item && fileKindFromMime(item.mimeType ?? '', item.name) === 'image';
  const isPdf = item && fileKindFromMime(item.mimeType ?? '', item.name) === 'pdf';
  const isText = item && fileKindFromMime(item.mimeType ?? '', item.name) === 'document';
  const isVideo = item && (item.mimeType?.startsWith('video/') || /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(item.name));

  return (
    <div className="public-share-page">
      <div className="share-header">
        <div className="brand"><span className="brand-mark"><Cloud size={20} strokeWidth={2.7} /></span><span>Cloudly</span></div>
      </div>

      {loading ? (
        <div className="share-content-center">
          <Loader2 size={32} className="spin" />
          <p>Loading shared item...</p>
        </div>
      ) : error ? (
        <div className="share-content-center">
          <div className="error-box">
            <h2>Access Denied</h2>
            <p>{error}</p>
          </div>
        </div>
      ) : passwordProtected && !accessGranted ? (
        <div className="share-content-center">
          <div className="password-box">
            <h2>This item is password protected</h2>
            <form onSubmit={handlePasswordSubmit} className="password-form">
              <label className="password-field">
                <span>Enter password</span>
                <div className="pw-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Password"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              {passwordError && <p className="form-error">{passwordError}</p>}
              <button type="submit" className="primary-button full-button">Unlock</button>
            </form>
          </div>
        </div>
      ) : item && accessGranted ? (
        <div className="share-content">
          <div className="share-preview">
            {item.kind === 'file' ? (
              <>
                {isImage && url && (
                  <img src={url} alt={item.name} className="preview-image" />
                )}
                {isPdf && url && (
                  <iframe
                    src={`${url}#toolbar=0`}
                    className="preview-pdf"
                    title="PDF Preview"
                  />
                )}
                {isVideo && url && (
                  <video src={url} className="preview-video" controls playsInline />
                )}
                {isText && url && (
                  <iframe
                    src={url}
                    className="preview-text"
                    title="Document Preview"
                    sandbox="allow-same-origin"
                  />
                )}
                {!isImage && !isPdf && !isVideo && !isText && (
                  <div className="preview-fallback">
                    <File size={48} />
                    <p>{item.name}</p>
                    <span>{formatBytes(item.sizeBytes ?? 0)}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="public-folder-list">
                <div className="preview-fallback"><FileImage size={48} /><p>Folder: {item.name}</p></div>
                {folderItems.length > 0 && <div className="public-folder-items">{folderItems.map((child) => <div key={`${child.kind}-${child.id}`} className="public-folder-item"><FileText size={16} /><span>{child.name}</span><small>{child.kind === 'file' ? formatBytes(child.sizeBytes ?? 0) : 'Folder'}</small></div>)}</div>}
              </div>
            )}
          </div>

          <div className="share-info">
            <div className="info-card">
              <h2>{item.name}</h2>
              <div className="info-row">
                <span>Type:</span>
                <strong>{item.kind === 'folder' ? 'Folder' : 'File'}</strong>
              </div>
              {item.sizeBytes && (
                <div className="info-row">
                  <span>Size:</span>
                  <strong>{formatBytes(item.sizeBytes)}</strong>
                </div>
              )}
              <div className="info-row">
                <span>Modified:</span>
                <strong>{formatRelativeTime(item.updatedAt)}</strong>
              </div>

              <div className="share-actions">
                {item.kind === 'file' && url && (
                  <button
                    className="primary-button full-button"
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    {downloading ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
                    Download
                  </button>
                )}
                {passwordProtected && <p className="security-note"><Lock size={14} /> Password protected</p>}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="share-content-center">
          <Loader2 size={32} className="spin" />
        </div>
      )}
    </div>
  );
}
