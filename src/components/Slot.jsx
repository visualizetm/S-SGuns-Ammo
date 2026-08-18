// Labeled placeholder slot for Rob-supplied assets (logo art, photography,
// map imagery). Never stock filler: until a real file exists the slot shows
// a dashed frame with an uppercase label. When an asset path is provided it
// renders the image at the reserved size (lazy by default, since slots are
// mostly below the fold).
//
// If the image path is set but the file is not there yet (a 404), the slot
// falls back to the labeled placeholder instead of a broken-image icon. So
// a photo path can be wired in now and the picture simply appears the moment
// the correctly named file lands in public/.

import { useState } from 'react';

export function Slot({
  label,
  src = null,
  alt = '',
  ratio = '4 / 3',
  className = '',
  eager = false,
  fit = 'cover',
}) {
  const [broken, setBroken] = useState(false);
  const showImage = src && !broken;

  return (
    <div className={`slot ${className}`.trim()} style={{ aspectRatio: ratio }}>
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%', objectFit: fit }}
        />
      ) : (
        <span>{label}</span>
      )}
    </div>
  );
}
