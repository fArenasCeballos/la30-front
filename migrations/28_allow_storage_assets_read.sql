-- ============================================================
-- SCRIPT 28: Allow Public and Authenticated Read for Assets Bucket
-- Permite listar y consultar imágenes del bucket 'assets' (carpeta products)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow public and auth read assets'
  ) THEN
    CREATE POLICY "Allow public and auth read assets"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'assets');
  END IF;
END $$;
