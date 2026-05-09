import { useEffect, useMemo, useState } from "react";
import { resolvePhotoUrl } from "@/lib/api";

const FALLBACK_SRC = "/images/fallback.png";

export function ProfileAvatar({
  photoUrl,
  name,
  className = "w-10 h-10 rounded-full",
}: {
  photoUrl?: string | null;
  name?: string | null;
  className?: string;
}) {
  const resolved = useMemo(() => resolvePhotoUrl(photoUrl) ?? FALLBACK_SRC, [photoUrl]);
  const [src, setSrc] = useState(resolved);

  useEffect(() => {
    setSrc(resolved);
  }, [resolved]);

  return (
    <img
      src={src}
      alt={name ? `${name} avatar` : "Profile avatar"}
      className={`${className} object-cover`}
      onError={() => {
        if (src !== FALLBACK_SRC) setSrc(FALLBACK_SRC);
      }}
      loading="lazy"
      decoding="async"
    />
  );
}

