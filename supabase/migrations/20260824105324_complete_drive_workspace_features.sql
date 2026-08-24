/*
# Complete real-data drive features

1. New tables
- `file_versions`: immutable metadata for each uploaded version of a logical file.
- `link_shares`: expiring public links for files and folders, with optional password hash.

2. Modified tables
- `files`: adds current version pointer and checksum fields.
- `profiles`: keeps profile data tied to auth users.

3. Security
- Every new table has RLS enabled.
- Owners can manage versions and public links for resources they own.
- Public-link lookup is exposed through a narrowly scoped function that only returns an unexpired resource.
- Storage bucket limits are set to 100 MB and allowed MIME types are constrained.

4. Notes
- Deleted resources remain in metadata for restore and retention workflows.
- File versions are append-only from the client; deletion and restore are owner-scoped.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.files ADD COLUMN IF NOT EXISTS version_id uuid;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS checksum text;

CREATE TABLE IF NOT EXISTS public.file_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  storage_key text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  checksum text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (file_id, version_number)
);

ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_version_id_fkey;
ALTER TABLE public.files ADD CONSTRAINT files_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.file_versions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.link_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL CHECK (resource_type IN ('file', 'folder')),
  resource_id uuid NOT NULL,
  token text NOT NULL UNIQUE CHECK (length(token) >= 32),
  password_hash text,
  expires_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS file_versions_file_created_idx ON public.file_versions(file_id, created_at DESC);
CREATE INDEX IF NOT EXISTS link_shares_token_idx ON public.link_shares(token);
CREATE INDEX IF NOT EXISTS files_owner_name_idx ON public.files(owner_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS folders_owner_parent_name_idx ON public.folders(owner_id, parent_id, lower(name)) WHERE is_deleted = false;

ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "file_versions_select_owner" ON public.file_versions;
CREATE POLICY "file_versions_select_owner" ON public.file_versions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.files WHERE files.id = file_versions.file_id AND files.owner_id = auth.uid()));
DROP POLICY IF EXISTS "file_versions_insert_owner" ON public.file_versions;
CREATE POLICY "file_versions_insert_owner" ON public.file_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND EXISTS (SELECT 1 FROM public.files WHERE files.id = file_versions.file_id AND files.owner_id = auth.uid()));
DROP POLICY IF EXISTS "file_versions_update_owner" ON public.file_versions;
CREATE POLICY "file_versions_update_owner" ON public.file_versions FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "file_versions_delete_owner" ON public.file_versions;
CREATE POLICY "file_versions_delete_owner" ON public.file_versions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.files WHERE files.id = file_versions.file_id AND files.owner_id = auth.uid()));

DROP POLICY IF EXISTS "link_shares_select_owner" ON public.link_shares;
CREATE POLICY "link_shares_select_owner" ON public.link_shares FOR SELECT TO authenticated USING (auth.uid() = created_by);
DROP POLICY IF EXISTS "link_shares_insert_owner" ON public.link_shares;
CREATE POLICY "link_shares_insert_owner" ON public.link_shares FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND ((resource_type = 'file' AND EXISTS (SELECT 1 FROM public.files WHERE files.id = resource_id AND files.owner_id = auth.uid())) OR (resource_type = 'folder' AND EXISTS (SELECT 1 FROM public.folders WHERE folders.id = resource_id AND folders.owner_id = auth.uid()))));
DROP POLICY IF EXISTS "link_shares_update_owner" ON public.link_shares;
CREATE POLICY "link_shares_update_owner" ON public.link_shares FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "link_shares_delete_owner" ON public.link_shares;
CREATE POLICY "link_shares_delete_owner" ON public.link_shares FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE OR REPLACE FUNCTION public.resolve_link_share(p_token text)
RETURNS TABLE (resource_type text, resource_id uuid, expires_at timestamptz, password_protected boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ls.resource_type, ls.resource_id, ls.expires_at, (ls.password_hash IS NOT NULL)
  FROM public.link_shares ls
  WHERE ls.token = p_token
    AND (ls.expires_at IS NULL OR ls.expires_at > now())
    AND ((ls.resource_type = 'file' AND EXISTS (SELECT 1 FROM public.files f WHERE f.id = ls.resource_id AND f.is_deleted = false)) OR (ls.resource_type = 'folder' AND EXISTS (SELECT 1 FROM public.folders f WHERE f.id = ls.resource_id AND f.is_deleted = false)));
$$;
REVOKE ALL ON FUNCTION public.resolve_link_share(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_link_share(text) TO anon, authenticated;

UPDATE storage.buckets SET file_size_limit = 104857600, allowed_mime_types = ARRAY['image/*','application/pdf','text/plain','text/csv','application/json','application/zip','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'] WHERE id = 'drive-files';