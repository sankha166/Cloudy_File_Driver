import { useEffect, useState } from 'react';
import { Cloud, Download, FileImage, FileText, Loader2, Lock, Eye, EyeOff, X, File } from 'lucide-react';
import type { UnifiedItem } from '@/lib/types';
import { fileKindFromMime, formatBytes, formatRelativeTime } from '@/lib/types';
import { supabase } from '@/lib/supabase';

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

  useEffect(() => {
    verifyAndLoadLink();
  }, [token]);

  const verifyAndLoadLink = async () => {
    try {
      const { data: linkShare, error: linkError } = await supabase
        .from('link_shares')
        .select('*')
        .eq('token', token)
        .maybeSingle();

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

      if (linkShare.password_hash) {
        setPasswordProtected(true);
        setLoading(false);
        return;
      }

      await loadSharedItem(linkShare);
    } catch (err) {
      setError('Failed to load shared item.');
      setLoading(false);
    }
  };

  const loadSharedItem = async (linkShare: any) => {
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

        if (fileRow.storage_key) {
          const { data, error } = await supabase.storage
            .from('drive-files')
            .createSignedUrl(fileRow.storage_key, 3600);
          if (!error && data) setUrl(data.signedUrl);
        }
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
      }

      if (itemData) {
        setItem(itemData);
        setAccessGranted(true);
      }
    } catch (err) {
      setError('Failed to load shared item.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    try {
      const { data: linkShare, error: linkError } = await supabase
        .from('link_shares')
        .select('password_hash')
        .eq('token', token)
        .maybeSingle();

      if (linkError || !linkShare) {
        setPasswordError('Link not found.');
        return;
      }

      // Simple password verification (server should handle this)
      const passwordMatch = await verifyPassword(passwordInput, linkShare.password_hash);
      if (!passwordMatch) {
        setPasswordError('Incorrect password.');
        return;
      }

      setAccessGranted(true);
      const { data: fullLink } = await supabase
        .from('link_shares')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (fullLink) {
        await loadSharedItem(fullLink);
      }
    } catch (err) {
      setPasswordError('Failed to verify password.');
    }
  };

  const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
    // In production, use bcrypt comparison on the server
    // For now, this is a placeholder - implement server-side verification
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === hash;
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
    } catch (err) {
      setError('Download failed.');
    } finally {
      setDownloading(false);
    }
  };

  const isImage = item && fileKindFromMime(item.mimeType ?? '', item.name) === 'image';
  const isPdf = item && fileKindFromMime(item.mimeType ?? '', item.name) === 'pdf';
  const isText = item && fileKindFromMime(item.mimeType ?? '', item.name) === 'document';

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
                {isText && url && (
                  <iframe
                    src={url}
                    className="preview-text"
                    title="Document Preview"
                    sandbox="allow-same-origin"
                  />
                )}
                {!isImage && !isPdf && !isText && (
                  <div className="preview-fallback">
                    <File size={48} />
                    <p>{item.name}</p>
                    <span>{formatBytes(item.sizeBytes ?? 0)}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="preview-fallback">
                <FileImage size={48} />
                <p>Folder: {item.name}</p>
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
