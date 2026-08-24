import { useCallback, useEffect, useState } from 'react';
import { supabase, MAX_FILE_SIZE, ACCEPTED_TYPES } from './supabase';
import type { ActivityRow, Breadcrumb, FileRow, FolderRow, LinkShareRow, ShareRow, StarRow, UnifiedItem } from './types';
import { sanitizeFileName } from './types';

export interface DriveState {
  items: UnifiedItem[];
  loading: boolean;
  error: string;
  breadcrumbs: Breadcrumb[];
  starredIds: Set<string>;
  storageUsedBytes: number;
  activities: ActivityRow[];
}

const STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;

function toUnified(
  files: FileRow[],
  folders: FolderRow[],
  stars: StarRow[],
  shares: ShareRow[],
): UnifiedItem[] {
  const starredFileIds = new Set(stars.filter((s) => s.resource_type === 'file').map((s) => s.resource_id));
  const starredFolderIds = new Set(stars.filter((s) => s.resource_type === 'folder').map((s) => s.resource_id));
  const sharedFileIds = new Set(shares.filter((s) => s.resource_type === 'file').map((s) => s.resource_id));
  const sharedFolderIds = new Set(shares.filter((s) => s.resource_type === 'folder').map((s) => s.resource_id));

  const folderItems: UnifiedItem[] = folders.map((f) => ({
    id: f.id,
    kind: 'folder',
    name: f.name,
    parentId: f.parent_id,
    isDeleted: f.is_deleted,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
    starred: starredFolderIds.has(f.id),
    shared: sharedFolderIds.has(f.id),
    ownerId: f.owner_id,
  }));

  const fileItems: UnifiedItem[] = files.map((f) => ({
    id: f.id,
    kind: 'file',
    name: f.name,
    parentId: f.folder_id,
    mimeType: f.mime_type,
    sizeBytes: f.size_bytes,
    storageKey: f.storage_key,
    isDeleted: f.is_deleted,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
    starred: starredFileIds.has(f.id),
    shared: sharedFileIds.has(f.id),
    ownerId: f.owner_id,
  }));

  return [...folderItems, ...fileItems];
}

export function useDrive(userId: string | undefined, currentFolderId: string | null, view: string) {
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: null, name: 'My Drive' }]);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [storageUsedBytes, setStorageUsedBytes] = useState(0);
  const [activities, setActivities] = useState<ActivityRow[]>([]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');

    const isTrashView = view === 'Trash';
    const isSharedView = view === 'Shared with me';
    const isStarredView = view === 'Starred';
    const isRecentView = view === 'Recent';

    try {
      if (isSharedView) {
        const { data: shares } = await supabase.from('shares').select('resource_type, resource_id').eq('grantee_user_id', userId);
        const fileIds = (shares ?? []).filter((s) => s.resource_type === 'file').map((s) => s.resource_id);
        const folderIds = (shares ?? []).filter((s) => s.resource_type === 'folder').map((s) => s.resource_id);
        const [filesRes, foldersRes] = await Promise.all([
          fileIds.length ? supabase.from('files').select('*').in('id', fileIds).eq('is_deleted', false) : Promise.resolve({ data: [] as FileRow[] | null }),
          folderIds.length ? supabase.from('folders').select('*').in('id', folderIds).eq('is_deleted', false) : Promise.resolve({ data: [] as FolderRow[] | null }),
        ]);
        const { data: stars } = await supabase.from('stars').select('*').eq('user_id', userId);
        setItems(toUnified(filesRes.data ?? [], foldersRes.data ?? [], stars ?? [], (shares ?? []) as ShareRow[]));
        setStarredIds(new Set((stars ?? []).map((s) => s.resource_id)));
        setBreadcrumbs([{ id: null, name: 'Shared with me' }]);
      } else if (isStarredView) {
        const { data: stars } = await supabase.from('stars').select('*').eq('user_id', userId);
        const fileIds = (stars ?? []).filter((s) => s.resource_type === 'file').map((s) => s.resource_id);
        const folderIds = (stars ?? []).filter((s) => s.resource_type === 'folder').map((s) => s.resource_id);
        const [filesRes, foldersRes] = await Promise.all([
          fileIds.length ? supabase.from('files').select('*').in('id', fileIds).eq('is_deleted', false) : Promise.resolve({ data: [] as FileRow[] | null }),
          folderIds.length ? supabase.from('folders').select('*').in('id', folderIds).eq('is_deleted', false) : Promise.resolve({ data: [] as FolderRow[] | null }),
        ]);
        setItems(toUnified(filesRes.data ?? [], foldersRes.data ?? [], stars ?? [], []));
        setStarredIds(new Set((stars ?? []).map((s) => s.resource_id)));
        setBreadcrumbs([{ id: null, name: 'Starred' }]);
      } else if (isTrashView) {
        const [filesRes, foldersRes, starsRes] = await Promise.all([
          supabase.from('files').select('*').eq('owner_id', userId).eq('is_deleted', true),
          supabase.from('folders').select('*').eq('owner_id', userId).eq('is_deleted', true),
          supabase.from('stars').select('*').eq('user_id', userId),
        ]);
        setItems(toUnified(filesRes.data ?? [], foldersRes.data ?? [], starsRes.data ?? [], []));
        setStarredIds(new Set((starsRes.data ?? []).map((s) => s.resource_id)));
        setBreadcrumbs([{ id: null, name: 'Trash' }]);
      } else if (isRecentView) {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const [filesRes, starsRes] = await Promise.all([
          supabase.from('files').select('*').eq('owner_id', userId).eq('is_deleted', false).gte('updated_at', since).order('updated_at', { ascending: false }).limit(50),
          supabase.from('stars').select('*').eq('user_id', userId),
        ]);
        setItems(toUnified(filesRes.data ?? [], [], starsRes.data ?? [], []));
        setStarredIds(new Set((starsRes.data ?? []).map((s) => s.resource_id)));
        setBreadcrumbs([{ id: null, name: 'Recent' }]);
      } else {
        const [filesRes, foldersRes, starsRes, sharesRes] = await Promise.all([
          supabase.from('files').select('*').eq('owner_id', userId).eq('is_deleted', false).eq('folder_id', currentFolderId),
          supabase.from('folders').select('*').eq('owner_id', userId).eq('is_deleted', false).eq('parent_id', currentFolderId),
          supabase.from('stars').select('*').eq('user_id', userId),
          supabase.from('shares').select('*').eq('created_by', userId),
        ]);
        setItems(toUnified(filesRes.data ?? [], foldersRes.data ?? [], starsRes.data ?? [], sharesRes.data ?? []));
        setStarredIds(new Set((starsRes.data ?? []).map((s) => s.resource_id)));

        if (currentFolderId) {
          const crumbs: Breadcrumb[] = [];
          let curId: string | null = currentFolderId;
          while (curId) {
            const { data: folder } = await supabase.from('folders').select('id, name, parent_id').eq('id', curId).maybeSingle() as { data: { id: string; name: string; parent_id: string | null } | null };
            if (!folder) break;
            crumbs.unshift({ id: folder.id, name: folder.name });
            curId = folder.parent_id;
          }
          setBreadcrumbs([{ id: null, name: 'My Drive' }, ...crumbs]);
        } else {
          setBreadcrumbs([{ id: null, name: 'My Drive' }]);
        }
      }

      const { count } = await supabase.from('files').select('*', { count: 'exact', head: true }).eq('owner_id', userId).eq('is_deleted', false);
      const { data: sizeData } = await supabase.from('files').select('size_bytes').eq('owner_id', userId).eq('is_deleted', false);
      const totalBytes = (sizeData ?? []).reduce((sum, f) => sum + (f.size_bytes ?? 0), 0);
      setStorageUsedBytes(totalBytes);
      void count;

      const { data: acts } = await supabase.from('activities').select('*').eq('actor_id', userId).order('created_at', { ascending: false }).limit(8);
      setActivities(acts ?? []);
    } catch {
      setError('Could not load your files. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId, currentFolderId, view]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createFolder = useCallback(async (name: string): Promise<void> => {
    if (!userId) return;
    const clean = name.trim();
    if (!clean) throw new Error('Folder name cannot be empty.');
    const { error: insertError } = await supabase.from('folders').insert({
      owner_id: userId,
      parent_id: currentFolderId,
      name: clean,
    });
    if (insertError) {
      if (insertError.code === '23505') throw new Error('A folder with this name already exists here.');
      throw new Error('Could not create the folder.');
    }
    await supabase.from('activities').insert({ actor_id: userId, action: 'create_folder', resource_type: 'folder', resource_id: '00000000-0000-0000-0000-000000000000', context: { name: clean } });
    await refresh();
  }, [userId, currentFolderId, refresh]);

  const uploadFiles = useCallback(async (files: File[], onProgress?: (fileName: string, percent: number) => void): Promise<void> => {
    if (!userId) return;
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name} exceeds the 100 MB limit.`);
      if (!ACCEPTED_TYPES.some((t) => t.endsWith('/*') ? file.type.startsWith(t.slice(0, -1)) : t === file.type)) {
        throw new Error(`${file.name}: this file type is not supported.`);
      }
    }
    for (const file of files) {
      const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
      const storageKey = `${userId}/${crypto.randomUUID()}${sanitizeFileName(file.name).slice(0, 80)}${ext}`;
      onProgress?.(file.name, 0);
      const { error: uploadError } = await supabase.storage.from('drive-files').upload(storageKey, file, { contentType: file.type });
      if (uploadError) throw new Error(`Could not upload ${file.name}.`);
      onProgress?.(file.name, 100);
      const { data: fileRec, error: fileError } = await supabase.from('files').insert({
        owner_id: userId,
        folder_id: currentFolderId,
        name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        storage_key: storageKey,
      }).select('*').maybeSingle();
      if (fileError || !fileRec) throw new Error(`Could not save ${file.name} metadata.`);
      await supabase.from('file_versions').insert({
        file_id: fileRec.id,
        version_number: 1,
        storage_key: storageKey,
        size_bytes: file.size,
      });
      await supabase.from('activities').insert({ actor_id: userId, action: 'upload', resource_type: 'file', resource_id: fileRec.id, context: { name: file.name, size: file.size } });
    }
    await refresh();
  }, [userId, currentFolderId, refresh]);

  const renameItem = useCallback(async (item: UnifiedItem, newName: string): Promise<void> => {
    if (!userId) return;
    const clean = newName.trim();
    if (!clean) throw new Error('Name cannot be empty.');
    const table = item.kind === 'folder' ? 'folders' : 'files';
    const { error } = await supabase.from(table).update({ name: clean, updated_at: new Date().toISOString() }).eq('id', item.id).eq('owner_id', userId);
    if (error) throw new Error('Could not rename. The name may already be in use.');
    await supabase.from('activities').insert({ actor_id: userId, action: 'rename', resource_type: item.kind, resource_id: item.id, context: { name: clean } });
    await refresh();
  }, [userId, refresh]);

  const toggleStar = useCallback(async (item: UnifiedItem): Promise<void> => {
    if (!userId) return;
    const existing = starredIds.has(item.id);
    if (existing) {
      await supabase.from('stars').delete().eq('user_id', userId).eq('resource_type', item.kind).eq('resource_id', item.id);
    } else {
      await supabase.from('stars').insert({ user_id: userId, resource_type: item.kind, resource_id: item.id });
    }
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (existing) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    await refresh();
  }, [userId, starredIds, refresh]);

  const moveToTrash = useCallback(async (item: UnifiedItem): Promise<void> => {
    if (!userId) return;
    const table = item.kind === 'folder' ? 'folders' : 'files';
    const { error } = await supabase.from(table).update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', item.id).eq('owner_id', userId);
    if (error) throw new Error('Could not move to trash.');
    await supabase.from('activities').insert({ actor_id: userId, action: 'delete', resource_type: item.kind, resource_id: item.id, context: { name: item.name } });
    await refresh();
  }, [userId, refresh]);

  const restoreItem = useCallback(async (item: UnifiedItem): Promise<void> => {
    if (!userId) return;
    const table = item.kind === 'folder' ? 'folders' : 'files';
    const { error } = await supabase.from(table).update({ is_deleted: false, updated_at: new Date().toISOString() }).eq('id', item.id).eq('owner_id', userId);
    if (error) throw new Error('Could not restore.');
    await supabase.from('activities').insert({ actor_id: userId, action: 'restore', resource_type: item.kind, resource_id: item.id, context: { name: item.name } });
    await refresh();
  }, [userId, refresh]);

  const deletePermanently = useCallback(async (item: UnifiedItem): Promise<void> => {
    if (!userId) return;
    if (item.kind === 'file' && item.storageKey) {
      await supabase.storage.from('drive-files').remove([item.storageKey]);
    }
    const table = item.kind === 'folder' ? 'folders' : 'files';
    const { error } = await supabase.from(table).delete().eq('id', item.id).eq('owner_id', userId);
    if (error) throw new Error('Could not delete permanently.');
    await refresh();
  }, [userId, refresh]);

  const emptyTrash = useCallback(async (): Promise<void> => {
    if (!userId) return;
    const { data: trashFiles } = await supabase.from('files').select('id, storage_key').eq('owner_id', userId).eq('is_deleted', true);
    if (trashFiles && trashFiles.length) {
      await supabase.storage.from('drive-files').remove(trashFiles.map((f) => f.storage_key));
      await supabase.from('files').delete().in('id', trashFiles.map((f) => f.id));
    }
    await supabase.from('folders').delete().eq('owner_id', userId).eq('is_deleted', true);
    await refresh();
  }, [userId, refresh]);

  const downloadFile = useCallback(async (item: UnifiedItem): Promise<void> => {
    if (!item.storageKey) return;
    const { data, error } = await supabase.storage.from('drive-files').createSignedUrl(item.storageKey, 300);
    if (error || !data) throw new Error('Could not generate download link.');
    window.open(data.signedUrl, '_blank');
    if (userId) await supabase.from('activities').insert({ actor_id: userId, action: 'download', resource_type: 'file', resource_id: item.id, context: { name: item.name } });
  }, [userId]);

  const createLinkShare = useCallback(async (item: UnifiedItem, password?: string, expiresInHours?: number): Promise<string> => {
    if (!userId) return '';
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    let passwordHash: string | null = null;
    if (password) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
      passwordHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 3600000).toISOString() : null;
    const { error } = await supabase.from('link_shares').insert({
      resource_type: item.kind,
      resource_id: item.id,
      token,
      password_hash: passwordHash,
      expires_at: expiresAt,
      created_by: userId,
    });
    if (error) throw new Error('Could not create share link.');
    await supabase.from('activities').insert({ actor_id: userId, action: 'share', resource_type: item.kind, resource_id: item.id, context: { name: item.name } });
    await refresh();
    return token;
  }, [userId, refresh]);

  const getLinkShares = useCallback(async (item: UnifiedItem): Promise<LinkShareRow[]> => {
    if (!userId) return [];
    const { data } = await supabase.from('link_shares').select('*').eq('resource_type', item.kind).eq('resource_id', item.id).eq('created_by', userId);
    return (data ?? []) as LinkShareRow[];
  }, [userId]);

  const revokeLinkShare = useCallback(async (id: string): Promise<void> => {
    await supabase.from('link_shares').delete().eq('id', id);
    await refresh();
  }, [refresh]);

  const inviteUser = useCallback(async (item: UnifiedItem, email: string, role: 'viewer' | 'editor'): Promise<void> => {
    if (!userId) return;
    const { data: profile } = await supabase.from('profiles').select('id').eq('email', email.toLowerCase().trim()).maybeSingle();
    if (!profile) throw new Error('No user found with that email. They need to sign up first.');
    if (profile.id === userId) throw new Error('You cannot share with yourself.');
    const { error } = await supabase.from('shares').insert({
      resource_type: item.kind,
      resource_id: item.id,
      grantee_user_id: profile.id,
      role,
      created_by: userId,
    });
    if (error) {
      if (error.code === '23505') throw new Error('This person already has access.');
      throw new Error('Could not share with that user.');
    }
    await supabase.from('activities').insert({ actor_id: userId, action: 'share', resource_type: item.kind, resource_id: item.id, context: { name: item.name, with: email } });
    await refresh();
  }, [userId, refresh]);

  const getShares = useCallback(async (item: UnifiedItem): Promise<(ShareRow & { grantee_email: string })[]> => {
    if (!userId) return [];
    const { data } = await supabase.from('shares').select('*, grantee_user_id').eq('resource_type', item.kind).eq('resource_id', item.id).eq('created_by', userId);
    const shares = (data ?? []) as ShareRow[];
    if (!shares.length) return [];
    const profileIds = shares.map((s) => s.grantee_user_id);
    const { data: profiles } = await supabase.from('profiles').select('id, email').in('id', profileIds);
    const emailMap = new Map((profiles ?? []).map((p) => [p.id, p.email]));
    return shares.map((s) => ({ ...s, grantee_email: emailMap.get(s.grantee_user_id) ?? 'Unknown' }));
  }, [userId]);

  const revokeShare = useCallback(async (id: string): Promise<void> => {
    await supabase.from('shares').delete().eq('id', id).eq('created_by', userId!);
    await refresh();
  }, [userId, refresh]);

  return {
    items, loading, error, breadcrumbs, starredIds, storageUsedBytes, activities,
    refresh, createFolder, uploadFiles, renameItem, toggleStar, moveToTrash,
    restoreItem, deletePermanently, emptyTrash, downloadFile, createLinkShare,
    getLinkShares, revokeLinkShare, inviteUser, getShares, revokeShare,
  };
}

export { STORAGE_LIMIT_BYTES };
