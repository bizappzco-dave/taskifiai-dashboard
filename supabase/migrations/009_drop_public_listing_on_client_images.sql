-- Security hardening batch 4
-- Public buckets do not need a broad SELECT policy for known public URLs to work.
-- Drop the bucket-wide listing policy so objects remain publicly fetchable by URL
-- but can no longer be enumerated through Storage listing APIs.

DROP POLICY IF EXISTS "Public access to client images" ON storage.objects;
