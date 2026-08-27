import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  ArrowDown, ArrowUp, Bell, Check, ChevronDown, ChevronRight, Clock3, Cloud, CloudUpload,
  Download, File, FileImage, Folder, FolderOpen, Grid2X2, List, Loader2, LogOut, MoreHorizontal,
  Pencil, Plus, Search, Share2, ShieldCheck, Star, Trash2, Upload, UserPlus, X, RotateCcw, Settings, Moon, Sun,
} from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { useDrive, STORAGE_LIMIT_BYTES } from '@/lib/useDrive';
import type { Breadcrumb, UnifiedItem } from '@/lib/types';
import { fileColorFromKind, fileKindFromMime, formatBytes, formatRelativeTime } from '@/lib/types';
import { AuthScreen } from '@/components/AuthScreen';
import { ShareModal } from '@/components/ShareModal';
import { FilePreviewModal } from '@/components/FilePreviewModal';
import { PublicSharePage } from '@/components/PublicSharePage';
import { ProfileSettingsModal } from '@/components/ProfileSettingsModal';
import { NotificationsPanel } from '@/components/NotificationsPanel';

type View = 'My Drive' | 'Shared with me' | 'Recent' | 'Starred' | 'Trash';

function DriveApp() {
  const { session, profile, loading: authLoading, signIn, signUp, signOut, updateProfile, changePassword, updateAvatar } = useAuth();
  
  const [view, setView] = useState<View>('My Drive');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [layout, setLayout] = useState<'list' | 'grid'>('list');
  const [menuOpen, setMenuOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderError, setFolderError] = useState('');
  const [renameItem, setRenameItem] = useState<UnifiedItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [shareItem, setShareItem] = useState<UnifiedItem | null>(null);
  const [previewItem, setPreviewItem] = useState<UnifiedItem | null>(null);
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState<'success' | 'error'>('success');
  const [uploads, setUploads] = useState<{ name: string; percent: number }[]>([]);
  const [authBusy, setAuthBusy] = useState(false);
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');
  const fileRef = useRef<HTMLInputElement>(null);

  const userId = session?.user?.id;
  const drive = useDrive(userId, currentFolderId, view);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    setMenuOpen(false);
    setNewMenuOpen(false);
  }, [view, currentFolderId]);

  useEffect(() => {
    localStorage.setItem('darkMode', String(darkMode));
    document.documentElement.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);

  const showNotice = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setNotice(msg);
    setNoticeType(type);
  }, []);

  const visibleItems = useMemo(() => {
    const filtered = drive.items.filter((item) =>
      item.name.toLowerCase().includes(query.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    });
  }, [drive.items, query, sortAsc]);

  const handleAuth = async (email: string, password: string, name?: string) => {
    setAuthBusy(true);
    try {
      if (name !== undefined) await signUp(email, password, name);
      else await signIn(email, password);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCreateFolder = async (e: FormEvent) => {
    e.preventDefault();
    setFolderError('');
    try {
      await drive.createFolder(folderName);
      setFolderName('');
      setNewFolderOpen(false);
      setView('My Drive');
      showNotice('Folder created.');
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : 'Could not create folder.');
    }
  };

  const handleFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = '';
    setUploads(files.map((f) => ({ name: f.name, percent: 0 })));
    try {
      await drive.uploadFiles(files, (fileName, percent) => {
        setUploads((prev) => prev.map((u) => u.name === fileName ? { ...u, percent } : u));
      });
      setView('My Drive');
      showNotice(`${files.length} ${files.length === 1 ? 'file' : 'files'} uploaded.`);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Upload failed.', 'error');
    } finally {
      setTimeout(() => setUploads([]), 1500);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    setUploads(files.map((f) => ({ name: f.name, percent: 0 })));
    try {
      await drive.uploadFiles(files, (fileName, percent) => {
        setUploads((prev) => prev.map((u) => u.name === fileName ? { ...u, percent } : u));
      });
      setView('My Drive');
      showNotice(`${files.length} ${files.length === 1 ? 'file' : 'files'} uploaded.`);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Upload failed.', 'error');
    } finally {
      setTimeout(() => setUploads([]), 1500);
    }
  };

  const openItem = (item: UnifiedItem) => {
    if (item.kind === 'folder') {
      setCurrentFolderId(item.id);
      setView('My Drive');
    } else {
      setPreviewItem(item);
    }
  };

  const handleRename = async (e: FormEvent) => {
    e.preventDefault();
    if (!renameItem) return;
    try {
      await drive.renameItem(renameItem, renameValue);
      setRenameItem(null);
      showNotice('Renamed.');
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not rename.', 'error');
    }
  };

  const handleDownload = async (item: UnifiedItem) => {
    try { await drive.downloadFile(item); } catch (err) { showNotice(err instanceof Error ? err.message : 'Download failed.', 'error'); }
  };

  const handleDelete = async (item: UnifiedItem) => {
    try {
      await drive.moveToTrash(item);
      setPreviewItem(null);
      showNotice('Moved to trash.');
    } catch (err) { showNotice(err instanceof Error ? err.message : 'Could not delete.', 'error'); }
  };

  const handleRestore = async (item: UnifiedItem) => {
    try { await drive.restoreItem(item); showNotice('Restored.'); } catch (err) { showNotice(err instanceof Error ? err.message : 'Could not restore.', 'error'); }
  };

  const handlePermanentDelete = async (item: UnifiedItem) => {
    try { await drive.deletePermanently(item); showNotice('Deleted permanently.'); } catch (err) { showNotice(err instanceof Error ? err.message : 'Could not delete.', 'error'); }
  };

  const navigateCrumb = (crumb: Breadcrumb) => {
    if (crumb.id === null) {
      setCurrentFolderId(null);
    } else {
      setCurrentFolderId(crumb.id);
    }
  };

  if (authLoading) {
    return <div className="loading-screen"><Loader2 size={32} className="spin" /></div>;
  }

  if (!session) {
    return <AuthScreen onSignIn={(e, p) => handleAuth(e, p)} onSignUp={(e, p, n) => handleAuth(e, p, n)} busy={authBusy} />;
  }

  const storagePct = Math.min(100, (drive.storageUsedBytes / STORAGE_LIMIT_BYTES) * 100);
  const initials = (profile?.full_name || profile?.email || 'U').slice(0, 2).toUpperCase();
  const avatar = profile?.avatar_color?.startsWith('http') ? profile.avatar_color : null;

  return (
    <div className="app-shell" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Cloud size={19} strokeWidth={2.7} /></span><span>Cloudly</span></div>
        <div className="new-wrap">
          <button className="new-button" onClick={() => setNewMenuOpen((o) => !o)} disabled={view === 'Trash'}><Plus size={17} /> New <ChevronDown size={15} /></button>
          {newMenuOpen && view !== 'Trash' && (
            <div className="new-menu">
              <button type="button" onClick={() => { setNewMenuOpen(false); setNewFolderOpen(true); }}><Folder size={16} /> New folder</button>
              <button type="button" onClick={() => { setNewMenuOpen(false); fileRef.current?.click(); }}><Upload size={16} /> File upload</button>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" multiple hidden onChange={handleFiles} />
        <nav className="side-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {(['My Drive', 'Shared with me', 'Recent', 'Starred', 'Trash'] as View[]).map((navView) => (
            <button key={navView} className={`nav-item ${view === navView ? 'active' : ''}`} onClick={() => { setView(navView); setCurrentFolderId(null); }}>
              {navView === 'My Drive' && <FolderOpen size={18} />}
              {navView === 'Shared with me' && <UserPlus size={18} />}
              {navView === 'Recent' && <Clock3 size={18} />}
              {navView === 'Starred' && <Star size={18} />}
              {navView === 'Trash' && <Trash2 size={18} />}
              <span>{navView}</span>
            </button>
          ))}
          <p className="nav-label nav-label-spaced">Storage</p>
          <div className="storage-card">
            <div className="storage-head"><span><Cloud size={16} /> Storage</span><strong>{storagePct.toFixed(0)}%</strong></div>
            <div className="progress"><span style={{ width: `${storagePct}%` }} /></div>
            <p>{formatBytes(drive.storageUsedBytes)} of {formatBytes(STORAGE_LIMIT_BYTES)} used</p>
          </div>
        </nav>
        <div className="sidebar-bottom">
          <button className="help-link"><ShieldCheck size={16} /> Your files are private</button>
          <button className="profile-mini" onClick={() => setMenuOpen((o) => !o)}>
            <span className="avatar avatar-small">{avatar ? <img src={avatar} alt="" /> : initials}</span>
            <span className="profile-copy"><strong>{profile?.full_name || 'Your account'}</strong><small>{profile?.email}</small></span>
            <MoreHorizontal size={17} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="search-wrap"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search files and folders" /></div>
          <div className="top-actions">
            <button className="icon-button" onClick={() => setNotificationsOpen((o) => !o)} title="Notifications"><Bell size={19} /></button>
            <button className="icon-button" onClick={() => setDarkMode(!darkMode)} title="Toggle dark mode">{darkMode ? <Sun size={19} /> : <Moon size={19} />}</button>
            <button className="avatar avatar-header" onClick={() => setMenuOpen((o) => !o)}>{avatar ? <img src={avatar} alt="Profile" /> : initials}</button>
            {notificationsOpen && (
              <NotificationsPanel userId={userId} onClose={() => setNotificationsOpen(false)} />
            )}
            {menuOpen && (
              <div className="account-menu">
                <strong>{profile?.full_name || 'Your account'}</strong>
                <span>{profile?.email}</span>
                <hr />
                <button onClick={() => { setMenuOpen(false); setProfileSettingsOpen(true); }}><Settings size={15} /> Profile Settings</button>
                <button onClick={signOut}><LogOut size={15} /> Sign out</button>
              </div>
            )}
          </div>
        </header>

        <div className="workspace">
          <div className="page-heading">
            <div>
              <div className="eyebrow">Workspace / {view}</div>
              <h1>{view}</h1>
              <p>{view === 'My Drive' ? 'Everything you create and upload, all in one place.' : view === 'Trash' ? 'Restore items or delete them permanently.' : view === 'Shared with me' ? 'Files and folders others have shared with you.' : view === 'Recent' ? 'Files updated in the last 7 days.' : 'Your starred files and folders.'}</p>
            </div>
            {view !== 'Trash' && (
              <div className="heading-actions">
                <button className="outline-button" onClick={() => setNewFolderOpen(true)}><Folder size={16} /> New folder</button>
                <button className="primary-button" onClick={() => fileRef.current?.click()}><Upload size={16} /> Upload</button>
              </div>
            )}
            {view === 'Trash' && drive.items.length > 0 && (
              <div className="heading-actions">
                <button className="danger-button" onClick={async () => { await drive.emptyTrash(); showNotice('Trash emptied.'); }}><Trash2 size={16} /> Empty trash</button>
              </div>
            )}
          </div>

          {view === 'My Drive' && drive.breadcrumbs.length > 1 && (
            <div className="breadcrumbs">
              {drive.breadcrumbs.map((crumb, i) => (
                <span key={i} className="crumb-item">
                  {i > 0 && <ChevronRight size={14} />}
                  <button className={i === drive.breadcrumbs.length - 1 ? 'current' : ''} onClick={() => navigateCrumb(crumb)}>{crumb.name}</button>
                </span>
              ))}
            </div>
          )}

          {drive.error && <div className="error-banner">{drive.error}</div>}

          <div className="content-toolbar">
            <div className="toolbar-left">
              <strong>{view === 'My Drive' ? 'All files' : view}</strong>
              <span className="item-count">{visibleItems.length} {visibleItems.length === 1 ? 'item' : 'items'}</span>
            </div>
            <div className="toolbar-right">
              <button className="sort-button" onClick={() => setSortAsc((s) => !s)}><span>Sort</span> Name {sortAsc ? <ArrowDown size={14} /> : <ArrowUp size={14} />}</button>
              <div className="view-toggle">
                <button className={layout === 'list' ? 'selected' : ''} onClick={() => setLayout('list')}><List size={17} /></button>
                <button className={layout === 'grid' ? 'selected' : ''} onClick={() => setLayout('grid')}><Grid2X2 size={16} /></button>
              </div>
            </div>
          </div>

          {drive.loading ? (
            <div className="state-loading"><Loader2 size={24} className="spin" /></div>
          ) : visibleItems.length === 0 ? (
            <EmptyState view={view} onUpload={() => fileRef.current?.click()} onCreateFolder={() => setNewFolderOpen(true)} />
          ) : layout === 'list' ? (
            <div className="file-table">
              <div className="table-head">
                <span>Name</span><span>Owner</span><span>Last modified</span><span>File size</span><span />
              </div>
              {visibleItems.map((item) => (
                <FileRow
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  starred={drive.starredIds.has(item.id)}
                  isTrash={view === 'Trash'}
                  canEdit={!item.shared || item.sharedRole === 'editor'}
                  onOpen={() => openItem(item)}
                  onStar={() => drive.toggleStar(item)}
                  onShare={() => setShareItem(item)}
                  onRename={() => { setRenameItem(item); setRenameValue(item.name); }}
                  onDownload={() => handleDownload(item)}
                  onDelete={() => handleDelete(item)}
                  onRestore={() => handleRestore(item)}
                  onPermanentDelete={() => handlePermanentDelete(item)}
                />
              ))}
            </div>
          ) : (
            <div className="file-grid">
              {visibleItems.map((item) => (
                <FileCard
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  starred={drive.starredIds.has(item.id)}
                  isTrash={view === 'Trash'}
                  onOpen={() => openItem(item)}
                  onStar={() => drive.toggleStar(item)}
                  onShare={() => setShareItem(item)}
                  onDownload={() => handleDownload(item)}
                  onDelete={() => handleDelete(item)}
                  onRestore={() => handleRestore(item)}
                />
              ))}
            </div>
          )}

          {view === 'My Drive' && (
            <div className="dropzone" onClick={() => fileRef.current?.click()}>
              <div className="drop-icon"><CloudUpload size={21} /></div>
              <div><strong>Drop files here to upload</strong><span>or click to browse — up to 100 MB per file</span></div>
              <button>Browse files</button>
            </div>
          )}

          {uploads.length > 0 && (
            <div className="upload-tray">
              {uploads.map((u) => (
                <div className="upload-row" key={u.name}>
                  <File size={16} />
                  <span>{u.name}</span>
                  <div className="upload-bar"><span style={{ width: `${u.percent}%` }} /></div>
                  <strong>{u.percent}%</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {notice && <div className={`toast ${noticeType === 'error' ? 'toast-error' : ''}`}><span className="toast-check">{noticeType === 'error' ? <X size={14} /> : <Check size={14} />}</span>{notice}</div>}

      {newFolderOpen && (
        <Modal title="Create a new folder" onClose={() => { setNewFolderOpen(false); setFolderError(''); }}>
          <form onSubmit={handleCreateFolder} className="modal-form">
            <label>Folder name<input autoFocus value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="e.g. Client projects" /></label>
            {folderError && <p className="form-error">{folderError}</p>}
            <div className="modal-actions">
              <button type="button" className="outline-button" onClick={() => { setNewFolderOpen(false); setFolderError(''); }}>Cancel</button>
              <button className="primary-button" type="submit">Create folder</button>
            </div>
          </form>
        </Modal>
      )}

      {renameItem && (
        <Modal title="Rename" onClose={() => setRenameItem(null)}>
          <form onSubmit={handleRename} className="modal-form">
            <label>New name<input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} /></label>
            <div className="modal-actions">
              <button type="button" className="outline-button" onClick={() => setRenameItem(null)}>Cancel</button>
              <button className="primary-button" type="submit">Save</button>
            </div>
          </form>
        </Modal>
      )}

      {shareItem && (
        <ShareModal
          item={shareItem}
          onClose={() => setShareItem(null)}
          onCreateLink={(pw, hrs) => drive.createLinkShare(shareItem, pw, hrs)}
          onGetLinks={() => drive.getLinkShares(shareItem)}
          onRevokeLink={(id) => drive.revokeLinkShare(id)}
          onInvite={(email, role) => drive.inviteUser(shareItem, email, role)}
          onGetShares={() => drive.getShares(shareItem)}
          onRevokeShare={(id) => drive.revokeShare(id)}
        />
      )}

      {previewItem && (
        <FilePreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          onDownload={() => handleDownload(previewItem)}
          onDelete={() => handleDelete(previewItem)}
        />
      )}

      {profileSettingsOpen && (
        <ProfileSettingsModal
          profile={profile}
          onClose={() => setProfileSettingsOpen(false)}
          onUpdateProfile={(fullName) => updateProfile({ full_name: fullName })}
          onChangePassword={changePassword}
          onUpdateAvatar={updateAvatar}
          busy={authBusy}
        />
      )}
    </div>
  );
}

function EmptyState({ view, onUpload, onCreateFolder }: { view: string; onUpload: () => void; onCreateFolder: () => void }) {
  const isTrash = view === 'Trash';
  return (
    <div className="empty-state">
      <div className="empty-icon">{isTrash ? <Trash2 size={32} /> : <CloudUpload size={32} />}</div>
      <h3>{isTrash ? 'Trash is empty' : view === 'Shared with me' ? 'Nothing shared with you yet' : view === 'Starred' ? 'No starred items' : view === 'Recent' ? 'No recent activity' : 'This folder is empty'}</h3>
      <p>{isTrash ? 'Items you delete will appear here for recovery.' : view === 'My Drive' ? 'Upload files or create a folder to get started.' : 'Items will appear here when available.'}</p>
      {!isTrash && view === 'My Drive' && (
        <div className="empty-actions">
          <button className="outline-button" onClick={onCreateFolder}><Folder size={16} /> New folder</button>
          <button className="primary-button" onClick={onUpload}><Upload size={16} /> Upload files</button>
        </div>
      )}
    </div>
  );
}

function FileRow({ item, starred, isTrash, canEdit, onOpen, onStar, onShare, onRename, onDownload, onDelete, onRestore, onPermanentDelete }: {
  item: UnifiedItem; starred: boolean; isTrash: boolean; canEdit: boolean;
  onOpen: () => void; onStar: () => void; onShare: () => void; onRename: () => void; onDownload: () => void; onDelete: () => void; onRestore: () => void; onPermanentDelete: () => void;
}) {
  const kind = item.kind === 'folder' ? 'folder' : fileKindFromMime(item.mimeType ?? '', item.name);
  const color = fileColorFromKind(kind);
  return (
    <div className="file-row">
      <div className="name-cell" onClick={onOpen}>
        <div className={`file-symbol ${color}`}><ItemIcon kind={kind} /></div>
        <strong>{item.name}</strong>
        {starred && <Star size={13} className="star-filled" fill="currentColor" />}
        {item.shared && <Share2 size={12} className="shared-icon" />}
      </div>
      <div className="owner-cell"><span className="avatar avatar-tiny">{item.shared ? 'SH' : 'YO'}</span>{item.shared ? `Shared · ${item.sharedRole === 'editor' ? 'Editor' : 'Viewer'}` : 'You'}</div>
      <span className="muted-cell">{formatRelativeTime(item.updatedAt)}</span>
      <span className="muted-cell">{item.kind === 'folder' ? '—' : formatBytes(item.sizeBytes ?? 0)}</span>
      <div className="row-actions">
        {isTrash ? (
          <>
            <button title="Restore" onClick={onRestore}><RotateCcw size={15} /></button>
            <button title="Delete forever" onClick={onPermanentDelete}><Trash2 size={15} /></button>
          </>
        ) : (
          <>
            <button title="Star" onClick={onStar}><Star size={15} fill={starred ? 'currentColor' : 'none'} /></button>
            {item.kind === 'file' && <button title="Download" onClick={onDownload}><Download size={15} /></button>}
            {canEdit && <button title="Rename" onClick={onRename}><Pencil size={15} /></button>}
            {!item.shared && <button title="Share" onClick={onShare}><Share2 size={15} /></button>}
            {canEdit && <button title="Move to trash" onClick={onDelete}><Trash2 size={15} /></button>}
          </>
        )}
      </div>
    </div>
  );
}

function FileCard({ item, starred, isTrash, onOpen, onStar, onShare, onDownload, onDelete, onRestore }: {
  item: UnifiedItem; starred: boolean; isTrash: boolean;
  onOpen: () => void; onStar: () => void; onShare: () => void; onDownload: () => void; onDelete: () => void; onRestore: () => void;
}) {
  const kind = item.kind === 'folder' ? 'folder' : fileKindFromMime(item.mimeType ?? '', item.name);
  const color = fileColorFromKind(kind);
  return (
    <div className="file-card" onClick={onOpen}>
      <div className="card-top">
        <div className={`file-symbol large ${color}`}><ItemIcon kind={kind} /></div>
        {!isTrash && <button onClick={(e) => { e.stopPropagation(); onStar(); }}><Star size={16} fill={starred ? 'currentColor' : 'none'} /></button>}
      </div>
      <strong>{item.name}</strong>
      <span>{formatRelativeTime(item.updatedAt)} · {item.kind === 'folder' ? 'Folder' : formatBytes(item.sizeBytes ?? 0)}</span>
      {!isTrash ? (
        <div className="card-actions">
          {item.kind === 'file' && <button className="card-action" onClick={(e) => { e.stopPropagation(); onDownload(); }}><Download size={14} /></button>}
          <button className="card-action" onClick={(e) => { e.stopPropagation(); onShare(); }}><Share2 size={14} /></button>
          <button className="card-action" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Trash2 size={14} /></button>
        </div>
      ) : (
        <div className="card-actions">
          <button className="card-action" onClick={(e) => { e.stopPropagation(); onRestore(); }}><RotateCcw size={14} /></button>
        </div>
      )}
    </div>
  );
}

function ItemIcon({ kind }: { kind: string }) {
  if (kind === 'folder') return <Folder size={19} fill="currentColor" strokeWidth={2.1} />;
  if (kind === 'image') return <FileImage size={19} strokeWidth={2.1} />;
  return <File size={19} strokeWidth={2.1} />;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-title"><h2>{title}</h2><button onClick={onClose}><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

function App() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const publicShareMatch = pathname.match(/^\/s\/([a-zA-Z0-9-_]+)$/);
  return publicShareMatch ? <PublicSharePage token={publicShareMatch[1]} /> : <DriveApp />;
}

export default App;
