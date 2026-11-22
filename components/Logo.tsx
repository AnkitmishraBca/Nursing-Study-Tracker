'use client';

import { useState } from 'react';

/**
 * Phase 4 — logo. Reads /public/logo.png.
 * If the file is missing the component falls back to the gradient "N" tile,
 * so the app never breaks.
 */
export default function Logo({
  size = 44,
  rounded = 'rounded-2xl',
  className = '',
}: {
  size?: number;
  rounded?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-mint to-violet ${rounded} ${className}`}
        style={{ width: size, height: size }}
        aria-label="Nursing Tracker logo"
      >
        <span className="font-black leading-none text-ink" style={{ fontSize: size * 0.46 }}>
          N
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Nursing Tracker logo"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`${rounded} shrink-0 object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
