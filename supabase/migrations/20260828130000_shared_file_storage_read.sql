/* Recipients with access may create signed URLs for shared files. */
DROP POLICY IF EXISTS "drive_files_read_shared" ON storage.objects;
CREATE POLICY "drive_files_read_shared" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'drive-files' AND EXISTS (
    SELECT 1 FROM public.files f
    WHERE f.storage_key = name AND f.is_deleted = false
      AND (EXISTS (SELECT 1 FROM public.shares s WHERE s.resource_type = 'file' AND s.resource_id = f.id AND s.grantee_user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.shares s WHERE s.resource_type = 'folder' AND s.resource_id = f.folder_id AND s.grantee_user_id = auth.uid()))
  )
);