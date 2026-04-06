
-- Make buckets private
UPDATE storage.buckets SET public = false WHERE id = 'journal-photos';
UPDATE storage.buckets SET public = false WHERE id = 'seed-pack-photos';

-- Remove open SELECT policies
DROP POLICY IF EXISTS "Anyone can view journal photos" ON storage.objects;
DROP POLICY IF EXISTS "Seed pack photos are publicly readable" ON storage.objects;

-- Journal photos: owner-only SELECT
CREATE POLICY "Owner can view journal photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'journal-photos' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Journal photos: owner-only UPDATE
CREATE POLICY "Owner can update journal photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'journal-photos' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Seed pack photos: owner-only SELECT
CREATE POLICY "Owner can view seed pack photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'seed-pack-photos' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Seed pack photos: owner-only UPDATE
CREATE POLICY "Owner can update seed pack photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'seed-pack-photos' AND (auth.uid())::text = (storage.foldername(name))[1]);
