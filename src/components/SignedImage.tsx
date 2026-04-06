import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SignedImageProps {
  bucket: string;
  path: string;
  alt?: string;
  className?: string;
}

export function SignedImage({ bucket, path, alt = '', className }: SignedImageProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    // If path is already a full URL (legacy data), use it directly
    if (path.startsWith('http')) {
      setUrl(path);
      return;
    }
    let cancelled = false;
    supabase.storage.from(bucket).createSignedUrl(path, 3600).then(({ data }) => {
      if (!cancelled && data?.signedUrl) setUrl(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [bucket, path]);

  if (!url) return <div className={`${className} bg-muted animate-pulse`} />;
  return <img src={url} alt={alt} className={className} />;
}