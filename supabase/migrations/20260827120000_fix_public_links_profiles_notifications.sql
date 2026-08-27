/* Allow the public share page to resolve active links without exposing link ownership. */
CREATE OR REPLACE FUNCTION public.resolve_link_share(p_token text)
RETURNS TABLE (resource_type text, resource_id uuid, expires_at timestamptz, password_protected boolean, password_hash text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ls.resource_type, ls.resource_id, ls.expires_at,
    (ls.password_hash IS NOT NULL), ls.password_hash
  FROM public.link_shares ls
  WHERE ls.token = p_token
    AND (ls.expires_at IS NULL OR ls.expires_at > now())
    AND ((ls.resource_type = 'file' AND EXISTS (SELECT 1 FROM public.files f WHERE f.id = ls.resource_id AND f.is_deleted = false))
      OR (ls.resource_type = 'folder' AND EXISTS (SELECT 1 FROM public.folders f WHERE f.id = ls.resource_id AND f.is_deleted = false)));
$$;

REVOKE ALL ON FUNCTION public.resolve_link_share(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_link_share(text) TO anon, authenticated;

DROP POLICY IF EXISTS "drive_files_read_active_link" ON storage.objects;
CREATE POLICY "drive_files_read_active_link" ON storage.objects FOR SELECT TO anon
USING (
  bucket_id = 'drive-files' AND EXISTS (
    SELECT 1 FROM public.link_shares ls
    LEFT JOIN public.files f ON ls.resource_type = 'file' AND f.id = ls.resource_id
    LEFT JOIN public.folders folder ON ls.resource_type = 'folder' AND folder.id = ls.resource_id
    WHERE (ls.expires_at IS NULL OR ls.expires_at > now())
      AND ((f.storage_key = name AND f.is_deleted = false)
        OR (folder.id IS NOT NULL AND f.folder_id = folder.id AND f.is_deleted = false))
  )
);

DROP POLICY IF EXISTS "files_select_active_link" ON public.files;
CREATE POLICY "files_select_active_link" ON public.files FOR SELECT TO anon USING (
  is_deleted = false AND EXISTS (
    SELECT 1 FROM public.link_shares ls
    WHERE (ls.expires_at IS NULL OR ls.expires_at > now())
      AND ((ls.resource_type = 'file' AND ls.resource_id = files.id)
        OR (ls.resource_type = 'folder' AND ls.resource_id = files.folder_id))
  )
);

DROP POLICY IF EXISTS "folders_select_active_link" ON public.folders;
CREATE POLICY "folders_select_active_link" ON public.folders FOR SELECT TO anon USING (
  is_deleted = false AND EXISTS (
    SELECT 1 FROM public.link_shares ls
    WHERE (ls.expires_at IS NULL OR ls.expires_at > now())
      AND ((ls.resource_type = 'folder' AND ls.resource_id = folders.id)
        OR (ls.resource_type = 'folder' AND ls.resource_id = folders.parent_id))
  )
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "avatars_read_public" ON storage.objects;
CREATE POLICY "avatars_read_public" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);