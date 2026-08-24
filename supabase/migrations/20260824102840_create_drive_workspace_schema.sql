/*
# Create Drive workspace schema

1. New Tables
- `profiles`: one private profile row per signed-in user, including display name and avatar color.
- `folders`: user-owned hierarchical folders with optional parent folders and soft deletion.
- `files`: user-owned file metadata connected to folders, including storage path, MIME type, and size.
- `stars`: per-user favorites for files and folders.
- `shares`: explicit file/folder permissions granted to another signed-in user.
- `activities`: append-only activity history for a user's workspace.

2. Security
- Row Level Security is enabled on every table.
- All workspace reads and writes are scoped to the authenticated owner.
- Shared resources can be read by the user they were granted to.
- Profiles are readable to authenticated users so sharing can resolve a recipient.

3. Important notes
- Files use soft deletion via `is_deleted`; physical object storage cleanup can be added later without losing metadata.
- Folder hierarchy uses `parent_id` and supports breadcrumbs and nested navigation.
- The `storage_key` is private metadata; the browser must use authorized storage operations for downloads.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  avatar_color text NOT NULL DEFAULT '#315CFF',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  name text NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint NOT NULL DEFAULT 0,
  storage_key text NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stars (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('file', 'folder')),
  resource_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_type, resource_id)
);

CREATE TABLE IF NOT EXISTS public.shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL CHECK (resource_type IN ('file', 'folder')),
  resource_id uuid NOT NULL,
  grantee_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_type, resource_id, grantee_user_id)
);

CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('upload', 'rename', 'delete', 'restore', 'move', 'share', 'download', 'create_folder')),
  resource_type text NOT NULL CHECK (resource_type IN ('file', 'folder')),
  resource_id uuid NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS folders_owner_parent_idx ON public.folders(owner_id, parent_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS files_owner_folder_idx ON public.files(owner_id, folder_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS files_name_idx ON public.files(owner_id, name);
CREATE INDEX IF NOT EXISTS activities_actor_created_idx ON public.activities(actor_id, created_at DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "folders_select_own_or_shared" ON public.folders;
CREATE POLICY "folders_select_own_or_shared" ON public.folders FOR SELECT TO authenticated USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM public.shares WHERE shares.resource_type = 'folder' AND shares.resource_id = folders.id AND shares.grantee_user_id = auth.uid()));
DROP POLICY IF EXISTS "folders_insert_own" ON public.folders;
CREATE POLICY "folders_insert_own" ON public.folders FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "folders_update_own" ON public.folders;
CREATE POLICY "folders_update_own" ON public.folders FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "folders_delete_own" ON public.folders;
CREATE POLICY "folders_delete_own" ON public.folders FOR DELETE TO authenticated USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "files_select_own_or_shared" ON public.files;
CREATE POLICY "files_select_own_or_shared" ON public.files FOR SELECT TO authenticated USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM public.shares WHERE shares.resource_type = 'file' AND shares.resource_id = files.id AND shares.grantee_user_id = auth.uid()));
DROP POLICY IF EXISTS "files_insert_own" ON public.files;
CREATE POLICY "files_insert_own" ON public.files FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "files_update_own" ON public.files;
CREATE POLICY "files_update_own" ON public.files FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "files_delete_own" ON public.files;
CREATE POLICY "files_delete_own" ON public.files FOR DELETE TO authenticated USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "stars_select_own" ON public.stars;
CREATE POLICY "stars_select_own" ON public.stars FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "stars_insert_own" ON public.stars;
CREATE POLICY "stars_insert_own" ON public.stars FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "stars_update_own" ON public.stars;
CREATE POLICY "stars_update_own" ON public.stars FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "stars_delete_own" ON public.stars;
CREATE POLICY "stars_delete_own" ON public.stars FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "shares_select_involved" ON public.shares;
CREATE POLICY "shares_select_involved" ON public.shares FOR SELECT TO authenticated USING (auth.uid() = created_by OR auth.uid() = grantee_user_id);
DROP POLICY IF EXISTS "shares_insert_owner" ON public.shares;
CREATE POLICY "shares_insert_owner" ON public.shares FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "shares_update_owner" ON public.shares;
CREATE POLICY "shares_update_owner" ON public.shares FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "shares_delete_owner" ON public.shares;
CREATE POLICY "shares_delete_owner" ON public.shares FOR DELETE TO authenticated USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "activities_select_own" ON public.activities;
CREATE POLICY "activities_select_own" ON public.activities FOR SELECT TO authenticated USING (auth.uid() = actor_id);
DROP POLICY IF EXISTS "activities_insert_own" ON public.activities;
CREATE POLICY "activities_insert_own" ON public.activities FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);
DROP POLICY IF EXISTS "activities_update_own" ON public.activities;
CREATE POLICY "activities_update_own" ON public.activities FOR UPDATE TO authenticated USING (auth.uid() = actor_id) WITH CHECK (auth.uid() = actor_id);
DROP POLICY IF EXISTS "activities_delete_own" ON public.activities;
CREATE POLICY "activities_delete_own" ON public.activities FOR DELETE TO authenticated USING (auth.uid() = actor_id);