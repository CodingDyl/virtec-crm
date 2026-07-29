'use client'

import { useEffect, useState } from 'react';
import { getFileUrl } from '@/lib/storage-client';
import { ImageOff } from 'lucide-react';

interface StoredImageProps {
  /** A bucket path, or a legacy permanent URL. */
  fileRef: string;
  alt: string;
  className?: string;
}

/**
 * Renders an image held in Cloud Storage.
 *
 * Storage rules deny the browser, so there is no durable src to put in the tag —
 * a signed URL is fetched per render and expires shortly after. The placeholder
 * holds the same box the image will fill, so the grid does not reflow when it
 * resolves.
 */
export function StoredImage({ fileRef, alt, className }: StoredImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFailed(false);

    getFileUrl(fileRef)
      .then((resolved) => { if (!cancelled) setUrl(resolved); })
      .catch((error) => {
        console.error('Could not resolve image:', error);
        if (!cancelled) setFailed(true);
      });

    return () => { cancelled = true; };
  }, [fileRef]);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-space1 ${className ?? ''}`}>
        <ImageOff className="h-5 w-5 text-spaceAlt/50" aria-label={`${alt} (unavailable)`} />
      </div>
    );
  }

  if (!url) {
    return <div className={`animate-pulse bg-space1 ${className ?? ''}`} aria-hidden="true" />;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} />;
}
