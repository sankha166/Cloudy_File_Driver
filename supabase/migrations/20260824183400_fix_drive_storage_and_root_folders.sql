/*
# Fix drive uploads and root-folder uniqueness

1. Storage
- Remove the bucket MIME allow-list so uploads are not rejected for common types
  (image/jpeg, empty Windows MIME types, svg, zip variants). Size limit stays 100 MB.

2. Folders
- Unique names at the drive root (parent_id IS NULL) were not enforced by the
  existing composite unique index, because PostgreSQL treats NULLs as distinct.
*/

UPDATE storage.buckets
SET allowed_mime_types = NULL,
    file_size_limit = 104857600
WHERE id = 'drive-files';

CREATE UNIQUE INDEX IF NOT EXISTS folders_owner_root_name_idx
  ON public.folders (owner_id, lower(name))
  WHERE is_deleted = false AND parent_id IS NULL;
