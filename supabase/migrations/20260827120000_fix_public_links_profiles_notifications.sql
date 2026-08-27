CREATE EXTENSION IF NOT EXISTS pgcrypto;

/* Keep the original public RPC signature; PostgreSQL does not allow changing OUT columns with OR REPLACE. */
CREATE OR REPLACE FUNCTION public.resolve_link_share(p_token text)
RETURNS TABLE (resource_type text, resource_id uuid, expires_at timestamptz, password_protected boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ls.resource_type, ls.resource_id, ls.expires_at,
    (ls.password_hash IS NOT NULL)
  FROM public.link_shares ls
  WHERE ls.token = p_token
    AND (ls.expires_at IS NULL OR ls.expires_at > now())
    AND ((ls.resource_type = 'file' AND EXISTS (SELECT 1 FROM public.files f WHERE f.id = ls.resource_id AND f.is_deleted = false))
      OR (ls.resource_type = 'folder' AND EXISTS (SELECT 1 FROM public.folders f WHERE f.id = ls.resource_id AND f.is_deleted = false)));
$$;

REVOKE ALL ON FUNCTION public.resolve_link_share(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_link_share(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_link_share_password(p_token text, p_password text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.link_shares ls
    WHERE ls.token = p_token
      AND (ls.expires_at IS NULL OR ls.expires_at > now())
      AND ls.password_hash = encode(extensions.digest(p_password, 'sha256'::text), 'hex')
  );
$$;

REVOKE ALL ON FUNCTION public.verify_link_share_password(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_link_share_password(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.has_active_link(p_resource_type text, p_resource_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.link_shares
    WHERE resource_type = p_resource_type AND resource_id = p_resource_id
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

REVOKE ALL ON FUNCTION public.has_active_link(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_link(text, uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "drive_files_read_active_link" ON storage.objects;
CREATE POLICY "drive_files_read_active_link" ON storage.objects FOR SELECT TO anon
USING (
  bucket_id = 'drive-files' AND EXISTS (
    SELECT 1 FROM public.files f
    WHERE f.storage_key = name AND f.is_deleted = false
      AND (public.has_active_link('file', f.id) OR public.has_active_link('folder', f.folder_id))
  )
);

DROP POLICY IF EXISTS "files_select_active_link" ON public.files;
CREATE POLICY "files_select_active_link" ON public.files FOR SELECT TO anon USING (
  is_deleted = false AND (public.has_active_link('file', files.id) OR public.has_active_link('folder', files.folder_id))
);

DROP POLICY IF EXISTS "folders_select_active_link" ON public.folders;
CREATE POLICY "folders_select_active_link" ON public.folders FOR SELECT TO anon USING (
  is_deleted = false AND (public.has_active_link('folder', folders.id) OR public.has_active_link('folder', folders.parent_id))
);

DROP POLICY IF EXISTS "files_select_shared_folder" ON public.files;
CREATE POLICY "files_select_shared_folder" ON public.files FOR SELECT TO authenticated USING (
  is_deleted = false AND EXISTS (SELECT 1 FROM public.shares s WHERE s.resource_type = 'folder' AND s.resource_id = files.folder_id AND s.grantee_user_id = auth.uid())
);

DROP POLICY IF EXISTS "folders_select_shared_child" ON public.folders;
CREATE POLICY "folders_select_shared_child" ON public.folders FOR SELECT TO authenticated USING (
  is_deleted = false AND EXISTS (SELECT 1 FROM public.shares s WHERE s.resource_type = 'folder' AND s.resource_id = folders.parent_id AND s.grantee_user_id = auth.uid())
);

DROP POLICY IF EXISTS "files_update_shared_editor" ON public.files;
CREATE POLICY "files_update_shared_editor" ON public.files FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.shares s WHERE s.resource_type = 'file' AND s.resource_id = files.id AND s.grantee_user_id = auth.uid() AND s.role = 'editor')
  OR EXISTS (SELECT 1 FROM public.shares s WHERE s.resource_type = 'folder' AND s.resource_id = files.folder_id AND s.grantee_user_id = auth.uid() AND s.role = 'editor')
) WITH CHECK (true);

DROP POLICY IF EXISTS "folders_update_shared_editor" ON public.folders;
CREATE POLICY "folders_update_shared_editor" ON public.folders FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.shares s WHERE s.resource_type = 'folder' AND s.resource_id = folders.id AND s.grantee_user_id = auth.uid() AND s.role = 'editor')
) WITH CHECK (true);

DROP POLICY IF EXISTS "files_delete_shared_editor" ON public.files;
CREATE POLICY "files_delete_shared_editor" ON public.files FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.shares s WHERE s.resource_type = 'file' AND s.resource_id = files.id AND s.grantee_user_id = auth.uid() AND s.role = 'editor')
  OR EXISTS (SELECT 1 FROM public.shares s WHERE s.resource_type = 'folder' AND s.resource_id = files.folder_id AND s.grantee_user_id = auth.uid() AND s.role = 'editor')
);

DROP POLICY IF EXISTS "folders_delete_shared_editor" ON public.folders;
CREATE POLICY "folders_delete_shared_editor" ON public.folders FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.shares s WHERE s.resource_type = 'folder' AND s.resource_id = folders.id AND s.grantee_user_id = auth.uid() AND s.role = 'editor')
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "avatars_read_public" ON storage.objects;
CREATE POLICY "avatars_read_public" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);