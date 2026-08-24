/*
# Create private drive-files storage bucket

1. Storage
- Create a private bucket `drive-files` for user uploads.
- Each authenticated user can manage objects only under their own user-id prefix.

2. Security
- SELECT (read/download) allowed only for the object owner.
- INSERT (upload) allowed only into the owner's prefix.
- UPDATE (overwrite) allowed only for the owner's prefix.
- DELETE allowed only for the owner's prefix.

3. Notes
- Objects are stored at `<user_id>/<filename>` so policies can enforce prefix ownership.
- The bucket is private; downloads go through signed URLs or the authorized client.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('drive-files', 'drive-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "drive_files_read_own" ON storage.objects;
CREATE POLICY "drive_files_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'drive-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "drive_files_insert_own" ON storage.objects;
CREATE POLICY "drive_files_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'drive-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "drive_files_update_own" ON storage.objects;
CREATE POLICY "drive_files_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'drive-files' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'drive-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "drive_files_delete_own" ON storage.objects;
CREATE POLICY "drive_files_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'drive-files' AND (storage.foldername(name))[1] = auth.uid()::text);