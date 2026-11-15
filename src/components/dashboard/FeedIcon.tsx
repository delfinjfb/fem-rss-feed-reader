'use client';

import { useState } from 'react';

/** Source favicon with a lettered fallback when the site has none (or blocks hotlinking). */
export function FeedIcon({ src, title, size = 16 }: { src: string | null; title: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };

  if (!src || failed) {
    return (
      <span
        aria-hidden="true"
        style={{ ...box, fontSize: size * 0.6 }}
        className="grid shrink-0 place-items-center rounded-sm bg-bg-tertiary font-semibold text-text-secondary"
      >
        {title.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- third-party favicons, unknown sizes; next/image would proxy them all
    <img
      src={src}
      alt=""
      {...box}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      // An image that failed before hydration never fires onError: check its state on mount.
      ref={(img) => {
        if (img?.complete && img.naturalWidth === 0) setFailed(true);
      }}
      className="shrink-0 rounded-sm"
    />
  );
}
