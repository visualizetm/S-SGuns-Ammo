// Labeled placeholder slot for Rob-supplied assets (logo art, photography,
// map imagery). Never stock filler: until a real file exists the slot shows
// a dashed frame with an uppercase label. When an asset path is provided it
// renders the image at the reserved size (lazy by default, since slots are
// mostly below the fold).

export function Slot({
  label,
  src = null,
  alt = '',
  ratio = '4 / 3',
  className = '',
  eager = false,
}) {
  return (
    <div className={`slot ${className}`.trim()} style={{ aspectRatio: ratio }}>
      {src ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span>{label}</span>
      )}
    </div>
  );
}
