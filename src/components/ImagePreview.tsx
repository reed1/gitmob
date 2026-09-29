'use client';

import { useState } from 'react';

/**
 * An image fitted to the space it is given; a tap switches to its natural size, scrolling where it
 * overflows, and back. The checkerboard shows where the image is transparent.
 */
export function ImagePreview({
  src,
  alt,
  onSize,
}: {
  src: string;
  alt: string;
  onSize?: (size: { width: number; height: number }) => void;
}) {
  const [actualSize, setActualSize] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="p-4 text-center text-foreground/50">
        Cannot display this image
      </div>
    );
  }

  return (
    <div
      className={`h-full w-full overflow-auto ${
        actualSize ? '' : 'flex items-center justify-center p-4'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={() => setActualSize(!actualSize)}
        onLoad={(e) =>
          onSize?.({
            width: e.currentTarget.naturalWidth,
            height: e.currentTarget.naturalHeight,
          })
        }
        onError={() => setFailed(true)}
        className={`bg-[repeating-conic-gradient(#8883_0_25%,transparent_0_50%)] bg-[length:16px_16px] ${
          actualSize
            ? 'max-w-none cursor-zoom-out'
            : 'max-w-full max-h-full object-contain cursor-zoom-in'
        }`}
      />
    </div>
  );
}
